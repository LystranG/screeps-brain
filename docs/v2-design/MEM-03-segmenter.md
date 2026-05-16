# MEM-03: Segmenter — Segment 激活管理与 LRU 淘汰

> **状态：** v2.0 权威文档 | **日期：** 2026-05-16
> **关联决策：** D-08、D-09、D-10（10-CONTEXT.md）
> **依赖：** SPEC-03（依赖方向规则）、SPEC-04（接口契约规范）
> **阶段范围：** Phase 10 完整设计 Segmenter 接口与 LRU 淘汰策略；实现在后续阶段

---

## 1. 总体原则（D-08、D-09、D-10）

**核心设计：管理最多 10 个 segment 激活槽位（引擎硬限制），通过 LRU 淘汰非常驻 segment，提供 Page Fault 透明化（返回 Pending 而非抛出异常）。**

Segmenter 是三级缓存架构的最底层，直接操作 `RawMemory.segments`。其职责是：

- **分配管理（D-08）：** 维护 segment 分配表（持久化在 Memory 中），支持固定分配（segment 0 = 分配表元数据）和动态分配（`allocate()` 方法）
- **Page Fault 透明化（D-09）：** 请求未激活的 segment 时，返回 `Pending` 标记而非抛出异常，调用方通过检查 `.ready` 属性决定是否跳过本 tick 处理
- **LRU 淘汰（D-10）：** 激活槽位不足时，按 `lastAccessed` 时间戳淘汰最久未访问的非常驻 segment；常驻 segment（`pinned: true`）永不被淘汰

### 1.1 Phase 10 范围边界

**Phase 10 定义以下四项内容：**

1. `ISegmenter` 接口（`src/runtime/memory/index.ts`）
2. `Pending` 接口 + `isPending()` 类型保护函数（`src/runtime/memory/types.ts`）
3. `SEGMENT_ALLOC`、`MAX_ACTIVE_SEGMENTS`、`MAX_PINNED_SEGMENTS` 常量（`src/runtime/memory/types.ts`）
4. `SegmentAllocEntry` 分配表数据结构（`src/runtime/memory/types.ts`）

**以下内容不在 Phase 10 范围内，留给后续实现阶段：**

- `Segmenter.ts` 实际代码（LRU 算法实现体、`RawMemory.segments` 读写逻辑）
- 与 `RawMemory.segments` 的实际交互（`JSON.parse`、`JSON.stringify`）
- 分配表初始化逻辑（首次运行时创建 `Memory.segmenter.alloc`）

### 1.2 Screeps 环境约束

> **警告：** `RawMemory.setActiveSegments()` 超过 10 个 id 时，引擎行为未明确定义（可能截断，可能报错）。
> 参见 Assumptions Log A3（10-RESEARCH.md）。
>
> **防护：** `flush()` 必须在调用 `setActiveSegments()` 前对 id 列表做截断校验：
> `ids.slice(0, MAX_ACTIVE_SEGMENTS)`
>
> **Segment 容量：** 每个 segment 最多存储 100KB 文本。超出时引擎行为未定义（静默截断或报错）。
> 设计文档不规定体积监控策略，由各模块自行负责（D-04 原则延伸）。

---

## 2. Pending 标记接口（D-09）

`Pending` 是 Page Fault 的返回值类型，表示"数据尚未就绪，请下一 tick 重试"。

### 2.1 接口定义（与 src/runtime/memory/types.ts 完全一致）

```typescript
// src/runtime/memory/types.ts

/**
 * Pending 标记：segment 尚未激活时的占位返回值。
 * 调用方通过检查 .ready 属性决定是否跳过本 tick 处理。
 */
export interface Pending {
  /** 始终为 false，标记数据尚未就绪 */
  readonly ready: false;
  /** 请求的 segment id（便于调试） */
  readonly segmentId: number;
}

/**
 * 类型保护函数：判断返回值是否为 Pending 标记。
 * 调用方模式：`if (isPending(result)) return;`
 */
export function isPending(value: unknown): value is Pending {
  return typeof value === "object" && value !== null && (value as Pending).ready === false;
}
```

