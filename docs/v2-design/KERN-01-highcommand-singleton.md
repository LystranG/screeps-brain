# KERN-01: HighCommand 全局单例设计

**版本:** v2.0
**状态:** 生效
**决策来源:** D-01、D-02、D-03、D-04、D-05、D-06（09-CONTEXT.md）
**关联规范:** SPEC-01（目录结构）、SPEC-03（模块边界）、SPEC-04（接口契约）

---

## 1. 总体原则（D-04）

**HighCommand 是薄协调者，不是决策者。**

HighCommand.ts 本身只做生命周期调度，所有业务逻辑在 Intel/Garrison 内部。预期实现代码量不超过约 100 行。

本文档锁定以下六条决策：

| 决策 | 内容 |
|------|------|
| D-01 | Kernel 保留为薄壳编排器，负责 services 初始化（logger/profiler）、环境检测、try/catch 错误边界。HighCommand 作为新的生命周期阶段插入 Kernel 的阶段列表。 |
| D-02 | 粗粒度阶段划分：Kernel 只注册一个 `highCommandTick` 阶段调用 `HighCommand.tick()`。HighCommand 内部自治管理 build/refresh/init/run 的分支逻辑。 |
| D-03 | Kernel 字段持有 HighCommand 实例（`private readonly highCommand: HighCommand`）。不使用 global 变量注册。 |
| D-04 | HighCommand 是薄协调者——只持有引用（intel、garrisons、cache）并驱动生命周期调用，不做业务决策。 |
| D-05 | Intel、Garrison 各自是独立模块（`src/highCommand/intel/`、`src/highCommand/garrison/`），HighCommand 持有引用并调用，复杂逻辑在各自内部。 |
| D-06 | HighCommand 自治检测 global reset（`global._lastTick !== Game.time - 1`），自己决定 build vs refresh。Kernel 不参与此决策。 |

---

## 2. 文件位置与目录结构（SPEC-01）

Phase 9 在现有目录基础上新增以下文件：

```
src/
├── highCommand/
│   ├── index.ts          # barrel：export { HighCommand }（例外：允许导出具体类）
│   └── HighCommand.ts    # 顶级单例
└── shared/
    ├── interfaces/
    │   ├── index.ts      # 扩展：re-export ITaskForceRegistry, IIntelProvider (minimal)
    │   ├── ITaskForceRegistry.ts  # 新增：TaskForce 注册接口（见 KERN-04）
    │   └── IIntelProvider.ts      # 新增：情报模块最小接口（见第 7 节）
    └── constants/
        └── cpu.ts        # 新增：CpuBudgetLevel（见 KERN-02）
```

**Barrel 规则（SPEC-03）：**
- `src/highCommand/index.ts` 是唯一例外——允许导出具体类 `HighCommand`，因为 Kernel 必须实例化它
- `src/shared/interfaces/index.ts` 只用 `export type`，不导出运行时值

---

## 3. HighCommand 类定义（D-03、D-04、D-15）

以下为完整的类定义，可直接复制到 `src/highCommand/HighCommand.ts`：

