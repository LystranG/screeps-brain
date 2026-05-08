import { cleanupDeadCreepMemory } from "cleanup/creepMemory";

/**
 * tick 末尾安全收尾入口；不在 cleanup 阶段放置新的策略行为。
 */
export function runCleanupStage(): void {
  cleanupDeadCreepMemory();
}
