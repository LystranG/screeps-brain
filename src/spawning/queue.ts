import { ColonyMemory, ProjectMemoryShape, SpawnRequestMemory, createDefaultStrategyPlanMemory } from "memory/schema";
import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";
import { calculateBodyCost } from "spawning/bodyBuilder";

export const MAX_VALIDATION_ATTEMPTS = 3;

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

export interface SpawnQueueStatus {
  hasQueuedRequest: boolean;
  hasQueuedRequestWithIdleSpawn: boolean;
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
  const contextByRoomName = createContextByRoomName(contexts);
  const candidates: SelectedSpawnRequest[] = [];

  for (const colony of Object.values(memory.colonies)) {
    const context = contextByRoomName.get(colony.roomName);

    if (!context) {
      continue;
    }

    const queue = Array.isArray(colony.spawnQueue) ? colony.spawnQueue : [];

    for (const request of queue) {
      if (request.status === "queued" && isUsableSpawnCandidate(context, request)) {
        candidates.push({ context, request });
      }
    }
  }

  candidates.sort((left, right) => compareSelectedSpawnRequests(left, right, memory.config.colony.primaryRoomName));

  return candidates[0] ?? null;
}

export function inspectSpawnQueueStatus(contexts: ColonyContext[], memory: ProjectMemoryShape): SpawnQueueStatus {
  const contextByRoomName = createContextByRoomName(contexts);
  let hasQueuedRequest = false;
  let hasQueuedRequestWithIdleSpawn = false;

  for (const colony of Object.values(memory.colonies)) {
    const context = contextByRoomName.get(colony.roomName);

    if (!context) {
      continue;
    }

    const queue = Array.isArray(colony.spawnQueue) ? colony.spawnQueue : [];

    for (const request of queue) {
      if (request.status !== "queued") {
        continue;
      }

      hasQueuedRequest = true;
      hasQueuedRequestWithIdleSpawn = hasQueuedRequestWithIdleSpawn || hasIdleSpawn(context);
    }
  }

  return {
    hasQueuedRequest,
    hasQueuedRequestWithIdleSpawn
  };
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

  request.attempts += 1;
  request.lastError = error;
  request.requestedTick = tick;
  request.status = request.attempts >= MAX_VALIDATION_ATTEMPTS ? "failed" : "queued";

  return {
    ok: true,
    request
  };
}

function isUsableSpawnCandidate(context: ColonyContext, request: SpawnRequestMemory): boolean {
  if (context.readiness !== "ready") {
    return false;
  }

  if (!hasIdleSpawn(context)) {
    return false;
  }

  return calculateBodyCost(request.body) <= context.energy.spawnCapacity;
}

function createContextByRoomName(contexts: ColonyContext[]): Map<string, ColonyContext> {
  const contextByRoomName = new Map<string, ColonyContext>();

  for (const context of contexts) {
    contextByRoomName.set(context.roomName, context);
  }

  return contextByRoomName;
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

  const readinessOrder = readinessRank(left.context.readiness) - readinessRank(right.context.readiness);

  if (readinessOrder !== 0) {
    return readinessOrder;
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

function readinessRank(readiness: ColonyContext["readiness"]): number {
  if (readiness === "ready") {
    return 0;
  }

  if (readiness === "degraded") {
    return 1;
  }

  return 2;
}

function hasIdleSpawn(context: ColonyContext): boolean {
  return context.spawns.some(spawn => !spawn.spawning);
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
    spawnQueue: [],
    strategy: createDefaultStrategyPlanMemory(roomName, "spawnQueue")
  };

  return memory.colonies[roomName];
}
