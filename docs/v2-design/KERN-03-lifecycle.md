# KERN-03: Build/Refresh/Init/Run 四阶段生命周期

> **状态：** v2.0 权威文档 | **日期：** 2026-05-10
> **关联决策：** D-16、D-17、D-18、D-19（09-CONTEXT.md）
> **依赖：** KERN-01（HighCommand 单例字段结构）、SPEC-04（EventBus 通信模式 4）

---

## 1. 总体原则（D-18）

**对象引用即状态。**

Build 阶段构造对象树（Intel、Garrison、Facility），Refresh 阶段更新对象引用，Init/Run 阶段通过对象引用访问数据。不需要中间结果传递机制——对象本身就是状态的载体。

### 系统架构总图

```
Screeps loop (main.ts)
        |
        v
   Kernel.run()
   [refreshServices] --> RuntimeServices (logger, profiler)
   [detectEnvironmentBootstrap] --> RuntimeEnvironmentMetadata
   [highCommandTick]
        |
        v
   HighCommand.tick(services)
        |
    (global._lastTick !== Game.time - 1 || _needsBuildFlag ?)
       YES                          NO
        |                            |
        v                            v
  HighCommand.build()      HighCommand.refresh()
  构造 Intel/Garrison/       刷新 id→对象引用
  Cache/EventBus 处理器       重建 Cache 索引
        \                          /
         \                        /
          v                      v
      HighCommand.init()
      → intel?.init(services)
        → 按优先级排序 TaskForce
        → TaskForce.init() (声明 spawn wishlist)
          → Barracks.enqueue(SpawnRequest)
      → garrison[].init(services)
        → Facility[].init() (声明资源请求)
          |
          v
      HighCommand.run()
      → intel?.run(services)
        → TaskForce.run() (Creep 行为)
      → garrison[].run(services)
        → Facility[].run()
          → Barracks.handleSpawns()
            → spawn.spawnCreep(...)

  CPU Bucket Level:
  surplus/normal → 完整执行
  low → 截断低优先级 TaskForce
  critical → 最小集（refresh + spawn 基础设施）
  (熔断保护：确保 Creep 不断代)
```

**Global 对象树生命周期：** Build 时创建，Refresh 时更新引用，下次 Build 时整体替换。没有部分重建逻辑。每次 Build 都是完整的对象树重建，没有增量更新。

---

## 2. lifecycle.ts 扩展（KERN-03）

### 2.1 扩展前（当前 v2.0 骨架）

```typescript
// src/runtime/lifecycle.ts — 当前骨架
export type LifecycleStageName =
  | "refreshServices"
  | "detectEnvironmentBootstrap";

export const KERNEL_LIFECYCLE_STAGES: LifecycleStage[] = [
  { name: "refreshServices", run(context) { ... } },
  { name: "detectEnvironmentBootstrap", run: runEnvironmentBootstrapStage }
];
```

### 2.2 扩展后（Phase 9 扩展）

```typescript
// src/runtime/lifecycle.ts — Phase 9 扩展后
import type { HighCommand } from "highCommand";  // 注意：lifecycle.ts 需要 import HighCommand

export type LifecycleStageName =
  | "refreshServices"
  | "detectEnvironmentBootstrap"
  | "highCommandTick";   // Phase 9 新增（KERN-03）

// 重构为工厂函数：lifecycle.ts 接收 highCommand 实例参数
// 原因：KERNEL_LIFECYCLE_STAGES 是静态数组，无法捕获 Kernel 实例字段
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
        // Kernel 已确保前序阶段成功（refreshServices + detectEnvironmentBootstrap）
        // requireServices() 在此处安全可用
        highCommand.tick(context.requireServices());
      }
    }
  ];
}

// 保持向后兼容的 KERNEL_STAGE_ORDER（从 LifecycleStageName 类型派生，无需改动）
```

**重要说明：** 此次重构将导出从 `KERNEL_LIFECYCLE_STAGES`（数组常量）改为 `createLifecycleStages()`（工厂函数）。Kernel.ts 必须更新调用方式，传入 `this.highCommand`。`KERNEL_STAGE_ORDER` 的派生方式不变（从类型推导）。

### 2.3 Kernel.ts 对应修改

