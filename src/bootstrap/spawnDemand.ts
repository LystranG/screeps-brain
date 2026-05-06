import { BootstrapSlot } from "bootstrap/slots";
import { ColonyContext } from "colony/types";
import { ProjectMemoryShape, SpawnRequestMemory } from "memory/schema";
import { createSpawnRequest, enqueueSpawnRequest } from "spawning/queue";

const ACTIVE_REQUEST_STATUSES: ReadonlyArray<SpawnRequestMemory["status"]> = ["queued", "validated", "spawning"];

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

  for (const slot of slots) {
    if (slot.spawn === null) {
      summary.skipped += 1;
      continue;
    }

    const requestId = createBootstrapRequestId(context.roomName, slot.id, slot.spawn.role);

    if (hasActiveRequest(memory, context.roomName, requestId)) {
      summary.duplicate += 1;
      continue;
    }

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

function hasActiveRequest(memory: ProjectMemoryShape, roomName: string, requestId: string): boolean {
  const queue = memory.colonies[roomName]?.spawnQueue ?? [];

  return queue.some(request => request.id === requestId && ACTIVE_REQUEST_STATUSES.indexOf(request.status) >= 0);
}
