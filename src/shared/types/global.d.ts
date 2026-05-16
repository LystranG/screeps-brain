// src/shared/types/global.d.ts — 全局 Heap 变量声明（L1 缓存层与 MemHack）

declare global {
  /**
   * $ 函数的 L1 Heap 缓存存储。global reset 后自然消失（D-14）。
   * 键格式：saver.cacheKey + ":" + key
   * 通过 $.invalidateAll() 可手动清空（调试或强制重建场景）。
   */
  var _cache: Record<string, { value: unknown; expiration: number }> | undefined;

  /**
   * MemHack：Heap 中保留上 tick 的已解析 Memory 对象引用。
   * global reset 后此引用变为 undefined，MemoryManager.load() 据此检测 reset。
   * 节省约 0.5-2 CPU/tick（跳过每 tick JSON.parse）。
   */
  var _memParsed: Record<string, unknown> | undefined;
}

export {};