```typescript
// src/runtime/Kernel.ts — 修改后的 createLifecycleStages 调用
private createLifecycleStages(): LifecycleStage[] {
  // 修改前：return KERNEL_LIFECYCLE_STAGES.map(...)
  // 修改后：调用工厂函数，传入 this.highCommand
  return createLifecycleStages(this.highCommand).map(stage => ({
    name: stage.name,
    run: this.stages[stage.name] || stage.run
  }));
}
```

---

## 3. Build 阶段（D-16）

### 3.1 触发条件（D-16）

Build 阶段由以下三种情况触发（满足任一条件）：

1. **Global reset：** `(global as Record<string, unknown>)._lastTick !== Game.time - 1`（含首次运行，此时 `_lastTick` 为 `undefined`，`undefined !== Game.time - 1` 为 `true`，正确触发 build）
2. **手动命令：** Console 调用 `highCommand.forceBuild()` 设置 `_needsBuildFlag = true`
3. **事件驱动：** Run 阶段 emit `HighCommandEvents.StructureBuilt` 或 `HighCommandEvents.RoomClaimed` → Build 阶段注册的处理器设置 `_needsBuildFlag = true` → 下一 tick 触发 build

### 3.2 Build 执行内容（有序步骤）

Build 阶段按以下顺序执行全部 8 步，任一步骤失败则整体视为失败：

1. `this.eventBus.clear()` — 清除上次 Build 的所有 EventBus 处理器（防止处理器重复注册）
2. 构造 Intel 实例（`new Intel(this.eventBus)`）并赋值 `this.intel`
3. 遍历 Memory.rooms（owned rooms），构造 Garrison 实例，填充 `this.garrisons`
4. 构造每个 Garrison 内的 Facility 树（Barracks、HQ、Watchtower 等）
5. 构造所有 TaskForce 实例（注入 `ITaskForceRegistry = this`）
6. 注册结构变化 EventBus 处理器（`this.eventBus.on(HighCommandEvents.StructureBuilt, ...)`）
7. 调用 `this.rebuildCache()`（完整 Cache 重建）
8. 只有全部完成后才更新：`this._needsBuildFlag = false` 和 `(global as Record<string, unknown>)._lastTick = Game.time`（由 `tick()` 在 `build()` 调用成功后执行，不在 `build()` 内部）

### 3.3 异常恢复（D-17）

```typescript
// 在 HighCommand.tick() 中调用 build()，try/catch 包裹在 tick() 层
public tick(services: RuntimeServices): void {
  const isGlobalReset = (global as Record<string, unknown>)._lastTick !== Game.time - 1;
  const needsBuild = isGlobalReset || this._needsBuildFlag;

  if (needsBuild) {
    try {
      this.build(services);
      // ✅ 成功：更新标志（在 tick() 中，不在 build() 内部）
      this._needsBuildFlag = false;
      (global as Record<string, unknown>)._lastTick = Game.time;
    } catch (error) {
      // ❌ Build 失败：不更新 _lastTick / _needsBuildFlag
      Game.notify(`HighCommand.build() 失败 at tick ${Game.time}: ${String(error)}`);
      return; // 直接返回，不执行 init/run，避免 null 引用级联崩溃
    }
  } else {
    this.refresh(services);
    (global as Record<string, unknown>)._lastTick = Game.time;
  }

  // ... 继续执行 init/run
}

private build(services: RuntimeServices): void {
  // 重建对象树（全部在 build() 内，由 tick() 的 try 块捕获异常）
  this.eventBus.clear();           // 清除上次处理器，避免重复注册
  this.intel = new Intel(this.eventBus);
  // ... 构造 Garrison 树 ...
  this.rebuildCache();
  // 注意：_lastTick / _needsBuildFlag 不在 build() 内更新，由 tick() 负责
}
```

**重要约束：Build 阶段**

- `global._lastTick` 只在 `build()` 成功后更新（由 `tick()` 在 catch 之外执行）
- `_needsBuildFlag` 在 `build()` 失败时保持 `true`（下一 tick 重试 build）
- `eventBus.clear()` 必须是 `build()` 的第一步（防止处理器重复注册）
- Build 失败通过 `Game.notify()` 发送邮件通知（D-17）

---

## 4. Refresh 阶段（D-19）

Refresh 阶段保持最小职责：只刷新 id→Game 对象引用 + 重建 Cache 索引。**不检测结构变化。**

