# KERN-02: Kernel 调度器与 CPU 预算基础设施

> **状态：** v2.0 权威文档 | **日期：** 2026-05-10
> **关联决策：** D-07、D-08、D-09、D-10、D-11（09-CONTEXT.md）
> **阶段范围：** Phase 9 只定义数据结构与接口；截断执行和看门狗实现在 Phase 11

---

## 1. 总体原则（D-07、D-11）

### 1.1 截断式 CPU 管理模型（D-07）

**核心设计：按优先级顺序执行 TaskForce，接近 CPU 上限时截断低优先级 TaskForce。**

本系统采用截断式（truncation）CPU 管理模型，而非预分配式（pre-allocated budget）模型：

- **截断式（本系统）：** 按优先级从高到低依次执行 TaskForce，当 `Game.cpu.getUsed()` 接近本 tick 上限时，跳过后续低优先级 TaskForce。高优先级 TaskForce 始终能够运行，低优先级 TaskForce 在资源紧张时让步。
- **预分配式（不采用）：** 为每个子系统预先分配固定 CPU 配额。此方案因需要协商分配逻辑而复杂度高，且当某子系统未用满配额时会浪费资源。

### 1.2 Phase 9 范围边界（D-11）

**Phase 9 只定义以下三项内容：**

1. `CpuBudgetLevel` 数据结构（`src/shared/constants/cpu.ts`）
2. `ICpuBudgetConfig` 阈值接口（`src/shared/interfaces/ICpuBudgetConfig.ts`）
3. `computeBudgetLevel()` 方法签名与行为契约

**以下内容不在 Phase 9 范围内，留给 Phase 11 Intel 调度器实现（D-11）：**

- TaskForce 截断 for 循环（按优先级遍历，超限时 break）
- 看门狗 suspend/resume 逻辑（连续超限计数）
- `runMinimalSet()` 方法实现体

---

## 2. CpuBudgetLevel 预算等级（D-08）

Screeps bucket 范围为 0–10000。定义四个离散水位等级，每个等级对应不同的可执行服务范围。

以下为完整的 `src/shared/constants/cpu.ts` 文件，可直接复制：

```typescript
// src/shared/constants/cpu.ts
import type { ICpuBudgetConfig } from "shared/interfaces";

/**
 * CPU Bucket 水位等级常量。Screeps bucket 范围 0–10000。
 * 等级决定本 tick 可执行的服务范围；截断策略在 Phase 11 Intel 调度器中实现（D-11）。
 */
export const CpuBudgetLevel = {
  /** Bucket < 500：极低水位，只执行最小集（refresh + spawn 基础设施）（D-10）*/
  Critical: "critical",
  /** Bucket < 2500：偏低水位，截断低优先级 TaskForce（D-07）*/
  Low: "low",
  /** Bucket 2500–8000：正常水位，完整执行所有 TaskForce */
  Normal: "normal",
  /** Bucket > 8000：充足水位，可执行可选的性能密集任务 */
  Surplus: "surplus"
} as const;

/**
 * 从常量对象派生联合类型（SPEC-02 D-13 规范）。
 */
export type CpuBudgetLevel = typeof CpuBudgetLevel[keyof typeof CpuBudgetLevel];

/**
 * 默认 CPU 预算阈值配置（基于 Screeps bucket 上限 10000）。
 * Phase 11 可通过注入自定义 ICpuBudgetConfig 覆盖此配置。
 */
export const DEFAULT_CPU_BUDGET_CONFIG: ICpuBudgetConfig = {
  criticalThreshold: 500,
  lowThreshold: 2500,
  surplusThreshold: 8000
} as const;
```

**设计说明（SPEC-02 D-13）：**

- 使用 `as const` 对象而非 TypeScript `enum`，保持字符串字面量的可读性和序列化透明度
- 派生联合类型 `typeof CpuBudgetLevel[keyof typeof CpuBudgetLevel]` 与常量对象同名（TypeScript 声明合并），让使用者同时享受类型安全和值引用
- 常量字符串值全部小写（`"critical"`、`"low"` 等），与 Screeps 内存序列化兼容

---

## 3. ICpuBudgetConfig 阈值接口（D-08）

### 3.1 接口定义

以下为完整的 `src/shared/interfaces/ICpuBudgetConfig.ts` 文件：

```typescript
// src/shared/interfaces/ICpuBudgetConfig.ts

/**
 * CPU 预算阈值配置接口。
 * 运行时通过此接口读取各水位临界值，具体数值在 HighCommand 构造时初始化。
 * Phase 11 可注入自定义实现覆盖默认阈值（DEFAULT_CPU_BUDGET_CONFIG）。
 */
export interface ICpuBudgetConfig {
  /** Bucket 低于此值时进入 Critical 模式（推荐值：500）*/
  readonly criticalThreshold: number;
  /** Bucket 低于此值时进入 Low 模式（推荐值：2500）*/
  readonly lowThreshold: number;
  /** Bucket 高于此值时进入 Surplus 模式（推荐值：8000）*/
  readonly surplusThreshold: number;
}
```