```typescript
import type { IIntelProvider } from "shared/interfaces";
import type { IGarrison } from "highCommand/garrison";
import type { ITaskForce, ITaskForceRegistry } from "shared/interfaces";
import { EventBus } from "shared/events";
import type { CpuBudgetLevel } from "shared/constants/cpu";
import type { RuntimeServices } from "runtime/services";

/**
 * 全局 Cache 数据结构：每 tick Refresh 阶段完全重建，无跨 tick 持久化（D-12）。
 * 正向查询：TF ref → creep names / Garrison name → creep names。
 * 不维护 creep → TF 的反向映射（D-14）。
 */
interface HighCommandCache {
  /** TaskForce ref → 该 TF 管辖的 creep 名称列表 */
  creepsByTaskForce: Record<string, string[]>;
  /** Garrison name → 该 Garrison 管辖的 creep 名称列表 */
  creepsByGarrison: Record<string, string[]>;
}

/**
 * HighCommand 全局单例：tick 驱动入口，持有所有顶层子系统引用。
 * 只做生命周期协调，不做任何业务决策（D-04）。
 * 由 Kernel 的 highCommandTick 阶段持有和调用（D-03）。
 */
export class HighCommand implements ITaskForceRegistry {
  /** 已知 Garrison 的映射，key 为房间名（D-05） */
  private garrisons: Record<string, IGarrison> = {};

  /** 情报模块引用（接口类型，非 Intel 实现类——SPEC-04 模式 2）*/
  private intel: IIntelProvider | null = null;

  /** 全局 Cache 反向索引，每 tick Refresh 阶段重建（见 KERN-04）*/
  private cache: HighCommandCache = { creepsByTaskForce: {}, creepsByGarrison: {} };

  /** 全局 TaskForce 注册表，build 阶段填充（D-15）*/
  private taskForces: Record<string, ITaskForce> = {};

  /** tick 内同步事件总线（D-16 事件驱动 build）*/
  private readonly eventBus: EventBus;

  /** 事件驱动 build 标志；Run 阶段事件 emit → 下一 tick 触发 build（D-16）*/
  private _needsBuildFlag: boolean = true;

  /**
   * 最后已知的 tick，用于 global reset 检测（D-06）。
   * 注意：存储在 global 对象上，不在 HighCommand 实例字段中：
   *   `(global as Record<string, unknown>)._lastTick`
   * 原因：HighCommand 实例本身可能在 global reset 后被 Kernel 重建，
   * 但 Kernel 实例在同一 JS 进程生命周期内持续存在，global 也是如此。
   * 将 _lastTick 置于 global 上可以在 HighCommand 重建时仍能检测 reset。
   */

  public constructor() {
    this.eventBus = new EventBus();
  }
}
```

**字段类型说明（SPEC-04 模式 2）：**

| 字段 | 类型 | 原因 |
|------|------|------|
| `garrisons` | `Record<string, IGarrison>` | 持有接口类型，不持有 `Garrison` 实现类（D-05） |
| `intel` | `IIntelProvider \| null` | 持有最小接口，不持有 `Intel` 实现类（D-05） |
| `taskForces` | `Record<string, ITaskForce>` | 通过 `ITaskForceRegistry` 接口注入，不持有具体 TF 类（D-15） |
| `eventBus` | `EventBus` | EventBus 本身是跨域基础设施，允许直接持有具体类 |

---

## 4. tick() 方法——自治生命周期分支（D-06）

`tick()` 是 HighCommand 的唯一公开入口，由 Kernel 的 `highCommandTick` 阶段调用。参数通过 `tick(services)` 传入（而非构造注入），使 HighCommand 无服务状态，便于测试。

```typescript
/**
 * 本 tick 入口：由 Kernel 的 highCommandTick 阶段调用。
 * 自治判断 build vs refresh，不依赖 Kernel 传入决策（D-06）。
 * @param services - Kernel 提供的本 tick 运行时服务（logger、profiler）
 */
public tick(services: RuntimeServices): void {
  const isGlobalReset = (global as Record<string, unknown>)._lastTick !== Game.time - 1;
  const needsBuild = isGlobalReset || this._needsBuildFlag;

  if (needsBuild) {
    try {
      this.build(services);
      this._needsBuildFlag = false;
      (global as Record<string, unknown>)._lastTick = Game.time;
    } catch (error) {
      // Build 失败：保持 _needsBuildFlag = true，下一 tick 重试（D-17）
      Game.notify(`HighCommand build failed at tick ${Game.time}: ${String(error)}`);
      return;
    }
  } else {
    this.refresh(services);
    (global as Record<string, unknown>)._lastTick = Game.time;
  }

  const budgetLevel = this.computeBudgetLevel(services);

  if (budgetLevel === CpuBudgetLevel.Critical) {
    this.runMinimalSet(services);
  } else {
    this.init(services);
    this.run(services);
  }
}
```

**关键设计约束（D-06、D-17）：**