```typescript
private refresh(services: RuntimeServices): void {
  // 1. 刷新 id → Game 对象引用（O(结构数量) 的 getObjectById 调用）
  for (const garrison of Object.values(this.garrisons)) {
    garrison.refresh();   // 每个 Garrison 刷新其 Facility 引用
  }
  if (this.intel !== null) {
    this.intel.refresh(); // Intel 刷新其内部引用（Phase 11 详细设计）
  }

  // 2. 完整重建 Cache 索引（D-12）
  this.rebuildCache();

  // 3. 检测 _needsBuildFlag（由 Run 阶段事件设置）
  // 注意：needsBuild 检测在 tick() 入口，不在 refresh() 内部
  // refresh() 只做刷新，不做决策
}
```

**重要约束：Refresh 阶段（D-19）**

- Refresh 不检测结构变化（新 Storage、新 claim 房间）
- 结构变化通过 Run 阶段 emit 事件 → 设置 `_needsBuildFlag` → 下一 tick build
- Refresh 不调用 `Game.notify()`（只有 build 失败才发通知）

---

## 5. Init 阶段

Init 阶段按以下顺序执行声明（单模块 try/catch 隔离）：

1. `this.intel?.init(services)` → Intel 排序 TaskForce 优先级，收集 spawn wishlist
2. `for (const garrison of Object.values(this.garrisons)) { garrison.init(services); }` → 每个 Garrison 调用 Facility.init()

Init 阶段只产生声明（spawn 请求入队 Barracks，资源请求声明），**不产生任何 Game 副作用**。`Barracks.handleSpawns()` 在 Run 阶段执行，不在 Init 阶段。

```typescript
private init(services: RuntimeServices): void {
  // Intel init（隔离）
  try {
    this.intel?.init(services);
  } catch (error) {
    Game.notify(`Intel.init() 失败 at tick ${Game.time}: ${String(error)}`);
  }

  // Garrison init（各自隔离）
  for (const [roomName, garrison] of Object.entries(this.garrisons)) {
    try {
      garrison.init(services);
    } catch (error) {
      Game.notify(`Garrison[${roomName}].init() 失败 at tick ${Game.time}: ${String(error)}`);
    }
  }
}
```

**重要约束：Init 阶段**

- Init 阶段不产生任何 Game 副作用（不 spawn、不移动 Creep、不转移资源）
- Init 阶段不调用 `eventBus.emit()`（事件分发在 Run 阶段）
- Init 阶段异常：单模块 try/catch 隔离，不影响其他模块（D-17）

---

## 6. Run 阶段

Run 阶段按以下顺序执行 Game 变更（单模块 try/catch 隔离）：

1. `this.intel?.run(services)` → Intel 执行 TaskForce.run()（Creep 行为：moveTo、harvest 等）
2. `for (const garrison of Object.values(this.garrisons)) { garrison.run(services); }` → 每个 Garrison 执行 Facility.run()
   - 包含 `Barracks.handleSpawns()` — 按优先级执行 spawn 请求
   - 包含 `HQ.run()` — 执行资源调配
   - 等等

Run 阶段是 Game 变更发生的阶段（`creep.moveTo`、`spawn.spawnCreep`、`structure.transfer` 等）以及 EventBus emit 调用发生的阶段。

```typescript
private run(services: RuntimeServices): void {
  // Intel run（隔离）
  try {
    this.intel?.run(services);
  } catch (error) {
    Game.notify(`Intel.run() 失败 at tick ${Game.time}: ${String(error)}`);
  }

  // Garrison run（各自隔离）
  for (const [roomName, garrison] of Object.entries(this.garrisons)) {
    try {
      garrison.run(services);
    } catch (error) {
      Game.notify(`Garrison[${roomName}].run() 失败 at tick ${Game.time}: ${String(error)}`);
    }
  }
}
```

**重要约束：Run 阶段**

- Run 阶段不调用 `eventBus.on()`（处理器注册在 Build 阶段）
- Run 阶段可以调用 `eventBus.emit()`（分发事件给 Build 阶段注册的处理器）
- Run 阶段异常：单模块 try/catch 隔离，不影响其他模块（D-17）

---

## 7. 异常恢复策略（D-17）

两级恢复策略：Build 级别（整体失败重试）vs Init/Run 级别（单模块隔离继续）。

| 失败场景 | 恢复策略 | 下一 tick 行为 |
|---------|---------|----------------|
| Build 失败（异常抛出） | `_needsBuildFlag` 保持 `true`，`global._lastTick` 不更新，`Game.notify()` | 下一 tick 重新执行 build |
| Init/Run 单模块失败 | 单模块 try/catch 隔离，其他模块继续执行，`Game.notify()` | 下一 tick 正常 refresh + init/run（失败模块继续尝试）|
| Init/Run 多模块连续失败 | 同上（各自隔离），不触发 build | 同上 |

