// src/shared/cache/cache.ts — L1 Heap 缓存函数（$ 函数）骨架设计定义
import type { ICacheable } from "shared/interfaces";

/**
 * 缓存条目：存储带 TTL 的计算结果。
 * expiration 为 Game.time 的绝对值，到期时同步重算（D-13）。
 */
export interface CacheEntry<T> {
  /** 缓存的计算结果 */
  value: T;
  /** 过期时刻（Game.time 绝对值）；Game.time >= expiration 时重算 */
  expiration: number;
}

/**
 * 默认 TTL 常量（tick 数）。
 * costMatrix 使用 200 tick 参考 §8.5 路径缓存 TTL（Claude's Discretion）。
 * number/object/array 使用 50 tick 作为通用默认值。
 */
export const DEFAULT_TTL = {
  /** number 类型默认 TTL（tick）*/
  number: 50,
  /** object 类型默认 TTL（tick）*/
  object: 50,
  /** array 类型默认 TTL（tick）*/
  array: 50,
  /** CostMatrix 类型默认 TTL（tick）— 参考 §8.5 路径缓存 TTL=200 */
  costMatrix: 200
} as const;

/**
 * 确保 _cache 全局变量已初始化，返回缓存存储对象。
 * 使用 ??= 惰性初始化，global reset 后自动重建（D-14）。
 */
function ensureCache(): Record<string, CacheEntry<unknown>> {
  global._cache ??= {};
  return global._cache as Record<string, CacheEntry<unknown>>;
}

/**
 * L1 Heap 缓存函数集合。
 * 所有方法以 saver.cacheKey + ":" + key 构成复合键，在 Heap 全局变量中缓存带 TTL 的计算结果。
 * TTL 过期后同步重算（访问时执行 callback），不使用 stale-while-revalidate（D-13）。
 * 目录位置：src/shared/cache/（跨域共享工具，符合 SPEC-03 依赖方向规则，D-15）。
 */
export const $ = {
  /**
   * 缓存 number 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   * @param saver - 实现 ICacheable 的对象，提供 cacheKey 命名空间前缀（D-11）
   * @param key - 属性键，与 saver.cacheKey 组合为复合键
   * @param callback - 计算函数，TTL 过期时同步调用
   * @param ttl - 缓存有效期（tick 数），默认 DEFAULT_TTL.number（50）
   * @returns 缓存的或新计算的 number 值
   */
  number(saver: ICacheable, key: string, callback: () => number, ttl: number = DEFAULT_TTL.number): number {
    const cache = ensureCache();
    const compositeKey = `${saver.cacheKey}:${key}`;
    const entry = cache[compositeKey] as CacheEntry<number> | undefined;
    if (entry !== undefined && Game.time < entry.expiration) {
      return entry.value;
    }
    const result = callback();
    cache[compositeKey] = { value: result, expiration: Game.time + ttl };
    return result;
  },

  /**
   * 缓存 object 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   * @param saver - 实现 ICacheable 的对象，提供 cacheKey 命名空间前缀（D-11）
   * @param key - 属性键，与 saver.cacheKey 组合为复合键
   * @param callback - 计算函数，TTL 过期时同步调用
   * @param ttl - 缓存有效期（tick 数），默认 DEFAULT_TTL.object（50）
   * @returns 缓存的或新计算的 object 值
   */
  object<T extends object>(saver: ICacheable, key: string, callback: () => T, ttl: number = DEFAULT_TTL.object): T {
    const cache = ensureCache();
    const compositeKey = `${saver.cacheKey}:${key}`;
    const entry = cache[compositeKey] as CacheEntry<T> | undefined;
    if (entry !== undefined && Game.time < entry.expiration) {
      return entry.value;
    }
    const result = callback();
    cache[compositeKey] = { value: result, expiration: Game.time + ttl };
    return result;
  },

  /**
   * 缓存 array 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   * @param saver - 实现 ICacheable 的对象，提供 cacheKey 命名空间前缀（D-11）
   * @param key - 属性键，与 saver.cacheKey 组合为复合键
   * @param callback - 计算函数，TTL 过期时同步调用
   * @param ttl - 缓存有效期（tick 数），默认 DEFAULT_TTL.array（50）
   * @returns 缓存的或新计算的 array 值
   */
  array<T>(saver: ICacheable, key: string, callback: () => T[], ttl: number = DEFAULT_TTL.array): T[] {
    const cache = ensureCache();
    const compositeKey = `${saver.cacheKey}:${key}`;
    const entry = cache[compositeKey] as CacheEntry<T[]> | undefined;
    if (entry !== undefined && Game.time < entry.expiration) {
      return entry.value;
    }
    const result = callback();
    cache[compositeKey] = { value: result, expiration: Game.time + ttl };
    return result;
  },

  /**
   * 缓存 CostMatrix 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   * 默认 TTL 为 200 tick（路径缓存通常比普通数据更稳定，参考 §8.5）。
   * @param saver - 实现 ICacheable 的对象，提供 cacheKey 命名空间前缀（D-11）
   * @param key - 属性键，与 saver.cacheKey 组合为复合键
   * @param callback - 计算函数，TTL 过期时同步调用
   * @param ttl - 缓存有效期（tick 数），默认 DEFAULT_TTL.costMatrix（200）
   * @returns 缓存的或新计算的 CostMatrix 值
   */
  costMatrix(
    saver: ICacheable,
    key: string,
    callback: () => CostMatrix,
    ttl: number = DEFAULT_TTL.costMatrix
  ): CostMatrix {
    const cache = ensureCache();
    const compositeKey = `${saver.cacheKey}:${key}`;
    const entry = cache[compositeKey] as CacheEntry<CostMatrix> | undefined;
    if (entry !== undefined && Game.time < entry.expiration) {
      return entry.value;
    }
    const result = callback();
    cache[compositeKey] = { value: result, expiration: Game.time + ttl };
    return result;
  },

  /**
   * 手动清空 L1 Heap 缓存（D-14）。
   * 用于调试或强制重建场景；正常运行不应调用此方法。
   * global reset 时 _cache 自然消失，无需手动调用。
   */
  invalidateAll(): void {
    global._cache = {};
  }
};
