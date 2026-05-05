import { ColonyContext } from "colony/types";
import { ProjectMemoryShape } from "memory/schema";
import {
  markSpawnRequestError,
  markSpawnRequestValidated,
  SelectedSpawnRequest,
  selectNextSpawnRequest
} from "spawning/queue";

export interface SpawnValidationResult {
  ok: boolean;
  status: "validated" | "error" | "skipped";
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
  void game;

  const selected = selectNextSpawnRequest(contexts, memory);

  if (!selected) {
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

  // Phase 4 只验证队列请求，不消费队列或创建真实 creep；真实创建留给后续 bootstrap 行为。
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

function findIdleSpawn(context: ColonyContext): StructureSpawn | null {
  return context.spawns.find(spawn => !spawn.spawning) ?? null;
}

function createDryRunName(selected: SelectedSpawnRequest, tick: number): string {
  return `${selected.request.role}-${selected.context.roomName}-${tick}-${selected.request.id}`;
}