**Build 级别异常（整体失败）：**

```typescript
// 在 tick() 中：build 失败 → 立即返回，不执行 init/run
if (needsBuild) {
  try {
    this.build(services);
    this._needsBuildFlag = false;
    (global as Record<string, unknown>)._lastTick = Game.time;
  } catch (error) {
    Game.notify(`HighCommand.build() 失败 at tick ${Game.time}: ${String(error)}`);
    return; // ← 关键：不执行 init/run，避免访问未初始化的对象引用
  }
}
```

**Init/Run 级别异常（单模块隔离）：**

```typescript
private init(services: RuntimeServices): void {
  // Intel init（隔离）
  try {
    this.intel?.init(services);
  } catch (error) {
    Game.notify(`Intel.init() 失败 at tick ${Game.time}: ${String(error)}`);
  }

  // Garrison init（各自隔离）
  for (const [roomName, garrison] of Object.entries(this.garrisons)) {
    try {
      garrison.init(services);
    } catch (error) {
      Game.notify(`Garrison[${roomName}].init() 失败 at tick ${Game.time}: ${String(error)}`);
    }
  }
}
```

---

## 8. 事件驱动 Build 通知（D-16）

### 8.1 HighCommandEvents 常量（`as const` pattern，SPEC-02 D-13）

```typescript
// src/shared/events/HighCommandEvents.ts（或 src/shared/constants/events.ts）

/**
 * HighCommand 事件名称常量：定义触发下一 tick build 的结构变化事件。
 * 使用 as const 对象（SPEC-02 D-13），禁止散落的字符串字面量。
 */
export const HighCommandEvents = {
  /** 新 Storage 或 Terminal 建造完成，触发 Garrison 对象树重建 */
  StructureBuilt: "highCommand.structureBuilt",
  /** 新房间被 claim，触发新 Garrison 创建 */
  RoomClaimed: "highCommand.roomClaimed",
  /** 房间失去控制权，触发 Garrison 销毁 */
  RoomLost: "highCommand.roomLost"
} as const;

/**
 * 从常量对象派生联合类型。
 */
export type HighCommandEvent = typeof HighCommandEvents[keyof typeof HighCommandEvents];
```

### 8.2 处理器注册（Build 阶段）

```typescript
// 在 HighCommand.build() 中注册处理器（每次 build 前 eventBus.clear() 已清除旧处理器）
private build(services: RuntimeServices): void {
  this.eventBus.clear(); // ← 清除上次处理器

  // 注册结构变化事件处理器（设置 _needsBuildFlag，下一 tick 触发 build）
  this.eventBus.on(HighCommandEvents.StructureBuilt, () => {
    this._needsBuildFlag = true; // 下一 tick 触发 build
  });
  this.eventBus.on(HighCommandEvents.RoomClaimed, () => {
    this._needsBuildFlag = true;
  });
  this.eventBus.on(HighCommandEvents.RoomLost, () => {
    this._needsBuildFlag = true;
  });

  // ... 构造对象树（Intel、Garrison 树、TaskForce 等）...
}
```

### 8.3 事件发出（Run 阶段）

处理器在 Build 阶段注册，事件在 Run 阶段发出（见 SPEC-04 通信模式 4）：

```typescript
// 在 HQ.run() 内（检测到 Storage 建造完成时）：
if (this.room.storage !== null && this._lastKnownStorageId === null) {
  this.eventBus.emit(HighCommandEvents.StructureBuilt, { roomName: this.room.name });
}
```

事件发出后，`_needsBuildFlag` 被设为 `true`。当前 tick 的 init/run 继续使用本次 Build 的对象树。**下一 tick** 进入 `tick()` 时，`_needsBuildFlag = true` 触发完整 Build，重建对象树。

---

## 9. 禁止模式

### 禁止 1：Kernel 参与 build/refresh 决策（D-02/D-06）

```typescript
// ❌ 禁止：Kernel 读取 global._lastTick 做 build/refresh 决策
class Kernel {
  public run(): KernelRunResult {
    const isReset = (global as any)._lastTick !== Game.time - 1; // ❌
    if (isReset) { this.highCommand.build(services); }
    else { this.highCommand.refresh(services); }
  }
}

// ✅ 正确：Kernel 只调用 highCommand.tick()，HighCommand 自治决策（D-06）
class Kernel {
  public run(): KernelRunResult {
    // Kernel 不参与 build/refresh 决策
    highCommand.tick(context.requireServices()); // ← tick() 内部自治
  }
}
```

