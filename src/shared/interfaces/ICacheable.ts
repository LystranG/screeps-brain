/**
 * 可缓存对象接口：所有需要使用 $ 缓存函数的类必须实现此接口（D-11）。
 * cacheKey 在实例生命周期内保持不变，用作缓存的命名空间前缀。
 *
 * 命名约定：格式 "ClassName:instanceId"（如 "Garrison:W1N1"、"TaskForce:mining-E15N52"）。
 * cacheKey 在实例生命周期内保持不变，建议格式 ClassName:instanceId（如 Garrison:W1N1）。
 */
export interface ICacheable {
  /** 全局唯一的缓存键前缀，建议格式：ClassName:instanceId（D-11）*/
  readonly cacheKey: string;
}