### 2.2 调用方模式

```typescript
// 标准 Page Fault 处理模式（D-09）
const data = segmenter.get<IntelRoomData>(segmentId);
if (isPending(data)) {
  // segment 未激活，本 tick 跳过处理
  // Segmenter 已自动将 segmentId 加入下一 tick 激活列表
  return;
}
// data 类型已收窄为 IntelRoomData，可安全使用
processIntelData(data);
```

**设计理由（D-09）：** 返回 `Pending` 而非抛出异常，使调用方可以优雅地跳过本 tick 处理，而不是触发 Kernel 的 try/catch 隔离。Page Fault 是正常的运行时状态（segment 激活需要一个 tick 延迟），不是错误。

---

## 3. SEGMENT_ALLOC 常量与分配策略（D-08）

### 3.1 常量定义（与 src/runtime/memory/types.ts 完全一致）

```typescript
// src/runtime/memory/types.ts

/**
 * Segment 固定分配约定常量（D-08）。
 * segment 0 保留：存储分配表元数据，永远激活。
 */
export const SEGMENT_ALLOC = {
  /** segment 0 保留：存储分配表元数据，永远激活（D-08）*/
  ALLOC_TABLE: 0
} as const;

/** Screeps 引擎对激活 segment 数量的硬限制 */
export const MAX_ACTIVE_SEGMENTS = 10;

/** 建议常驻 segment 预算上限（留足 LRU 动态槽位）— Claude's Discretion */
export const MAX_PINNED_SEGMENTS = 3;
```

### 3.2 SegmentAllocEntry 分配表数据结构

```typescript
// src/runtime/memory/types.ts

/**
 * Segment 分配表条目：记录某个 segment 的分配信息，持久化在 Memory.segmenter.alloc 中。
 */
export interface SegmentAllocEntry {
  /** 分配此 segment 的模块标识（如 "IntelDB"、"BasePlanner"）*/
  module: string;
  /** 是否常驻（永不被 LRU 淘汰，D-10）*/
  pinned: boolean;
  /** 最后访问 tick（LRU 淘汰依据，每次成功 get() 后更新为 Game.time）*/
  lastAccessed: number;
}
```

**分配表持久化路径：** `Memory.segmenter.alloc: Record<number, SegmentAllocEntry>`

### 3.3 混合分配策略（D-08）

Segmenter 采用混合分配策略：

| 分配类型 | Segment | 分配方式 | 说明 |
|---------|---------|---------|------|
| 固定分配 | segment 0 | 硬编码（`SEGMENT_ALLOC.ALLOC_TABLE`）| 存储分配表元数据，永远激活，不参与 LRU |
| 动态分配 | segment 1–99 | `Segmenter.allocate()` | 模块初始化时申请，结果持久化到分配表 |

**分配表持久化（D-08）：** 分配结果存储在 `Memory.segmenter.alloc`（L2 Memory），跨 tick 持久化。模块重启后无需重新分配，直接从分配表读取已分配的 segment id。

**幂等性保证：** `allocate()` 检查分配表，若模块已有分配则直接返回已分配的 id，不重复分配。

---

## 4. ISegmenter 接口（与 src/runtime/memory/index.ts 完全一致）