**字段设计约束：**

- 所有字段为 `readonly`，阈值配置一旦构造不得在运行时修改（保持稳定性）
- 阈值均为 `number` 类型（非枚举），便于运行时动态配置注入（Phase 11 可扩展）

### 3.2 推荐阈值数值说明

| 字段 | 推荐值 | 含义 |
|------|--------|------|
| `criticalThreshold` | `500` | Bucket 不足 5%（<500/10000）——creep 严重短缺风险，仅执行最小集 |
| `lowThreshold` | `2500` | Bucket 不足 25%（<2500/10000）——进入截断模式，跳过低优先级 TF |
| `surplusThreshold` | `8000` | Bucket 超过 80%（>8000/10000）——资源充裕，可执行可选密集任务 |

### 3.3 shared/interfaces barrel 扩展

`src/shared/interfaces/index.ts` 需增加对 `ICpuBudgetConfig` 的导出（仅 `export type`）：

```typescript
// src/shared/interfaces/index.ts（追加）
export type { ICpuBudgetConfig } from "./ICpuBudgetConfig";
```

---

## 4. computeBudgetLevel() 方法签名（D-08）

### 4.1 方法签名与行为契约

以下签名来自 `HighCommand.ts`（见 KERN-01 § 方法签名摘要）。Phase 9 只建立方法契约，不提供实现体。

```typescript
/**
 * 计算本 tick 的 CPU 预算等级，基于当前 bucket 水位。
 * 只读取 Game.cpu.bucket，不产生副作用。
 * @param services - 本 tick 运行时服务（用于 logger 记录异常水位）
 * @returns 本 tick 适用的 CpuBudgetLevel
 */
private computeBudgetLevel(services: RuntimeServices): CpuBudgetLevel {
  // 实现：对照 ICpuBudgetConfig 阈值比较 Game.cpu.bucket
  // 返回 CpuBudgetLevel.Critical / Low / Normal / Surplus
  // 注意：bucket 是 Game.cpu.bucket（0-10000），不是 Game.cpu.getUsed()
  throw new Error("computeBudgetLevel implementation in Phase 11");
}
```

**行为契约说明：**

- 输入：`Game.cpu.bucket`（当前 bucket 水位，范围 0–10000）
- 输出：`CpuBudgetLevel`（四个离散等级之一）
- 副作用：无——只读取 `Game.cpu.bucket`，不修改任何状态
- 参数 `services` 仅用于记录异常水位日志（如 bucket 意外归零时通过 `services.logger` 发出警告）

### 4.2 预期实现逻辑（Phase 11 参考）

Phase 11 实现时，应对照 `ICpuBudgetConfig` 阈值进行顺序比较：

```
if bucket < criticalThreshold  → CpuBudgetLevel.Critical
if bucket < lowThreshold       → CpuBudgetLevel.Low
if bucket > surplusThreshold   → CpuBudgetLevel.Surplus
else                           → CpuBudgetLevel.Normal
```

### 4.3 预算等级与服务范围决策表

| CpuBudgetLevel | Game.cpu.bucket | 可执行服务范围 |
|----------------|-----------------|----------------|
| Surplus | > 8000 | 完整执行 + 可选密集任务 |
| Normal | 2500–8000 | 完整执行所有 TaskForce |
| Low | 500–2500 | 截断低优先级 TaskForce（Phase 11 实现）|
| Critical | < 500 | 最小集：refresh + spawn 基础设施（D-10）|

### 4.4 在 tick() 中的调用点

`computeBudgetLevel()` 在 `HighCommand.tick()` 中的调用时序（见 KERN-01 §4）：

```typescript
// build 或 refresh 成功后：
const budgetLevel = this.computeBudgetLevel(services);

if (budgetLevel === CpuBudgetLevel.Critical) {
  this.runMinimalSet(services);  // 熔断：最小集（D-10）
} else {
  this.init(services);
  this.run(services);            // 正常：完整 init/run
}
```

---

## 5. 看门狗数据结构（D-09）

Phase 9 只定义看门狗的数据结构——监控记录类型和配置接口。suspend/resume 逻辑、连续超限计数更新在 Phase 11 实现。

### 5.1 WatchdogRecord 监控记录

```typescript
// src/highCommand/types.ts（HighCommand 域私有类型，非 shared 接口）

/**
 * 看门狗监控记录：追踪单个 TaskForce 的 CPU 超限历史。
 * 看门狗策略在 Phase 11 Intel 调度器中实现（D-09、D-11）。
 */
export interface WatchdogRecord {
  /** TaskForce 的唯一标识符 */
  readonly ref: string;
  /** 连续超限 tick 计数（超过阈值后触发 suspend）*/
  consecutiveOverrunTicks: number;
  /** 是否当前被 suspend（suspend 时跳过 init/run）*/
  suspended: boolean;
  /** suspend 解除的 tick 时间（Game.time 值）*/
  suspendUntilTick: number;
}

/**
 * 看门狗配置接口（Phase 9 定义接口，阈值数值在 Phase 11 设置）。
 */
export interface IWatchdogConfig {
  /** 单个 TaskForce 单 tick CPU 警告阈值（毫秒，推荐值：5）*/
  readonly perTickWarningMs: number;
  /** 连续超限 tick 数达到此值时触发 suspend（推荐值：3）*/
  readonly consecutiveOverrunLimit: number;
  /** suspend 持续 tick 数（推荐值：10）*/
  readonly suspendDurationTicks: number;
}
```

