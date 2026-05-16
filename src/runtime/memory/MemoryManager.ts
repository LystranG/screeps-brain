// src/runtime/memory/MemoryManager.ts — MemoryManager Kernel 阶段实现（MEM-01）

import type { IMemoryManager } from "./index";

// _memParsed 全局变量已在 src/shared/types/global.d.ts 中声明，此处无需重复声明。

/**
 * MemoryManager：Kernel 的独立运行时基础设施阶段（D-01）。
 * 在 highCommandTick 之前完成 Memory 准备（load + clean），不属于 HighCommand 业务层。
 * 目录位置：src/runtime/memory/（与 Kernel 同层，D-02）。
 */
export class MemoryManager implements IMemoryManager {
  /**
   * MemHack 阶段：复用上 tick 已解析的 Memory 对象，跳过 JSON.parse。
   * 节省约 0.5~2 CPU/tick（取决于 Memory 体积）。
   *
   * 原理：引擎每 tick 执行 JSON.parse(RawMemory.get()) 并将结果赋给 global.Memory。
   * MemHack 在 Heap 中保留上 tick 的 Memory 对象引用（global._memParsed）。
   * 正常 tick：直接将 global.Memory 替换为 Heap 引用，跳过 JSON.parse。
   * global reset：Heap 被清空，_memParsed 为 undefined，重新从 RawMemory 解析。
   *
   * 在 Kernel 的 memoryLoad 阶段调用，每 tick 第一个执行（D-01）。
   */
  public load(): void {
    // global reset 检测：Heap 中的引用在 global reset 后变为 undefined
    if (global._memParsed !== undefined) {
      // 正常 tick：直接将引擎的 Memory 全局变量替换为 Heap 引用
      // 引擎随后对 Memory 的修改将直接作用于此对象，无需 JSON.parse
      (global as unknown as Record<string, unknown>).Memory = global._memParsed;
    } else {
      // global reset：重新从 RawMemory 解析，并保存引用到 Heap
      global._memParsed = Memory as unknown as Record<string, unknown>;
    }
  }

  /**
   * 清理阶段：遍历 Memory.creeps 和 Memory.flags，删除已死亡实体的残留条目（D-03）。
   *
   * 清理范围（精确定义）：
   * - Memory.creeps：删除 !Game.creeps[name] 的条目（Creep 已死亡）
   * - Memory.flags：删除 !Game.flags[name] 的条目（Flag 已被移除）
   * 其他 Memory 键（Garrison 配置等）由各模块自行清理（D-04）。
   *
   * 在 Kernel 的 memoryClean 阶段调用，load() 之后、highCommandTick 之前（D-03）。
   */
  public clean(): void {
    // 清理已死亡 Creep 的 Memory 残留
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }

    // 清理已移除 Flag 的 Memory 残留
    for (const name in Memory.flags) {
      if (!Game.flags[name]) {
        delete Memory.flags[name];
      }
    }
  }
}

/**
 * MemoryManager 单例导出。
 * 供 lifecycle.ts 中的 memoryLoad / memoryClean 阶段 run 函数调用（实现阶段接入）。
 */
export const memoryManager = new MemoryManager();
