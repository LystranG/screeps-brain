import { CURRENT_MEMORY_VERSION, createDefaultProjectMemorySections } from "memory/schema";

export interface MigrationResult {
  ok: true;
  version: typeof CURRENT_MEMORY_VERSION;
}

/**
 * 前期只在 sim/测试环境迭代，暂不维护历史 Memory 兼容；缺少当前骨架时直接初始化。
 */
export function runMemoryMigrations(memory: Memory): MigrationResult {
  if (!hasCurrentMemorySkeleton(memory)) {
    Object.assign(memory, createDefaultProjectMemorySections(), {
      creeps: {}
    });
  }

  return { ok: true, version: CURRENT_MEMORY_VERSION };
}

function hasCurrentMemorySkeleton(memory: Memory): boolean {
  return (
    memory.version === CURRENT_MEMORY_VERSION &&
    memory.runtime !== undefined &&
    memory.config !== undefined &&
    memory.colonies !== undefined &&
    memory.processes !== undefined &&
    memory.commands !== undefined &&
    memory.stats !== undefined &&
    memory.creeps !== undefined
  );
}
