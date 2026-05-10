# KERN-04: 全局 Cache 反向索引设计

**版本:** v2.0
**状态:** 生效
**决策来源:** D-12、D-13、D-14、D-15（09-CONTEXT.md）
**依赖:** KERN-01（HighCommand.cache 字段）、SPEC-03（依赖方向规则）、SPEC-04（接口契约模式 2）

---

## 1. 总体原则（D-12）

**每 tick Refresh 阶段完全重建，无状态，bug 范围 ≤ 1 tick（D-12）。**

Screeps 的 `Game.creeps` 是每 tick 都重新生成的对象——其中只包含当前存活的 Creep。Creep 的归属关系（属于哪个 TaskForce、隶属于哪个 Garrison）存储在 `Creep.memory` 中，是跨 tick 持久化的权威数据源。因此，Cache 索引的构建策略如下：

- **每 tick Refresh 阶段**调用 `rebuildCache()`，从 `Game.creeps` + `Creep.memory` 的组合中重建完整索引
- **不跨 tick 保留**上一 tick 的索引状态
- 任何索引不一致的 bug 范围都严格限制在 1 tick 之内

**O(n) 复杂度，n = 存活 Creep 数量（通常 100–300）：** 每 tick 线性扫描一次 `Game.creeps`，成本与 Creep 数量成正比，不受 TaskForce 数量或 Garrison 数量影响。对于 Screeps 典型规模（最多 300 Creep），单次重建预计 CPU 消耗 < 1 ms，远低于 20 ms 的每 tick 限制（详见第 7 节性能表格）。

**跨 tick 增量更新的替代方案引入脏状态风险——**Creep 死亡、TaskForce 解散、memory 被手动修改都会导致索引不一致，需要复杂的清理逻辑。完全重建消除了这类问题。

---

## 2. HighCommandCache 数据结构（D-13、D-14）

`HighCommandCache` 是 HighCommand 域私有的内部类型，**不通过 barrel 导出，不放入 `shared/interfaces/`**（D-14：只维护正向索引，无需对外暴露数据结构）。推荐定义在 `src/highCommand/types.ts`，避免 `HighCommand.ts` 文件过大：

```typescript
// src/highCommand/types.ts（HighCommand 域私有类型，不通过 barrel 导出）

/**
 * HighCommand 全局 Cache：每 tick Refresh 阶段完全重建的反向索引。
 * 正向查询：TF ref → creep 名称列表 / Garrison name → creep 名称列表。
 * 不维护 creep → TF 的反向映射（D-14）。
 */
export interface HighCommandCache {
  /** TaskForce ref → 该 TF 管辖的 creep 名称列表（D-13）*/
  creepsByTaskForce: Record<string, string[]>;
  /** Garrison name（房间名）→ 该 Garrison 管辖的 creep 名称列表（D-13）*/
  creepsByGarrison: Record<string, string[]>;
}

/**
 * 空 Cache 工厂函数：每次调用返回新对象，防止共享引用被意外 mutate。
 * 用于 Build 阶段初始化和 rebuildCache() 重置。
 */
export function createEmptyHighCommandCache(): HighCommandCache {
  return {
    creepsByTaskForce: {},
    creepsByGarrison: {}
  };
}
```

**数据结构选择说明（D-12 Open Question 3 解决）：** 使用 `Record<string, string[]>`（plain object）而非 `Map<string, string[]>`，原因：

| 维度 | `Record<string, string[]>` | `Map<string, string[]>` |
|------|---------------------------|------------------------|
| 键类型转换 | 无需转换（`for...in Game.creeps` 直接产生 string 键） | 无需转换（但无额外收益） |
| Screeps 内存模型 | 与 Memory 对象保持一致风格 | Map 实例跨 tick 重建无收益 |
| 序列化 | 直接 JSON 兼容 | 需要手动序列化 |
| 初始化空状态 | `= {}` 即可 | `= new Map()` |

结论：在每 tick 完全重建（D-12）的策略下，`Map` 相比 `Record` 无任何额外优势，采用 plain object。

**HighCommand.ts 中的字段声明（与 KERN-01 一致）：**

```typescript
// src/highCommand/HighCommand.ts（字段声明，来自 KERN-01 §3）
/** 全局 Cache 反向索引，每 tick Refresh 阶段重建（见 KERN-04）*/
private cache: HighCommandCache = { creepsByTaskForce: {}, creepsByGarrison: {} };
```

