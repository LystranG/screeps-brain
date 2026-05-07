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
  const selected = selectNextSpawnRequestByStatus(contexts, memory, ["queued", "waiting"]);

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
  const reconciled = reconcileVisibleBootstrapCreeps(contexts, memory, game, tick);

  if (reconciled) {
    return reconciled;
  }

  const selected = selectNextSpawnRequestByStatus(contexts, memory, "spawning");

  if (!selected || !selected.request.creepName) {
    return null;
  }

  if (!game.creeps[selected.request.creepName]) {
    if (isSpawnStillCreatingRequest(selected, game)) {
      return {
        ok: false,
        status: "waiting",
        reason: "spawn still creating creep",
        roomName: selected.context.roomName,
        requestId: selected.request.id,
        spawnName: selected.request.spawnName ?? undefined
      };
    }

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

function reconcileVisibleBootstrapCreeps(
  contexts: ColonyContext[],
  memory: ProjectMemoryShape,
  game: Game,
  tick: number
): SpawnValidationResult | null {
  const contextByRoomName = new Map(contexts.map(context => [context.roomName, context]));

  for (const colony of Object.values(memory.colonies)) {
    const context = contextByRoomName.get(colony.roomName);

    if (!context) {
      continue;
    }

    for (const request of colony.spawnQueue) {
      if (!isActiveSpawnRequestStatus(request.status)) {
        continue;
      }

      const matchedCreep = findVisibleCreepForRequest(request.id, game.creeps);

      if (!matchedCreep) {
        continue;
      }

      const spawnName = request.spawnName ?? inferSpawnName(context);

      if (matchedCreep.creep.spawning === true) {
        markSpawnRequestSpawning(memory, request.roomName, request.id, spawnName ?? "", matchedCreep.name, tick);

        if (!spawnName) {
          request.spawnName = null;
        }

        return {
          ok: true,
          status: "spawning",
          reason: "spawning creep matched spawn request id",
          roomName: request.roomName,
          requestId: request.id,
          spawnName: request.spawnName ?? undefined
        };
      }

      request.creepName = matchedCreep.name;
      request.spawnName = spawnName;
      markSpawnRequestSpawned(memory, request.roomName, request.id, tick);

      return {
        ok: true,
        status: "spawned",
        reason: "visible creep matched spawn request id",
        roomName: request.roomName,
        requestId: request.id,
        spawnName: request.spawnName ?? undefined
      };
    }
  }

  return null;
}

function isActiveSpawnRequestStatus(status: SelectedSpawnRequest["request"]["status"]): boolean {
  return status === "queued" || status === "waiting" || status === "validated" || status === "spawning";
}

function findVisibleCreepForRequest(
  requestId: string,
  creeps: Game["creeps"] | undefined
): { name: string; creep: Creep } | null {
  if (!creeps) {
    return null;
  }

  const safeRequestId = sanitizeSpawnNameSegment(requestId);

  for (const creepName of Object.keys(creeps)) {
    if (creepName.indexOf(safeRequestId) >= 0) {
      return {
        name: creepName,
        creep: creeps[creepName]
      };
    }
  }

  return null;
}

function inferSpawnName(context: ColonyContext): string | null {
  if (context.spawns.length === 1) {
    return context.spawns[0].name;
  }

  const spawningSpawn = context.spawns.find(spawn => spawn.spawning);

  return spawningSpawn?.name ?? null;
}

function isSpawnStillCreatingRequest(selected: SelectedSpawnRequest, game: Game): boolean {
  if (!selected.request.spawnName || !selected.request.creepName) {
    return false;
  }

  const spawn =
    game.spawns?.[selected.request.spawnName] ??
    selected.context.spawns.find(candidate => candidate.name === selected.request.spawnName);

  return spawn?.spawning?.name === selected.request.creepName;
}

function findIdleSpawn(context: ColonyContext): StructureSpawn | null {
  return context.spawns.find(spawn => !spawn.spawning) ?? null;
}

function createDryRunName(selected: SelectedSpawnRequest, tick: number): string {
  return createSpawnName(selected, tick);
}

function createSpawnName(selected: SelectedSpawnRequest, tick: number): string {
  const rawName = `bootstrap-${selected.request.role}-${selected.context.roomName}-${tick}-${selected.request.id}`;

  return sanitizeSpawnNameSegment(rawName).slice(0, 100);
}

function sanitizeSpawnNameSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function isRecoverableSpawnCode(code: ScreepsReturnCode): boolean {
  return code === ERR_BUSY || code === ERR_NOT_ENOUGH_ENERGY;
}

function isFatalSpawnCode(code: ScreepsReturnCode): boolean {
  return code === ERR_NAME_EXISTS || code === ERR_INVALID_ARGS || code === ERR_RCL_NOT_ENOUGH || code === ERR_NOT_OWNER;
}