1. `global._lastTick` 的更新发生在 build 成功之后——失败时不更新，保证下一 tick 仍执行 build（避免 Pitfall 4：Build 失败后状态残留）
2. `isGlobalReset` 的判断：首次执行时 `_lastTick` 为 `undefined`，`undefined !== Game.time - 1` 为 `true`，正确触发 build
3. build 失败时立即 `return`，不执行 init/run，避免引用 null 导致级联崩溃

---

## 5. Kernel 集成（D-01、D-02、D-03）

### 5.1 Kernel 字段修改

在 `src/runtime/Kernel.ts` 中新增 `highCommand` 字段：

```typescript
import { HighCommand } from "highCommand";

/**
 * Tick 内核：按固定生命周期顺序执行各阶段，单阶段失败不阻断后续阶段。
 * 测试可通过 stages override 替换任意阶段 runner。
 */
export class Kernel {
  private readonly stages: LifecycleStageOverrides;
  private services: RuntimeServices | null = null;
  private readonly highCommand: HighCommand;  // D-03: Kernel 字段持有实例

  public constructor(options: KernelOptions = {}) {
    this.stages = options.stages || {};
    this.highCommand = new HighCommand();     // 单例由 Kernel 构造
  }
  // ... 其余方法不变
}
```

### 5.2 lifecycle.ts 扩展

**扩展 `LifecycleStageName` 联合类型：**

```typescript
// 扩展前（当前状态）：
export type LifecycleStageName =
  | "refreshServices"
  | "detectEnvironmentBootstrap";

// 扩展后（Phase 9 新增）：
export type LifecycleStageName =
  | "refreshServices"
  | "detectEnvironmentBootstrap"
  | "highCommandTick";   // Phase 9 新增（KERN-01/KERN-03）
```

**`KERNEL_LIFECYCLE_STAGES` 追加第三个阶段：**

由于现有 `KERNEL_LIFECYCLE_STAGES` 是静态数组，Phase 9 实现时需要将其重构为工厂函数 `createLifecycleStages(highCommand: HighCommand): LifecycleStage[]`，使 `highCommandTick` 阶段能够通过闭包捕获 `highCommand` 实例：

```typescript
// src/runtime/lifecycle.ts — 重构为工厂函数
import type { HighCommand } from "highCommand";

/**
 * 创建生命周期阶段列表。
 * 接受 highCommand 参数，使 highCommandTick 阶段可以通过闭包访问实例（D-03）。
 * @param highCommand - Kernel 持有的 HighCommand 实例
 */
export function createLifecycleStages(highCommand: HighCommand): LifecycleStage[] {
  return [
    {
      // 基于 Memory 配置创建本 tick 的 logger / profiler / 环境服务。
      name: "refreshServices",
      run(context: RuntimeLifecycleContext): void {
        context.services = createRuntimeServices(context.memory, context.game);
      }
    },
    {
      // 检测运行环境（sim/world/private）并执行 sim 引导 guidance。
      name: "detectEnvironmentBootstrap",
      run: runEnvironmentBootstrapStage
    },
    {
      // 驱动 HighCommand 完整 tick（build/refresh + init/run）。
      name: "highCommandTick",
      run(context: RuntimeLifecycleContext): void {
        // 确保 services 已初始化（profiler/logger 可用）
        const services = context.requireServices();
        highCommand.tick(services);
      }
    }
  ];
}

// 同时保留 KERNEL_LIFECYCLE_STAGES 导出的向后兼容（测试中使用的静态列表）：
export const KERNEL_LIFECYCLE_STAGES: LifecycleStage[] = [
  // ... 保留旧两个阶段，用于现有测试兼容
];
```

**Kernel 中调用工厂函数：**

```typescript
// src/runtime/Kernel.ts — 调整 createLifecycleStages 调用
private createLifecycleStages(): LifecycleStage[] {
  // 使用工厂函数将 highCommand 实例传入（D-03）
  return createLifecycleStagesFn(this.highCommand).map(stage => ({
    name: stage.name,
    run: this.stages[stage.name] || stage.run
  }));
}
```

