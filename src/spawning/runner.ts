import {
  SelectedSpawnRequest,
  inspectSpawnQueueStatus,
  markSpawnRequestError,
  markSpawnRequestSpawned,
  markSpawnRequestSpawning,
  markSpawnRequestValidated,
  markSpawnRequestWaiting,
  selectNextSpawnRequestByStatus
} from "spawning/queue";
import { ColonyContext } from "colony/types";
import { ProjectMemoryShape } from "memory/schema";

export interface SpawnValidationResult {
  ok: boolean;
  status: "validated" | "spawning" | "spawned" | "waiting" | "failed" | "error" | "skipped";
  reason: string;
  roomName?: string;
  requestId?: string;
  spawnName?: string;
  returnCode?: ScreepsReturnCode;
}

export function runSpawnValidation(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape,
  game: Game,
  tick: number
): SpawnValidationResult {
  return runSpawnLifecycle(contexts, memory, game, tick);
}

export function runSpawnLifecycle(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape,
  game: Game,
  tick: number
): SpawnValidationResult {
  const completed = completeSpawnedRequests(contexts, memory, game, tick);

  if (completed) {
    return completed;
  }

  const realSpawn = runValidatedSpawn(contexts, memory, tick);

  if (realSpawn) {
    return realSpawn;
  }

  return runQueuedValidation(contexts, memory, tick);
}

function runQueuedValidation(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape,
  tick: number
): SpawnValidationResult {
  const selected = selectNextSpawnRequestByStatus(contexts, memory, "queued");

  if (!selected) {
    const queueStatus = inspectSpawnQueueStatus(contexts, memory);

    if (queueStatus.hasQueuedRequest && !queueStatus.hasQueuedRequestWithIdleSpawn) {
      return {
        ok: false,
        status: "skipped",
        reason: "no idle spawn in colony"
      };
    }

    return {
      ok: false,
      status: "skipped",
      reason: "no queued spawn request"
    };
  }

  const spawn = findIdleSpawn(selected.context);

  if (!spawn) {
    return {
      ok: false,
      status: "skipped",
      reason: "no idle spawn in colony",
      roomName: selected.context.roomName,
      requestId: selected.request.id
    };
  }

  // 队列先走官方 dryRun 验证，只有 validated 请求才允许进入真实 spawn 调用。
  const returnCode = spawn.spawnCreep(selected.request.body, createDryRunName(selected, tick), {
    memory: selected.request.memory,
    dryRun: true
  });

  if (returnCode === OK) {
    markSpawnRequestValidated(memory, selected.request.roomName, selected.request.id, tick);

    return {
      ok: true,
      status: "validated",
      reason: "dry-run spawn validation succeeded",
      roomName: selected.context.roomName,
      requestId: selected.request.id,
      spawnName: spawn.name,
      returnCode
    };
  }

  const error = String(returnCode);
  markSpawnRequestError(memory, selected.request.roomName, selected.request.id, error, tick);

  return {
    ok: false,
    status: "error",
    reason: error,
    roomName: selected.context.roomName,
    requestId: selected.request.id,
    spawnName: spawn.name,
    returnCode
  };
}

function runValidatedSpawn(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape,
  tick: number
): SpawnValidationResult | null {
  const selected = selectNextSpawnRequestByStatus(contexts, memory, "validated");

  if (!selected) {
    return null;
  }

  const spawn = findIdleSpawn(selected.context);

  if (!spawn) {
    return {
      ok: false,
      status: "skipped",
      reason: "no idle spawn in colony",
      roomName: selected.context.roomName,
      requestId: selected.request.id
    };
  }

  const creepName = createSpawnName(selected, tick);
  const returnCode = spawn.spawnCreep(selected.request.body, creepName, {
    memory: selected.request.memory
  });

  if (returnCode === OK) {
    markSpawnRequestSpawning(memory, selected.request.roomName, selected.request.id, spawn.name, creepName, tick);

    return {
      ok: true,
      status: "spawning",
      reason: "spawnCreep scheduled",
      roomName: selected.context.roomName,
      requestId: selected.request.id,
      spawnName: spawn.name,
      returnCode
    };
  }

  if (isRecoverableSpawnCode(returnCode)) {
    markSpawnRequestWaiting(memory, selected.request.roomName, selected.request.id, returnCode, tick);

    return {
      ok: false,
      status: "waiting",
      reason: String(returnCode),
      roomName: selected.context.roomName,
      requestId: selected.request.id,
      spawnName: spawn.name,
      returnCode
    };
  }

  if (isFatalSpawnCode(returnCode)) {
    markSpawnRequestError(memory, selected.request.roomName, selected.request.id, String(returnCode), tick);
    selected.request.status = "failed";
  } else {
    markSpawnRequestError(memory, selected.request.roomName, selected.request.id, String(returnCode), tick);
  }

  return {
    ok: false,
    status: "failed",
    reason: String(returnCode),
    roomName: selected.context.roomName,
    requestId: selected.request.id,
    spawnName: spawn.name,
    returnCode
  };
}

function completeSpawnedRequests(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape,
  game: Game,
  tick: number
): SpawnValidationResult | null {
  const selected = selectNextSpawnRequestByStatus(contexts, memory, "spawning");

  if (!selected || !selected.request.creepName) {
    return null;
  }

  if (!game.creeps[selected.request.creepName]) {
    return null;
  }

  markSpawnRequestSpawned(memory, selected.request.roomName, selected.request.id, tick);

  return {
    ok: true,
    status: "spawned",
    reason: "spawned creep is visible",
    roomName: selected.context.roomName,
    requestId: selected.request.id,
    spawnName: selected.request.spawnName ?? undefined
  };
}

function findIdleSpawn(context: ColonyContext): StructureSpawn | null {
  return context.spawns.find(spawn => !spawn.spawning) ?? null;
}

function createDryRunName(selected: SelectedSpawnRequest, tick: number): string {
  return createSpawnName(selected, tick);
}

function createSpawnName(selected: SelectedSpawnRequest, tick: number): string {
  const rawName = `bootstrap-${selected.request.role}-${selected.context.roomName}-${tick}-${selected.request.id}`;

  return rawName.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
}

function isRecoverableSpawnCode(code: ScreepsReturnCode): boolean {
  return code === ERR_BUSY || code === ERR_NOT_ENOUGH_ENERGY;
}

function isFatalSpawnCode(code: ScreepsReturnCode): boolean {
  return code === ERR_NAME_EXISTS || code === ERR_INVALID_ARGS || code === ERR_RCL_NOT_ENOUGH || code === ERR_NOT_OWNER;
}
