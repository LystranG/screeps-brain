export function cleanupDeadCreepMemory(): number {
  let deletedCount = 0;

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
