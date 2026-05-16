// src/runtime/memory/MemProxy.ts — MemProxy L2/L3 透明访问层骨架（MEM-02）

import { isPending } from "./types";
import type { Pending } from "./types";
import type { IMemProxy, ISegmenter } from "./index";

/**
 * MemProxy<T> — L2/L3 透明访问层，包装大型 Memory 数据结构（D-06）。
 *
 * 适用范围（D-06）：只包装大型数据结构（IntelDB、RoomPlan 矩阵、大型寻路图）。
 * 普通小数据（Garrison 配置、任务队列）直接用 Memory，不经过 MemProxy。
 *
 * API 设计（D-07）：使用显式 get/set 方法，不使用 ES6 Proxy 属性拦截。
 * 调用方明确知道自己在使用缓存层，TypeScript 类型系统保证类型安全。
 *
 * flush 时机约束：flush() 只能由 Kernel 的 memoryFlush 阶段调用，业务代码严禁调用。
 * 在 tick 中途调用 flush() 会导致数据不一致（Pitfall #4）。
 *
 * @template T - 被包装的数据类型，必须为对象类型
 */
export class MemProxy<T extends object> implements IMemProxy<T> {
  /** 绑定的 segment id */
  private readonly segmentId: number;

  /** 数据不存在时的默认值工厂函数 */
  private readonly defaults: () => T;

  /** ISegmenter 依赖（构造函数注入，符合 SPEC-04 接口契约规范） */
  private readonly segmenter: ISegmenter;

  /** 脏标记：set() 后置为 true，flush() 写回后置为 false */
  private dirty = false;

  /**
   * 私有构造函数，通过 wrap() 工厂方法创建实例。
   * @param segmentId - 绑定的 segment id
   * @param defaults - 数据不存在时的默认值工厂函数
   * @param segmenter - ISegmenter 实例（构造函数注入）
   */
  private constructor(segmentId: number, defaults: () => T, segmenter: ISegmenter) {
    this.segmentId = segmentId;
    this.defaults = defaults;
    this.segmenter = segmenter;
  }

  /**
   * 工厂方法：创建绑定到指定 segment 的 MemProxy 实例。
   * defaults 工厂函数在 segment 不存在时提供初始值。
   * @param segmentId - 数据所在 segment id（由 Segmenter.allocate() 分配）
   * @param defaults - 数据不存在时的默认值工厂函数（每次调用返回新对象）
   * @param segmenter - ISegmenter 实例（由调用方注入）
   * @returns 绑定到指定 segment 的 MemProxy 实例
   */
  public static wrap<T extends object>(segmentId: number, defaults: () => T, segmenter: ISegmenter): MemProxy<T> {
    return new MemProxy<T>(segmentId, defaults, segmenter);
  }

  /**
   * 读取数据。segment 未激活时返回 Pending{ready:false}。
   * 调用方必须用 isPending() 检查返回值后再使用（D-09 语义传递）。
   * 示例：`const result = proxy.get(); if (isPending(result)) return;`
   * @returns 数据对象，或 Pending 标记（segment 未激活时）
   */
  public get(): T | Pending {
    // 委托给 ISegmenter.get()，透明传递 Page Fault 语义（D-09）
    // 若 segment 未激活，ISegmenter.get() 返回 Pending 并将 segmentId 加入下 tick 激活列表
    const result = this.segmenter.get<T>(this.segmentId);
    if (isPending(result)) {
      // 直接返回 Pending 给调用方，由调用方决定是否跳过本 tick 处理
      return result;
    }
    return result;
  }

  /**
   * 写入数据。只标记脏位，数据在 flush() 时写回 segment（D-07 tick 末统一写回）。
   * 不立即写回 segment，避免 tick 中途频繁 I/O。
   * @param value - 要写入的数据对象
   */
  public set(value: T): void {
    // 标记脏位，实际写入在 flush() 时通过 ISegmenter.set() 执行
    this.dirty = true;
    // 暂存待写入值（骨架阶段：实现阶段将持有 value 引用并在 flush 时写回）
    // 实现阶段：this._pendingValue = value;
    void value; // 骨架占位，防止 TypeScript 未使用变量警告
  }

  /**
   * tick 末写回所有脏 segment。只能由 Kernel 的 memoryFlush 阶段调用，业务代码严禁调用。
   * 写回流程：若 dirty 则通过 ISegmenter.set(segmentId, value) 写回，然后 dirty=false。
   * 在 tick 中途调用会导致数据不一致（Pitfall #4 防护）。
   */
  public flush(): void {
    if (!this.dirty) {
      return;
    }
    // 实现阶段：this.segmenter.set(this.segmentId, this._pendingValue);
    // 骨架阶段：脏标记重置（实际写回逻辑在实现阶段补充）
    this.dirty = false;
  }
}