---

## 3. ITaskForceRegistry 接口（D-15）

`ITaskForceRegistry` 是跨域接口，放在 `src/shared/interfaces/ITaskForceRegistry.ts`，供 TaskForce（需注册）和 HighCommand（实现注册表）双方使用，不违反 SPEC-03 依赖方向规则：

```typescript
// src/shared/interfaces/ITaskForceRegistry.ts

import type { ITaskForce } from "./ITaskForce";  // 相对路径，避免 barrel 自引用循环依赖

/**
 * TaskForce 注册表接口：TaskForce 构造时通过此接口注册自身，不直接依赖 HighCommand。
 * 由 HighCommand 实现（`class HighCommand implements ITaskForceRegistry`）。
 * 构造时注入给 TaskForce（SPEC-03 D-06 依赖方向合规）。
 */
export interface ITaskForceRegistry {
  /**
   * 注册 TaskForce（Build 阶段，TaskForce 构造时调用）。
   * @param ref - TaskForce 的唯一标识符（如 "miningTF-E15N52"）
   * @param taskForce - TaskForce 实例，持有接口类型引用
   */
  register(ref: string, taskForce: ITaskForce): void;

  /**
   * 注销 TaskForce（对象树销毁前调用，通常在 build() 的 eventBus.clear() 后）。
   * @param ref - TaskForce 的唯一标识符
   */
  unregister(ref: string): void;
}
```

`src/shared/interfaces/index.ts` barrel 扩展后的结构（Phase 9 新增）：

```typescript
// src/shared/interfaces/index.ts（Phase 9 扩展后）

// Phase 9 新增接口
export type { ITaskForceRegistry } from "./ITaskForceRegistry";
export type { IIntelProvider } from "./IIntelProvider";
export type { ICpuBudgetConfig } from "./ICpuBudgetConfig";

// Phase 13+ 接口（Phase 9 占位：类型存在但无具体方法定义）
export type { ITaskForce } from "./ITaskForce";   // Phase 13 添加具体定义
// export type { IGarrison } from "./IGarrison";  // Phase 12 添加
```

**注意：** `ITaskForce` 接口在此处作为不透明类型引用被 `ITaskForceRegistry` 使用，其完整定义属于 Phase 13 TaskForce 详细设计的范围。Phase 9 只需要在类型系统中占位，无需定义具体方法。

---

## 4. rebuildCache() 重建算法（D-12、D-13）

以下为完整实现，可直接复制到 `src/highCommand/HighCommand.ts`：

```typescript
/**
 * 完全重建 Cache 索引：遍历 Game.creeps，按 memory.ref 和 memory.garrison 分组。
 * 每 tick Refresh 阶段调用一次，无状态，bug 范围 ≤ 1 tick（D-12）。
 */
private rebuildCache(): void {
  // 重置为空索引（完全重建，不复用上 tick 状态）
  this.cache = {
    creepsByTaskForce: {},
    creepsByGarrison: {}
  };

  // Game.creeps 是 Record<string, Creep>，必须用 for...in 遍历（非数组，不适用 prefer-for-of 规则）
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const ref = creep.memory.ref as string | undefined;
    const garrisonName = creep.memory.garrison as string | undefined;

    // 按 TaskForce ref 分组（D-13）
    if (ref !== undefined) {
      (this.cache.creepsByTaskForce[ref] ??= []).push(name);
    }

    // 按 Garrison name 分组（D-13）
    if (garrisonName !== undefined) {
      (this.cache.creepsByGarrison[garrisonName] ??= []).push(name);
    }
  }
}
```

**实现细节说明：**

- **`??=`（nullish coalescing assignment）**：如果 `this.cache.creepsByTaskForce[ref]` 为 `undefined`，则初始化为空数组 `[]`，然后立即 push 当前 creep 名称。ES2021 语法，SPEC-02 兼容。
- **`for...in` 而非 `for...of`**：`Game.creeps` 是 `Record<string, Creep>`（plain object），必须用 `for...in` 遍历键。ESLint `@typescript-eslint/prefer-for-of` 规则只适用于数组迭代，不适用于此场景。
- **死亡 Creep 自动排除**：`Game.creeps` 只包含当前 tick 存活的 Creep，死亡 Creep 不会出现在索引中。
- **孤儿 memory 处理**：若 Creep 的 `memory.ref` 指向一个已解散的 TaskForce，该 Creep 仍会被归入对应 ref 的分组（该分组中不会有对应的 TaskForce 对象）。孤儿 memory 清理属于 TaskForce 生命周期管理的职责，不由 `rebuildCache()` 处理。

