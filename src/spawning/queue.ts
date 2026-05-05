import { ColonyMemory, ProjectMemoryShape, SpawnRequestMemory } from "memory/schema";
import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";

export interface CreateSpawnRequestParams {
  id: string;
  roomName: string;
  role: RoleName;
  priority: number;
  body: BodyPartConstant[];
  memory: CreepMemory;
  reason: string;
  requestedTick: number;
}

export interface SpawnQueueResult {
  ok: boolean;
  request?: SpawnRequestMemory;
  error?: string;
}

export interface SelectedSpawnRequest {
  context: ColonyContext;
  request: SpawnRequestMemory;
}

export function createSpawnRequest(params: CreateSpawnRequestParams): SpawnRequestMemory {
  return {
    id: params.id,
    roomName: params.roomName,
    role: params.role,
    priority: params.priority,
    body: params.body,
    memory: params.memory,
    reason: params.reason,
    requestedTick: params.requestedTick,
    status: "queued",
    attempts: 0,
    lastError: null
  };
}

export function enqueueSpawnRequest(memory: ProjectMemoryShape, request: SpawnRequestMemory): SpawnQueueResult {
  const colony = ensureColony(memory, request.roomName);
  const duplicate = colony.spawnQueue.some(existingRequest => existingRequest.id === request.id);

  if (duplicate) {
    return {
      ok: false,
      error: `duplicate spawn request id: ${request.id}`
    };
  }

  colony.spawnQueue.push(request);

  return {
    ok: true,
    request
  };
}

export function selectNextSpawnRequest(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape
): SelectedSpawnRequest | null {
  const contextByRoomName = new Map<string, ColonyContext>();

  for (const context of contexts) {
    contextByRoomName.set(context.roomName, context);
  }

  const candidates: SelectedSpawnRequest[] = [];

  for (const colony of Object.values(memory.colonies)) {
    const context = contextByRoomName.get(colony.roomName);

    if (!context) {
      continue;
    }

    for (const request of colony.spawnQueue) {
      if (request.status === "queued") {
        candidates.push({ context, request });
      }
    }
  }

  candidates.sort((left, right) => compareSelectedSpawnRequests(left, right, memory.config.colony.primaryRoomName));

  return candidates[0] ?? null;
}

export function markSpawnRequestValidated(
  memory: ProjectMemoryShape,
  roomName: string,
  requestId: string,
  tick: number
): SpawnQueueResult {
  const request = findSpawnRequest(memory, roomName, requestId);

  if (!request) {
    return {
      ok: false,
      error: `spawn request not found: ${requestId}`
    };
  }

  request.status = "validated";
  request.lastError = null;
  request.requestedTick = tick;

  return {
    ok: true,
    request
  };
}

export function markSpawnRequestError(
  memory: ProjectMemoryShape,
  roomName: string,
  requestId: string,
  error: string,
  tick: number
): SpawnQueueResult {
  const request = findSpawnRequest(memory, roomName, requestId);

  if (!request) {
    return {
      ok: false,
      error: `spawn request not found: ${requestId}`
    };
  }

  request.status = "queued";
  request.attempts += 1;
  request.lastError = error;
  request.requestedTick = tick;

  return {
    ok: true,
    request
  };
}

function compareSelectedSpawnRequests(
  left: SelectedSpawnRequest,
  right: SelectedSpawnRequest,
  primaryRoomName: string | null
): number {
  const primaryOrder = primaryRank(left, primaryRoomName) - primaryRank(right, primaryRoomName);

  if (primaryOrder !== 0) {
    return primaryOrder;
  }

  const priorityOrder = left.request.priority - right.request.priority;

  if (priorityOrder !== 0) {
    return priorityOrder;
  }

  const tickOrder = left.request.requestedTick - right.request.requestedTick;

  if (tickOrder !== 0) {
    return tickOrder;
  }

  return left.request.id.localeCompare(right.request.id);
}

function primaryRank(selected: SelectedSpawnRequest, primaryRoomName: string | null): number {
  if (selected.context.primary || selected.context.roomName === primaryRoomName) {
    return 0;
  }

  return 1;
}

function findSpawnRequest(
  memory: ProjectMemoryShape,
  roomName: string,
  requestId: string
): SpawnRequestMemory | null {
  const queue = memory.colonies[roomName]?.spawnQueue ?? [];

  return queue.find(request => request.id === requestId) ?? null;
}

function ensureColony(memory: ProjectMemoryShape, roomName: string): ColonyMemory {
  if (memory.colonies[roomName]) {
    return memory.colonies[roomName];
  }

  memory.colonies[roomName] = {
    roomName,
    primary: memory.config.colony.primaryRoomName === roomName,
    status: "degraded",
    intel: {
      roomName,
      lastSeenTick: 0,
      lastRefreshTick: 0,
      status: "degraded",
      missingReasons: [],
      controllerId: null,
      rcl: null,
      sourceIds: [],
      spawnIds: [],
      primary: memory.config.colony.primaryRoomName === roomName,
      stage: "unknown"
    },
    spawnQueue: []
  };

  return memory.colonies[roomName];
}
