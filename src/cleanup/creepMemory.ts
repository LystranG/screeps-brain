/**
 * 清理已经不存在的 creep memory，并返回删除数量供内核测试和后续统计使用。
 */
export function cleanupDeadCreepMemory(): number {
  let deletedCount = 0;

  // Game.creeps 是本 tick 的真实 creep 列表；Memory.creeps 可能残留死亡 creep。
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
      deletedCount += 1;
    }
  }

  if (deletedCount > 0) {
    console.log(`Cleaned up ${deletedCount} stale creep memory entries`);
  }

  return deletedCount;
}
