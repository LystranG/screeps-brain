import { assert } from "chai";
import { ProjectMemoryShape, SpawnRequestMemory, TaskMemory } from "memory/schema";

type IntegrationMemory = ProjectMemoryShape;

interface IntegrationCreepMemory extends CreepMemory {
  task?: TaskMemory;
}

export function assertCommandIncludes(output: string, tokens: readonly string[]): void {
  tokens.forEach(token => {
    assert.include(output, token);
  });
}

export function assertReadyBootstrapMemory(memory: IntegrationMemory, roomName: string): void {
  assert.equal(memory.runtime.migrationError, null);
  assert.equal(memory.config.colony.primaryRoomName, roomName);
  assert.property(memory.colonies, roomName);
  assert.equal(memory.colonies[roomName].status, "ready");
  assert.equal(memory.colonies[roomName].intel.status, "ready");
  assert.deepEqual(memory.colonies[roomName].intel.missingReasons, []);
  assert.isAtLeast(memory.colonies[roomName].intel.sourceIds.length, 1);
  assert.isAtLeast(memory.colonies[roomName].intel.spawnIds.length, 1);
}

export function assertProcessRan(memory: IntegrationMemory, processName: string): void {
  assert.property(memory.processes, processName);
  assert.isNumber(memory.processes[processName].lastRunTick);
  assert.oneOf(memory.processes[processName].lastStatus, ["ok", "skipped"]);
}

export function assertSpawnQueueProgressed(memory: IntegrationMemory, roomName: string): void {
  const queue = memory.colonies[roomName].spawnQueue;
  const statuses = queue.map((request: SpawnRequestMemory) => request.status);

  assert.isAtLeast(queue.length, 1);
  assert.includeMembers(statuses, ["queued", "validating", "validated", "blocked", "spawning", "spawned", "failed"]);
}

export function assertTaskProgressed(memory: IntegrationMemory, roomName: string): void {
  const creepNames = Object.keys(memory.creeps);
  const taskStatuses = creepNames
    .map(creepName => (memory.creeps[creepName] as IntegrationCreepMemory).task)
    .filter((task): task is TaskMemory => task !== undefined)
    .map(task => task.status);

  assert.equal(memory.colonies[roomName].roomName, roomName);
  assert.isAtLeast(taskStatuses.length, 1);
  assert.includeMembers(taskStatuses, ["assigned", "running", "complete", "failed"]);
}

export function assertSimGuidanceCodes(memory: IntegrationMemory, codes: readonly string[]): void {
  codes.forEach(code => {
    const guidance = memory.runtime.sim.guidance[code] as { active?: boolean; message?: string };

    assert.property(memory.runtime.sim.guidance, code);
    assert.equal(guidance.active, true);
    assert.isString(guidance.message);
  });
}

export function assertDegradedColonyMemory(
  memory: IntegrationMemory,
  roomName: string,
  expectedMissingReasons: readonly string[]
): void {
  assert.property(memory.colonies, roomName);
  assert.equal(memory.colonies[roomName].status, "degraded");
  assert.includeMembers(memory.colonies[roomName].intel.missingReasons, [...expectedMissingReasons]);
}
