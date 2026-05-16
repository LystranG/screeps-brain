// src/runtime/memory/index.ts — runtime/memory 模块公共接口 barrel

export type { Pending, SegmentAllocEntry } from "./types";
export { isPending, SEGMENT_ALLOC, MAX_ACTIVE_SEGMENTS, MAX_PINNED_SEGMENTS } from "./types";

import type { Pending } from "./types";

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

/**
 * MemProxy 接口：包装大型 Memory 数据结构，提供 L2/L3 透明读写（D-05、D-06）。
 * 调用方无需知道数据存在哪一层（L2 Memory 或 L3 Segment）。
 * 实现类：MemProxy（src/runtime/memory/MemProxy.ts，MEM-02）。
 * @template T - 被包装的数据类型，必须为对象类型
 */
export interface IMemProxy<T extends object> {
  /**
   * 读取数据。segment 未激活时返回 Pending{ready:false}。
   * 调用方必须用 isPending() 检查返回值后再使用（D-09 语义传递）。
   * 调用方模式：`const result = proxy.get(); if (isPending(result)) return;`
   * @returns 数据对象，或 Pending 标记（segment 未激活时）
   */
  get(): T | Pending;

  /**
   * 写入数据。只标记脏位，数据在 flush() 时写回 segment（D-07 tick 末统一写回）。
   * 不立即写回，避免 tick 中途频繁 I/O。
   * @param value - 要写入的数据对象
   */
  set(value: T): void;

  /**
   * tick 末写回所有脏 segment。只能由 Kernel 的 memoryFlush 阶段调用，业务代码严禁调用。
   * 在 tick 中途调用会导致数据不一致（Pitfall #4 防护）。
   */
  flush(): void;
}

/**
 * MemoryManager 接口（占位声明，完整定义见 MEM-01）。
 * Kernel 通过此接口调用 Memory 生命周期方法。
 */
export interface IMemoryManager {
  /** MemHack 阶段：检测 global reset，复用 Heap 引用或重新解析 RawMemory（完整定义见 MEM-01）。*/
  load(): void;
  /** 清理阶段：遍历 Memory.creeps 和 Memory.flags，删除已死亡实体的残留条目（完整定义见 MEM-01）。*/
  clean(): void;
}