### 5.2 WatchdogRecord 文件位置说明（T-09-05 安全边界）

`WatchdogRecord` 和 `IWatchdogConfig` 是 HighCommand 域私有类型，必须放置在 `src/highCommand/types.ts`，**不得**导出到 `src/shared/interfaces/`。

**原因：**
- 看门狗逻辑是 HighCommand/Intel 内部的实现细节，不是跨域契约
- 将其放入 `shared/interfaces/` 会暴露不应对外可见的内部监控状态
- 遵循 SPEC-04 接口契约原则：跨域接口才进入 `shared/interfaces/`，域私有类型留在模块内

```typescript
// src/highCommand/types.ts（正确位置）
export interface WatchdogRecord { ... }      // ✅ 域私有类型
export interface IWatchdogConfig { ... }     // ✅ 域私有配置接口

// src/shared/interfaces/IWatchdogConfig.ts  // ❌ 禁止：看门狗不是跨域契约
```

### 5.3 Profiler 集成参考

看门狗计量应通过现有 `Profiler.ts` 的 `startStage`/`endStage` 接口实现（Phase 11 实现时使用），避免手工 `Date.now()` 计量：

```typescript
// Phase 11 看门狗计量参考（本文档不实现，仅提供设计方向）
services.profiler.startStage(record.ref);
taskForce.init(services);
const sample = services.profiler.endStage(record.ref);
// sample.duration 即为本次 init 耗时（毫秒）
// 超过 perTickWarningMs 时更新 consecutiveOverrunTicks
```

---

## 6. 截断与熔断边界说明（D-10、D-11）

### 6.1 Phase 9 vs Phase 11 能力边界

| 能力 | Phase 9（本文档定义） | Phase 11（Intel 调度器实现）|
|------|---------------------|-----------------------------|
| CpuBudgetLevel 数据结构 | CpuBudgetLevel as const | — |
| ICpuBudgetConfig 阈值接口 | 接口定义 + 推荐值 | — |
| DEFAULT_CPU_BUDGET_CONFIG | 默认配置常量 | — |
| computeBudgetLevel() 方法签名 | 方法签名 + 行为契约 | 实现体 |
| WatchdogRecord 数据结构 | 接口定义 | — |
| IWatchdogConfig 配置接口 | 接口定义 + 推荐值 | — |
| TaskForce 截断 for 循环 | — | Intel 调度器按优先级截断 |
| 看门狗 suspend/resume 逻辑 | — | 连续超限计数 + suspend |
| 熔断最小集执行 | HighCommand.runMinimalSet() 签名 | runMinimalSet() 实现体 |

### 6.2 D-11 原文引用

> "Phase 9 只定义 CPU 管理的基础设施（预算等级数据结构、阈值接口、HighCommand 计算本 tick 预算等级的逻辑）。截断执行和看门狗的具体实现留给 Phase 11。"
>
> — D-11，09-CONTEXT.md

### 6.3 熔断保护说明（D-10）

当 `CpuBudgetLevel.Critical`（bucket < 500）时，HighCommand 进入熔断模式：

- 跳过 `init()` 和 `run()`（所有 TaskForce 暂停）
- 只执行 `runMinimalSet()`——确保 creep 不断代（refresh + spawn 基础设施）
- **目的：** 保证即使 CPU bucket 极度耗尽，孵化中的 creep 也不会因 spawn 未续期而失败

```typescript
// HighCommand.tick() 熔断分支（来自 KERN-01 §4）
if (budgetLevel === CpuBudgetLevel.Critical) {
  this.runMinimalSet(services);  // ✅ 只执行最小集
} else {
  this.init(services);            // ✅ 正常 init/run
  this.run(services);
}
```

---

## 7. 关联规范

| 规范 | 关联点 |
|------|--------|
| **KERN-01** | `computeBudgetLevel()` 在 `HighCommand.tick()` 中的调用位置；`CpuBudgetLevel` 的 import 来源 |
| **KERN-03** | Init/Run 阶段的执行条件（`budgetLevel !== CpuBudgetLevel.Critical`）|
| **SPEC-02** | `as const` 对象 + 派生联合类型模式（D-13）；中文 JSDoc 要求（D-11）|
| **SPEC-04** | `shared/` 只读接口模式（模式 5）——`CpuBudgetLevel` 和 `ICpuBudgetConfig` 均为 shared 层内容；`IWatchdogConfig` 和 `WatchdogRecord` 为域私有类型（highCommand/ 层）|

---

*文档创建：2026-05-10 | Phase 09-内核层设计*