### 禁止 2：Run 阶段注册 EventBus 处理器（SPEC-04 禁止模式 5）

```typescript
// ❌ 禁止：在 run() 中注册处理器（每 tick 重复注册，处理器越积越多）
private run(services: RuntimeServices): void {
  this.eventBus.on(HighCommandEvents.StructureBuilt, () => { // ❌ 每 tick 注册一次！
    this._needsBuildFlag = true;
  });
  this.intel?.run(services);
}

// ✅ 正确：在 build() 中注册一次，eventBus.clear() 先清除旧处理器
private build(services: RuntimeServices): void {
  this.eventBus.clear(); // 先清除
  this.eventBus.on(HighCommandEvents.StructureBuilt, () => { // ✅ build 阶段注册
    this._needsBuildFlag = true;
  });
}
```

### 禁止 3：Build 失败后更新 `global._lastTick`（D-17 Pitfall 4）

```typescript
// ❌ 禁止：在 build() 调用前（或内部）更新 _lastTick
if (needsBuild) {
  (global as Record<string, unknown>)._lastTick = Game.time;  // ❌ 先更新！
  this.build(services);  // 如果这里抛出异常，_lastTick 已污染 → 下一 tick 执行 refresh 而非 build
}

// ✅ 正确：只有 build() 成功后才更新 _lastTick
if (needsBuild) {
  try {
    this.build(services);
    this._needsBuildFlag = false;
    (global as Record<string, unknown>)._lastTick = Game.time;  // ✅ 成功后才更新
  } catch (error) {
    Game.notify(`HighCommand.build() 失败 at tick ${Game.time}: ${String(error)}`);
    return;
  }
}
```

### 禁止 4：Refresh 检测结构变化（D-19）

```typescript
// ❌ 禁止：在 refresh() 中检测结构变化并触发 build
private refresh(services: RuntimeServices): void {
  for (const garrison of Object.values(this.garrisons)) {
    garrison.refresh();
    if (garrison.hasNewStorage()) {  // ❌ 结构变化检测不属于 refresh 职责
      this._needsBuildFlag = true;
    }
  }
}

// ✅ 正确：结构变化检测在 Run 阶段通过 emit 事件通知
// HQ.run() 中：
if (this.room.storage !== null && this._lastKnownStorageId === null) {
  this.eventBus.emit(HighCommandEvents.StructureBuilt, { roomName: this.room.name }); // ✅
}
// refresh() 只做刷新，不做决策
```

### 禁止 5：Init 阶段产生 Game 副作用

```typescript
// ❌ 禁止：在 init() 中直接操作 Creep 或 spawn
private init(services: RuntimeServices): void {
  for (const creep of Object.values(Game.creeps)) {
    creep.moveTo(new RoomPosition(25, 25, creep.room.name)); // ❌ init 阶段不产生 Game 副作用
  }
  spawn.spawnCreep([], "newCreep"); // ❌
}

// ✅ 正确：init() 只声明意图（入队请求），run() 执行实际操作
private init(services: RuntimeServices): void {
  this.intel?.init(services); // Intel 声明 TaskForce 优先级 + spawn wishlist
  for (const garrison of Object.values(this.garrisons)) {
    garrison.init(services); // Garrison 声明资源请求
  }
  // 没有任何直接的 Game 对象修改
}
```

---

## 10. 关联规范

| 规范 | 关联内容 |
|------|---------|
| KERN-01 | HighCommand 单例字段结构，`tick()` 完整方法定义，`_needsBuildFlag` 字段 |
| KERN-02 | `computeBudgetLevel()` 与 `CpuBudgetLevel`（Init/Run 的 CPU 熔断保护条件） |
| KERN-04 | `rebuildCache()` 算法（Build 阶段步骤 7，Refresh 阶段步骤 2 调用） |
| SPEC-04 | EventBus 通信模式 4（Build 注册/Run 分发规则），禁止模式 5（Run 阶段注册处理器） |
| SPEC-03 | 依赖方向（`lifecycle.ts` 可以 `import type { HighCommand }` 因为 Kernel 层持有实例，符合依赖方向规则） |

---

*文档创建：2026-05-10 | Phase 09-内核层设计*