**调用时机（参见 KERN-03）：** `rebuildCache()` 在 `HighCommand.refresh()` 的最后调用：

```typescript
/**
 * Refresh 阶段：最小刷新（刷新 id→对象引用）+ 重建 Cache 索引（D-19）。
 * 每 tick 非 build tick 执行，不检测结构变化（结构变化通过 EventBus 触发下一 tick build）。
 */
private refresh(services: RuntimeServices): void {
  // ... 刷新 id→对象引用（Garrison、Intel 各自内部刷新）...

  // Refresh 阶段最后：重建 Cache 索引（D-12）
  this.rebuildCache();
}
```

---

## 5. 正向查询接口（D-14）

以下两个 public 方法是 HighCommand 对外暴露的 Cache 查询 API。仅提供**正向查询**（D-14）：

```typescript
/**
 * 查询 TaskForce 管辖的所有 Creep 名称列表。
 * 正向查询（D-14）：TF ref → creep names。每 tick Refresh 后可用。
 * @param ref - TaskForce 的唯一标识符
 * @returns Creep 名称列表（无对应 TF 时返回空数组）
 */
public getCreepsByTaskForce(ref: string): readonly string[] {
  return this.cache.creepsByTaskForce[ref] ?? [];
}

/**
 * 查询 Garrison 管辖的所有 Creep 名称列表。
 * 正向查询（D-14）：Garrison name → creep names。每 tick Refresh 后可用。
 * @param garrisonName - Garrison 所在房间名
 * @returns Creep 名称列表（无对应 Garrison 时返回空数组）
 */
public getCreepsByGarrison(garrisonName: string): readonly string[] {
  return this.cache.creepsByGarrison[garrisonName] ?? [];
}
```

**返回值类型说明：** 两个方法均返回 `readonly string[]`（Creep 名称列表），不是 `Creep[]`。调用方用名称从 `Game.creeps[name]` 获取实际 Creep 对象。这避免了 Cache 中存储 Creep 对象引用（Creep 对象每 tick 重建，不应被长期持有）。`readonly` 修饰符防止调用方通过 `.push()` / `.splice()` 意外修改 HighCommand 内部 Cache 数组。

**为什么不提供反向查询（creep → TF）（D-14）：**

反向查询（已知 creep name，查询其所属 TaskForce）可以直接通过 `Game.creeps[name].memory.ref` 读取，这是 O(1) 的内存读取操作，无需额外缓存。维护反向索引（`creepsByName: Record<string, string>`）会引入额外的重建成本和一致性风险，不值得：

> 反向查询（creep → TF）通过 `Creep.memory.ref` 直接读取，无需缓存——这是 O(1) 的内存读取，不值得维护额外索引。维护反向索引会引入额外的重建成本和一致性风险。

---

## 6. 依赖反转注册表模式（D-15）

依赖反转是本设计中解决「TaskForce 需要注册但不能 import HighCommand」问题的核心机制，对 SPEC-03 依赖方向合规至关重要。

### 6.1 问题：TaskForce 需要注册，但不能 import HighCommand

```typescript
// ❌ 禁止：TaskForce 直接 import HighCommand（违反 SPEC-03 依赖方向）
import { HighCommand } from "highCommand";  // TaskForce → HighCommand 方向违反规则
```

SPEC-03 规定模块依赖只能从下层指向上层，TaskForce 属于 HighCommand 的子模块，不能反向引用父模块。

### 6.2 解决方案：依赖反转，TaskForce 接收接口

```typescript
// src/highCommand/intel/taskForces/MiningTF.ts（示意）
import type { ITaskForceRegistry } from "shared/interfaces";

/**
 * 采矿任务组：在 Build 阶段构造时通过 ITaskForceRegistry 注册自身。
 * 不持有 HighCommand 引用（SPEC-03 D-06 依赖方向合规）。
 */
export class MiningTF {
  /** TaskForce 唯一标识符，格式："{type}-{roomName}" */
  public readonly ref: string;

  /**
   * @param roomName - 采矿目标房间名
   * @param registry - TaskForce 注册表（由 HighCommand 在 Build 阶段注入）
   */
  public constructor(
    private readonly roomName: string,
    registry: ITaskForceRegistry
  ) {
    this.ref = `mining-${roomName}`;
    // 构造时立即注册（Build 阶段语义）
    registry.register(this.ref, this);
  }
}
```

