import { ProjectMemoryShape, SpawnRequestMemory } from "memory/schema";
import { createSpawnRequest, enqueueSpawnRequest } from "spawning/queue";
import { BootstrapSlot } from "bootstrap/slots";
import { ColonyContext } from "colony/types";

const ACTIVE_REQUEST_STATUSES: readonly SpawnRequestMemory["status"][] = ["queued", "validated", "spawning"];

export interface BootstrapSpawnDemandSummary {
  created: number;
  duplicate: number;
  skipped: number;
  requestIds: string[];
}

/**
 * 将稳定槽位转换成 spawn queue 请求；重复判断使用 active 状态，避免每 tick 为同一槽位堆积请求。
 */
export function applyBootstrapSpawnDemand(
  slots: readonly BootstrapSlot[],
  memory: ProjectMemoryShape,
  context: ColonyContext,
  tick: number
): BootstrapSpawnDemandSummary {
  const summary: BootstrapSpawnDemandSummary = {
    created: 0,
    duplicate: 0,
    skipped: 0,
    requestIds: []
  };
  const missingPopulation = Math.max(0, calculateTargetPopulation(context) - context.stage.creepCount);
  let spawnDemandAccepted = 0;

  // 任务槽位仍保留给现有 creep；这里只按优先级限制本 tick 新增的 spawn demand。
  for (const slot of [...slots].sort((left, right) => left.priority - right.priority)) {
    if (slot.spawn === null) {
      summary.skipped += 1;
      continue;
    }

    if (spawnDemandAccepted >= missingPopulation) {
      summary.skipped += 1;
      continue;
    }

    const requestId = createBootstrapRequestId(context.roomName, slot.id, slot.spawn.role);
    const slotRequestPrefix = createBootstrapSlotRequestPrefix(context.roomName, slot.id);

    if (hasActiveSlotRequest(memory, context.roomName, slotRequestPrefix)) {
      summary.duplicate += 1;
      spawnDemandAccepted += 1;
      continue;
    }

    removeTerminalSlotRequests(memory, context.roomName, slotRequestPrefix);

    const result = enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: requestId,
        roomName: context.roomName,
        role: slot.spawn.role,
        priority: slot.spawn.priority,
        body: slot.spawn.body,
        memory: {
          role: slot.spawn.role
        } as CreepMemory,
        reason: slot.spawn.reason,
        requestedTick: tick
      })
    );

    if (result.ok) {
      summary.created += 1;
      spawnDemandAccepted += 1;
      summary.requestIds.push(requestId);
    } else {
      summary.duplicate += 1;
    }
  }

  return summary;
}

function createBootstrapRequestId(roomName: string, slotId: string, role: string): string {
  return `bootstrap:${roomName}:${slotId}:${role}`;
}

function createBootstrapSlotRequestPrefix(roomName: string, slotId: string): string {
  return `bootstrap:${roomName}:${slotId}:`;
}

function hasActiveSlotRequest(memory: ProjectMemoryShape, roomName: string, requestIdPrefix: string): boolean {
  const queue = memory.colonies[roomName]?.spawnQueue ?? [];

  return queue.some(request => request.id.indexOf(requestIdPrefix) === 0 && ACTIVE_REQUEST_STATUSES.indexOf(request.status) >= 0);
}

function removeTerminalSlotRequests(memory: ProjectMemoryShape, roomName: string, requestIdPrefix: string): void {
  const colony = memory.colonies[roomName];

  if (!colony) {
    return;
  }

  colony.spawnQueue = colony.spawnQueue.filter(request => {
    return request.id.indexOf(requestIdPrefix) !== 0 || ACTIVE_REQUEST_STATUSES.indexOf(request.status) >= 0;
  });
}

function calculateTargetPopulation(context: ColonyContext): number {
  if (!context.stage.hasSpawn || !context.stage.hasSource || !context.stage.hasController) {
    return 0;
  }

  return Math.min(4, Math.max(2, context.stage.sourceCount + 1));
}