```typescript
// src/runtime/memory/index.ts（barrel）

/**
 * Segmenter 接口：管理 Screeps segment 激活槽位，提供 LRU 淘汰和 Page Fault 透明化。
 * 由 MemProxy 内部使用；模块也可直接调用（D-08）。
 * 实现类：Segmenter（src/runtime/memory/Segmenter.ts，后续阶段实现）。
 */
export interface ISegmenter {
  /**
   * 动态分配一个或多个 segment 给指定模块。分配表持久化到 Memory.segmenter.alloc（D-08）。
   * 在模块初始化阶段（Build 阶段）调用，幂等：已分配的模块不重复分配。
   * @param module - 模块标识（如 "IntelDB"、"BasePlanner"）
   * @param pageCount - 需要的 segment 数量
   * @param pinned - 是否常驻（永不被 LRU 淘汰，D-10）；默认 false
   * @returns 分配的 segment id 数组
   */
  allocate(module: string, pageCount: number, pinned?: boolean): number[];

  /**
   * 读取 segment 数据。
   * 若 segment 已激活：返回解析后的对象，并更新 lastAccessed 为 Game.time。
   * 若 segment 未激活：返回 Pending{ready:false}，并将该 id 加入下一 tick 激活列表（D-09）。
   * 在 highCommandTick 阶段内调用（业务代码通过 MemProxy 间接使用）。
   * @param segmentId - 目标 segment id
   * @returns 解析后的数据对象，或 Pending 标记（segment 未激活时）
   */
  get<T>(segmentId: number): T | Pending;

  /**
   * 写入 segment 数据。标记脏位，tick 末通过 flush() 写回（D-09）。
   * 在 highCommandTick 阶段内调用（业务代码通过 MemProxy 间接使用）。
   * @param segmentId - 目标 segment id
   * @param value - 要写入的数据对象
   */
  set<T>(segmentId: number, value: T): void;

  /**
   * tick 末写回所有脏 segment，计算下 tick 激活列表（常驻优先 + LRU），
   * 并调用 RawMemory.setActiveSegments()（D-10）。
   * 防溢出：激活列表在调用 setActiveSegments 前截断至 MAX_ACTIVE_SEGMENTS 个。
   * 只能由 Kernel 的 memoryFlush 阶段调用；业务代码不得直接调用。
   */
  flush(): void;
}
```

---

## 5. LRU 激活槽位管理算法（D-10）

### 5.1 激活列表计算规则（flush() 内执行）

`flush()` 在 tick 末计算下一 tick 的激活列表，规则如下：

1. **常驻 segment 优先（D-10）：** 所有 `pinned: true` 的 segment 无条件进入激活列表
2. **segment 0 始终激活（D-08）：** `SEGMENT_ALLOC.ALLOC_TABLE`（segment 0）作为分配表元数据，始终包含在激活列表中
3. **剩余槽位按 LRU 填充：** 非常驻 segment 按 `lastAccessed` 降序排列（最近访问的优先），依次填充剩余槽位
4. **防溢出截断：** 最终列表通过 `slice(0, MAX_ACTIVE_SEGMENTS)` 截断，确保不超过 10 个

**伪代码（实现阶段参考）：**

```typescript
// flush() 内激活列表计算逻辑（伪代码，实现在后续阶段）
const alloc = Memory.segmenter.alloc as Record<number, SegmentAllocEntry>;

// 1. 常驻 segment（含 segment 0）
const pinned = Object.entries(alloc)
  .filter(([, entry]) => entry.pinned)
  .map(([id]) => Number(id));

// 2. 非常驻 segment，按 lastAccessed 降序（LRU）
const lruCandidates = Object.entries(alloc)
  .filter(([, entry]) => !entry.pinned)
  .sort(([, a], [, b]) => b.lastAccessed - a.lastAccessed)
  .map(([id]) => Number(id));

// 3. 合并并截断
const nextActive = [...pinned, ...lruCandidates].slice(0, MAX_ACTIVE_SEGMENTS);

// 4. 写回脏 segment + 设置激活列表
RawMemory.setActiveSegments(nextActive);
```

### 5.2 Segment 类型与激活优先级