### 6.3 HighCommand 作为注册表实现（与 KERN-01 一致）

```typescript
// src/highCommand/HighCommand.ts（实现 ITaskForceRegistry）

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
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete this.taskForces[ref];
}
```

### 6.4 HighCommand 在 Build 阶段注入注册表

```typescript
// src/highCommand/HighCommand.ts — build() 内部创建 TaskForce 时，将 this 作为 ITaskForceRegistry 注入
private build(services: RuntimeServices): void {
  // 重建前先清除旧处理器和旧注册表，避免双重注册
  this.eventBus.clear();
  this.taskForces = {};

  // TaskForce 构造时接收 this（ITaskForceRegistry），不是 HighCommand 类
  const miningTF = new MiningTF("E15N52", this);
  // MiningTF.constructor 调用 registry.register(ref, this)
  // this.taskForces["mining-E15N52"] = miningTF ← HighCommand 内部
}
```

**依赖关系图：**

```
ITaskForceRegistry（shared/interfaces）
        ↑ implements               ↑ uses (import type)
HighCommand（highCommand/）      MiningTF（highCommand/intel/taskForces/）
        |── build() ──────────────→ new MiningTF("E15N52", this)
                                         └─ registry.register(ref, this)
```

通过这个模式，MiningTF 只知道 `ITaskForceRegistry` 接口的存在，完全不知道 `HighCommand` 类。

---

## 7. 性能说明

### 时间复杂度

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| `rebuildCache()` | O(n) | n = 存活 Creep 数量，与 TF/Garrison 数量无关 |
| `getCreepsByTaskForce()` | O(1) | hash lookup（plain object 属性访问） |
| `getCreepsByGarrison()` | O(1) | hash lookup（plain object 属性访问） |

### 空间复杂度

| 数据 | 占用 | 说明 |
|------|------|------|
| `creepsByTaskForce` | O(n) | n 条 string 引用，每 Creep name 存储一次 |
| `creepsByGarrison` | O(n) | n 条 string 引用，每 Creep name 存储一次 |
| 总计 | O(2n) ≈ O(n) | 不复制 Creep 对象，只存储名称字符串引用 |

### 性能接受度评估

| 场景 | Creep 数 | rebuildCache() 预估 CPU | 可接受 |
|------|---------|------------------------|--------|
| 小型基地（RCL 3-5） | 20–50 | < 0.1 ms | ✅ |
| 中型基地（RCL 6-7） | 50–150 | < 0.3 ms | ✅ |
| 全盛基地（RCL 8 + outpost）| 150–300 | < 0.8 ms | ✅ |
| 极限（多 Garrison 300+） | 300+ | < 2 ms | ✅（可接受，远低于 20 ms limit）|

**结论：** O(n) 完全重建对于 Screeps 典型规模是可接受的。唯一的性能敏感点是 `for...in Game.creeps` 的迭代本身，这是 Screeps 环境中的标准操作，无法进一步优化（Game.creeps 是平台提供的对象）。

---

## 8. 禁止模式

### 禁止 1：Cache 跨 tick 复用（违反 D-12）

```typescript
// ❌ 禁止：保留上 tick 的 Cache，只做增量更新
private rebuildCache(): void {
  // 不重置 this.cache，尝试复用上 tick 状态
  for (const name in Game.creeps) {
    // ... 问题：死亡 Creep 仍在旧 cache 中，导致脏数据
  }
}

// ✅ 正确：每 tick 完全重建（D-12）
private rebuildCache(): void {
  this.cache = { creepsByTaskForce: {}, creepsByGarrison: {} };  // 先重置
  for (const name in Game.creeps) {
    // ... 从权威数据源（memory）重建
  }
}
```

### 禁止 2：维护反向索引（违反 D-14）

