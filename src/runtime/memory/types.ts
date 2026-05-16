// src/runtime/memory/types.ts — runtime/memory 模块内部类型定义

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

/**
 * Segment 分配表条目：记录某个 segment 的分配信息，持久化在 Memory.segmenter.alloc 中。
 */
export interface SegmentAllocEntry {
  /** 分配此 segment 的模块标识（如 "IntelDB"、"BasePlanner"） */
  module: string;
  /** 是否常驻（永不被 LRU 淘汰，D-10）*/
  pinned: boolean;
  /** 最后访问 tick（LRU 淘汰依据，每次成功 get() 后更新为 Game.time）*/
  lastAccessed: number;
}

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