| Segment 类型 | 常驻/LRU | 激活优先级 | 说明 |
|-------------|---------|-----------|------|
| segment 0（分配表）| 常驻（固定）| 最高，始终激活 | `SEGMENT_ALLOC.ALLOC_TABLE`，D-08 |
| pinned segment | 常驻（模块声明）| 高，始终占用槽位 | `allocate(..., pinned: true)`，D-10 |
| LRU segment | 按 lastAccessed 降序 | 常驻满槽后依次填充 | 最近访问的优先保留 |
| 请求但未激活 | Page Fault | 下一 tick 激活 | 返回 Pending，D-09 |

### 5.3 lastAccessed 更新时机

每次成功的 `get()` 调用（segment 已激活，返回实际数据而非 Pending）后，更新对应 `SegmentAllocEntry.lastAccessed = Game.time`。

`set()` 调用不更新 `lastAccessed`（写入操作不代表"访问"，避免写密集型模块占用过多槽位）。

---

## 6. 调用时机与 Kernel 集成

### 6.1 各方法调用阶段

| 方法 | 调用阶段 | 调用方 | 说明 |
|------|---------|-------|------|
| `allocate()` | Build 阶段（模块初始化）| 各业务模块 | 幂等，已分配不重复分配 |
| `get()` | `highCommandTick` 阶段 | 业务代码（通过 MemProxy 间接）| 返回数据或 Pending |
| `set()` | `highCommandTick` 阶段 | 业务代码（通过 MemProxy 间接）| 标记脏位，不立即写回 |
| `flush()` | `memoryFlush` 阶段 | Kernel（仅此一处）| tick 末统一写回 |

### 6.2 memoryFlush 阶段（Claude's Discretion）

`flush()` 需要在 `highCommandTick` 之后、引擎 tick 结束之前调用。推荐新增独立 Kernel 阶段 `memoryFlush`（Claude's Discretion），理由：

- **可被 profiler 单独计量：** `memoryFlush` 作为独立阶段，CPU 消耗可被 Kernel profiler 单独记录，便于性能分析
- **符合 runtime 基础设施定位（D-01 原则延伸）：** MemoryManager 是 runtime 基础设施，其 flush 操作应与业务层（highCommandTick）明确分离
- **时序保证：** 独立阶段确保所有业务代码的 `set()` 调用都在 `flush()` 之前完成

**lifecycle.ts 扩展方案（参考 10-RESEARCH.md §Code Examples）：**

```typescript
// src/runtime/lifecycle.ts 扩展（在 Phase 9 KERN-03 基础上新增 Memory 阶段）
export type LifecycleStageName =
  | "refreshServices"
  | "memoryLoad"      // MEM-01 新增：MemHack + 检测 global reset
  | "memoryClean"     // MEM-01 新增：清理死亡 Creep/Flag 残留
  | "highCommandTick"
  | "memoryFlush";    // MEM-02/03 新增：写回所有脏 segment（tick 末）
```

---

## 7. Phase 10 范围对照表

| 能力 | Phase 10（本文档定义）| 后续实现阶段 |
|------|---------------------|------------|
| `ISegmenter` 接口 | 完整定义 | — |
| `Pending` + `isPending()` | 完整定义 | — |
| `SEGMENT_ALLOC` 常量 | 完整定义（`as const`）| — |
| `MAX_ACTIVE_SEGMENTS`、`MAX_PINNED_SEGMENTS` | 完整定义 | — |
| `SegmentAllocEntry` 类型 | 完整定义 | — |
| LRU 算法描述（伪代码级别）| 完整描述 | — |
| `Segmenter.ts` 实际代码 | — | 实现阶段 |
| 与 `RawMemory.segments` 的实际交互 | — | 实现阶段 |
| 分配表初始化逻辑 | — | 实现阶段 |

---

## 8. 禁止模式

### 禁止 1：同步抛出异常代替 Pending 返回（D-09）