```typescript
// ❌ 禁止：添加 creep → TF 的反向索引
interface HighCommandCache {
  creepsByTaskForce: Record<string, string[]>;
  creepsByGarrison: Record<string, string[]>;
  creepsByName: Record<string, string>;  // ❌ creep name → TF ref（不必要，D-14）
}

// ✅ 正确：反向查询通过 Creep.memory.ref 直接读取（O(1)，无需缓存）
function getTFForCreep(creepName: string): string | undefined {
  return Game.creeps[creepName]?.memory.ref as string | undefined;  // 直接读 memory
}
```

### 禁止 3：TaskForce 直接 import HighCommand（违反 SPEC-03）

```typescript
// ❌ 禁止：TaskForce 直接引用 HighCommand 实现类
// src/highCommand/intel/taskForces/MiningTF.ts
import { HighCommand } from "highCommand";  // TaskForce → HighCommand 方向违规

export class MiningTF {
  public constructor(private readonly hc: HighCommand) {
    hc.register(this.ref, this);  // ❌ 知道了 HighCommand 的存在
  }
}

// ✅ 正确：通过接口注入（依赖反转，D-15）
import type { ITaskForceRegistry } from "shared/interfaces";

export class MiningTF {
  public constructor(
    private readonly roomName: string,
    registry: ITaskForceRegistry  // ✅ 只知道接口，不知道 HighCommand
  ) {
    registry.register(this.ref, this);
  }
}
```

### 禁止 4：在 barrel 导出 HighCommandCache（违反 SPEC-04 最小化 API 面）

```typescript
// ❌ 禁止：将域私有类型从 barrel 导出
// src/highCommand/index.ts
export type { HighCommandCache } from "./types";  // ❌ 暴露内部实现细节

// ✅ 正确：HighCommandCache 只在 highCommand 域内使用（域私有，不导出）
// src/highCommand/types.ts — 不在 index.ts 中 re-export
// src/highCommand/index.ts — 只导出 HighCommand 类
export { HighCommand } from "./HighCommand";
```

### 禁止 5：查询方法返回可变 string[]（MEDIUM-3）

```typescript
// ❌ 禁止：返回可变数组允许调用方 mutate 内部 Cache
public getCreepsByTaskForce(ref: string): string[] {
  return this.cache.creepsByTaskForce[ref] ?? [];
}
// 调用方可以 .push() / .splice() 污染 HighCommand 内部状态

// ✅ 正确：readonly string[] 由 TypeScript 编译期强制不可变
public getCreepsByTaskForce(ref: string): readonly string[] {
  return this.cache.creepsByTaskForce[ref] ?? [];
}
// 调用方如需修改，必须显式复制：[...highCommand.getCreepsByTaskForce(ref)]
```

### 禁止 6：共享 EMPTY_CACHE 对象引用（LOW-1）

```typescript
// ❌ 禁止：共享引用可被意外 mutate
export const EMPTY_CACHE: HighCommandCache = { creepsByTaskForce: {}, creepsByGarrison: {} } as const;
// this.cache = EMPTY_CACHE → 若后续 this.cache.creepsByTaskForce["ref"] = [...] 会污染全局

// ✅ 正确：工厂函数每次返回新对象实例
export function createEmptyHighCommandCache(): HighCommandCache {
  return { creepsByTaskForce: {}, creepsByGarrison: {} };
}
// this.cache = createEmptyHighCommandCache() → 安全，互不影响
```

---

## 9. 关联规范

| 文档 | 关联内容 |
|------|---------|
| **KERN-01** | HighCommand 实现 `ITaskForceRegistry`；`cache` 字段定义（`private cache: HighCommandCache`）；`getCreepsByTaskForce`/`getCreepsByGarrison` 方法签名；`register`/`unregister` 方法实现 |
| **KERN-03** | `rebuildCache()` 在 Refresh 阶段的调用时机（`refresh()` 方法末尾调用）；Build 阶段 `taskForces` 字段重置 |
| **SPEC-03** | 模块边界规则：TaskForce 依赖方向——只能通过 `ITaskForceRegistry` 接口与 HighCommand 交互，不能直接 import `HighCommand` 类 |
| **SPEC-04** | 接口契约模式 2（共享接口 + 依赖反转）：`ITaskForceRegistry` 的设计遵循此模式；接口 JSDoc 格式（中文，I 前缀） |

---

*文档创建：2026-05-10 | Phase 09-内核层设计*