---

## 6. 方法签名摘要

所有 public/private 方法签名（含 ITaskForceRegistry 实现方法）：

| 方法签名 | 可见性 | 说明 |
|---------|--------|------|
| `tick(services: RuntimeServices): void` | public | 本 tick 入口，自治判断 build/refresh |
| `register(ref: string, taskForce: ITaskForce): void` | public | ITaskForceRegistry 实现，Build 阶段注册 TF |
| `unregister(ref: string): void` | public | ITaskForceRegistry 实现，注销 TF |
| `getCreepsByTaskForce(ref: string): string[]` | public | Cache 查询接口（见 KERN-04）|
| `getCreepsByGarrison(garrisonName: string): string[]` | public | Cache 查询接口（见 KERN-04）|
| `build(services: RuntimeServices): void` | private | 完整构造对象树（Intel、Garrison、注册 EventBus 处理器）|
| `refresh(services: RuntimeServices): void` | private | 最小刷新 + Cache 重建（见 KERN-03、KERN-04）|
| `init(services: RuntimeServices): void` | private | 驱动 Intel.init() → TaskForce.init() → Garrison.init() |
| `run(services: RuntimeServices): void` | private | 驱动 Intel.run() → TaskForce.run() → Garrison.run() |
| `runMinimalSet(services: RuntimeServices): void` | private | 熔断模式：只执行 refresh + spawn 基础设施（D-10）|
| `computeBudgetLevel(services: RuntimeServices): CpuBudgetLevel` | private | 计算本 tick CPU 预算等级（见 KERN-02）|
| `rebuildCache(): void` | private | Cache 索引完全重建（见 KERN-04）|

**ITaskForceRegistry 实现说明：**

```typescript
/**
 * 注册 TaskForce（Build 阶段，TaskForce 构造时调用）。
 * HighCommand 作为 ITaskForceRegistry 实现，在构造时注入给 TaskForce（D-15）。
 * @param ref - TaskForce 的唯一标识符
 * @param taskForce - TaskForce 实例
 */
public register(ref: string, taskForce: ITaskForce): void {
  this.taskForces[ref] = taskForce;
}

/**
 * 注销 TaskForce（对象树销毁时调用，通常在 build() 开始时清空）。
 * @param ref - TaskForce 的唯一标识符
 */
public unregister(ref: string): void {
  delete this.taskForces[ref];
}
```

---

## 7. IIntelProvider 最小接口（Phase 9 占位）

Phase 9 只定义供 HighCommand 驱动 init/run 生命周期所需的最小方法。完整情报查询接口（`getThreatLevel`、`getHostileCount` 等）在 Phase 11 扩展。

```typescript
// src/shared/interfaces/IIntelProvider.ts
import type { RuntimeServices } from "runtime/services";

/**
 * 情报模块接口：HighCommand 驱动 Intel 生命周期所需的最小契约。
 * Phase 9 只定义 init/run 生命周期方法；完整情报查询接口在 Phase 11 扩展。
 */
export interface IIntelProvider {
  /**
   * 声明阶段：排序 TaskForce、收集 spawn 声明。
   * 必须在 run() 之前调用，每 tick 调用一次。
   * @param services - 本 tick 运行时服务
   */
  init(services: RuntimeServices): void;

  /**
   * 执行阶段：驱动所有 TaskForce 执行 Creep 行为。
   * 在所有 init() 完成后统一调用。
   * @param services - 本 tick 运行时服务
   */
  run(services: RuntimeServices): void;
}
```

`src/shared/interfaces/index.ts` 扩展后的完整 barrel：

```typescript
// 跨域接口契约的唯一导出口（barrel）。Phase 9 填充 ITaskForceRegistry、IIntelProvider。
export type { ITaskForceRegistry } from "./ITaskForceRegistry";
export type { IIntelProvider } from "./IIntelProvider";
export type { ITaskForce } from "./ITaskForce";   // Phase 13 添加具体定义
```

---

## 8. 禁止模式（D-03、D-04、D-09）

### 禁止 1：global 注册 HighCommand（D-03）