```typescript
// ❌ 禁止：segment 未激活时抛出异常
get<T>(segmentId: number): T {
  if (RawMemory.segments[segmentId] === undefined) {
    throw new Error(`Segment ${segmentId} not active`);  // ❌ 触发 Kernel try/catch，中断整个 tick
  }
  return JSON.parse(RawMemory.segments[segmentId]) as T;
}

// ✅ 正确：返回 Pending 标记，调用方优雅跳过（D-09）
get<T>(segmentId: number): T | Pending {
  if (RawMemory.segments[segmentId] === undefined) {
    this._nextTickActive.add(segmentId);  // 自动加入下 tick 激活列表
    return { ready: false, segmentId };   // ✅ 返回 Pending，不抛出异常
  }
  return JSON.parse(RawMemory.segments[segmentId]) as T;
}
```

### 禁止 2：setActiveSegments 超过 10 个 id（Pitfall #2）

```typescript
// ❌ 禁止：未截断直接调用 setActiveSegments
RawMemory.setActiveSegments(allActiveIds);  // ❌ 若 allActiveIds.length > 10，引擎行为未定义

// ✅ 正确：调用前截断至 MAX_ACTIVE_SEGMENTS
const safeIds = allActiveIds.slice(0, MAX_ACTIVE_SEGMENTS);  // ✅ 防溢出截断
RawMemory.setActiveSegments(safeIds);
```

### 禁止 3：tick 中途调用 flush()（Pitfall #4）

```typescript
// ❌ 禁止：业务代码在 highCommandTick 阶段中途调用 flush()
class IntelDB {
  updateRoom(roomName: string, data: IntelRoomData): void {
    this.proxy.set(data);
    this.segmenter.flush();  // ❌ 中途 flush：本 tick 后续的 set() 调用将丢失
  }
}

// ✅ 正确：flush() 只由 Kernel 的 memoryFlush 阶段调用
// Kernel 在 highCommandTick 完成后统一调用 segmenter.flush()
// 业务代码只调用 set()，不调用 flush()
```

### 禁止 4：常驻 segment 超过 MAX_PINNED_SEGMENTS = 3（Pitfall #2 防护）

```typescript
// ❌ 禁止：过多常驻 segment 挤占 LRU 动态槽位
segmenter.allocate("IntelDB", 3, true);      // 3 个常驻
segmenter.allocate("BasePlanner", 3, true);  // 再 3 个常驻 → 共 6 个常驻 + segment 0 = 7 个
// ❌ 剩余只有 3 个 LRU 槽位，动态数据访问频繁触发 Page Fault

// ✅ 正确：常驻 segment 不超过 MAX_PINNED_SEGMENTS = 3（含 segment 0）
segmenter.allocate("IntelDB", 1, true);      // 1 个常驻（核心页）
segmenter.allocate("BasePlanner", 1, true);  // 1 个常驻（核心规划矩阵）
// ✅ segment 0（分配表）+ 2 个常驻 = 3 个常驻，剩余 7 个 LRU 槽位
```

---

## 9. 关联规范

| 规范/文档 | 关联内容 |
|---------|---------|
| **MEM-02** | MemProxy 依赖 MEM-03 ISegmenter 接口实现 L3 读写；`IMemProxy<T>` 的 `get()` 返回 `T \| Pending` |
| **KERN-03** | lifecycle.ts 扩展（`memoryFlush` 阶段在 `highCommandTick` 之后）|
| **SPEC-02** | `as const` 模式（`SEGMENT_ALLOC`）、中文 JSDoc、`SCREAMING_SNAKE_CASE` 标量常量 |
| **SPEC-03** | 依赖方向规则：`src/runtime/memory/` 只供 Kernel 层调用，不依赖 `highCommand/` 业务层 |
| **SPEC-04** | 接口契约规范：`ISegmenter` 通过 barrel `index.ts` 导出，隐藏实现类 `Segmenter.ts` |

---

*文档创建：2026-05-16 | Phase 10-Memory 与缓存层设计*