```typescript
// ❌ 禁止：将 HighCommand 实例挂载到 global
(global as any).highCommand = new HighCommand();

// ✅ 正确：由 Kernel 字段持有，不暴露到 global
export class Kernel {
  private readonly highCommand: HighCommand;
  public constructor() {
    this.highCommand = new HighCommand();
  }
}
```

### 禁止 2：HighCommand 持有具体类引用（SPEC-04 模式 2）

```typescript
// ❌ 禁止：持有 Intel 具体实现类类型
import { Intel } from "highCommand/intel/Intel";
private intel: Intel;

// ✅ 正确：持有接口类型，通过 shared/interfaces barrel 导入
import type { IIntelProvider } from "shared/interfaces";
private intel: IIntelProvider | null = null;
```

### 禁止 3：HighCommand 做业务决策（D-04）

```typescript
// ❌ 禁止：HighCommand 内部包含业务判断逻辑
public tick(services: RuntimeServices): void {
  if (this.intel?.getThreatLevel("W1N1") > 3) {
    this.activateSafeMode();  // 业务决策不属于 HighCommand
  }
  if (this.needsExpansion()) {
    this.placeOrders();       // 业务决策属于 Intel/Garrison
  }
}

// ✅ 正确：HighCommand 只驱动生命周期，业务决策在 Intel/Garrison 内部
public tick(services: RuntimeServices): void {
  // 只判断 build/refresh，其余委托给子模块
  if (needsBuild) { this.build(services); }
  else { this.refresh(services); }
  this.init(services);
  this.run(services);
}
```

### 禁止 4：Run 阶段注册 EventBus 处理器（SPEC-04 禁止模式 5）

```typescript
// ❌ 禁止：在 run() 中注册处理器（导致每 tick 重复注册，处理器越积越多）
private run(services: RuntimeServices): void {
  this.eventBus.on("structureBuilt", () => {
    this._needsBuildFlag = true;  // 每 tick 重复注册！
  });
  this.intel?.run(services);
}

// ✅ 正确：在 build() 中注册一次，跨 tick 持久
private build(services: RuntimeServices): void {
  // 重建前先清除旧处理器，避免双重注册
  this.eventBus.clear();
  this.eventBus.on("structureBuilt", () => {
    this._needsBuildFlag = true;
  });
  // ... 构造 Intel、Garrison 等
}
```

### 禁止 5：Build 失败后更新 _lastTick（D-17 Pitfall 4）

```typescript
// ❌ 禁止：Build 前或 Build 中更新 _lastTick（导致失败后下一 tick 执行 refresh 而非 build）
if (needsBuild) {
  (global as Record<string, unknown>)._lastTick = Game.time;  // 先更新！
  this.build(services);  // 如果这里抛出异常，_lastTick 已污染
}

// ✅ 正确：只有 Build 成功后才更新 _lastTick
if (needsBuild) {
  try {
    this.build(services);
    this._needsBuildFlag = false;
    (global as Record<string, unknown>)._lastTick = Game.time;  // 成功后才更新
  } catch (error) {
    Game.notify(`HighCommand build failed at tick ${Game.time}: ${String(error)}`);
    return;  // 直接返回，不执行 init/run
  }
}
```

---

## 9. 关联规范

- **KERN-02**：CPU 预算等级 `CpuBudgetLevel` 数据结构与 `computeBudgetLevel()` 详细定义
- **KERN-03**：Build/Refresh/Init/Run 四阶段生命周期的精确执行流程与边界条件（`lifecycle.ts` 完整扩展方案）
- **KERN-04**：Cache 反向索引 `rebuildCache()` 算法与 `ITaskForceRegistry` 接口完整定义
- **SPEC-03**：模块边界规则（HighCommand 依赖方向：只持有接口类型，不直接引用实现类）
- **SPEC-04**：接口契约规范（模式 2 共享接口 + 依赖反转、禁止模式 5 Run 阶段注册处理器）

---

*文档创建：2026-05-10 | Phase 09-内核层设计*
