import { buildColonyContexts } from "colony/context";
import { ColonyContext } from "colony/types";
import { CommandContext, CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect, CommandPath } from "constants/commands";
import { RoleName } from "constants/roles";
import { SpawnRequestMemory } from "memory/schema";
import { buildBody } from "spawning/bodyBuilder";

const DefaultRole: RoleName = "worker";
const RoleNames: readonly RoleName[] = ["worker", "harvester", "upgrader", "builder"];

export function createSpawnNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.spawn,
    summary: "Read-only spawn queue and dry-run inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.spawn.status()",
        description: "Show spawn queue counts by colony and current idle/busy spawn counts.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const contexts = inspectContexts(context);
          const queueLines = Object.keys(context.memory.colonies)
            .sort()
            .map(roomName => formatQueueCounts(roomName, context.memory.colonies[roomName].spawnQueue));
          const spawnCounts = countSpawns(contexts);

          return okResult(
            `spawn status: ${queueLines.length === 0 ? "queues=none" : queueLines.join("; ")} ` +
              `spawns=idle:${spawnCounts.idle} busy:${spawnCounts.busy}`
          );
        }
      },
      {
        name: "queue",
        signature: "cmd.spawn.queue()",
        description: "Show top queued spawn request details without changing queue state.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const request = selectTopQueuedRequest(context.memory);

          if (request === null) {
            return okResult("spawn queue: none");
          }

          return okResult(
            `spawn queue: id=${request.id} room=${request.roomName} role=${request.role} ` +
              `priority=${request.priority} status=${request.status} attempts=${request.attempts} reason=${request.reason}`
          );
        }
      },
      {
        name: "dryRun",
        signature: "cmd.spawn.dryRun(room?, role?, energy?)",
        description: "Build a body and validate spawnCreep with dryRun: true only.",
        effect: CommandEffect.readOnly,
        run: (args, context): CommandResult => {
          const contexts = inspectContexts(context);
          const roomResult = resolveRoomName(args[0], contexts);

          if (!roomResult.ok) {
            return errorResult(roomResult.error);
          }

          const roleResult = resolveRole(args[1]);

          if (!roleResult.ok) {
            return errorResult(roleResult.error);
          }

          const colony = contexts.find(candidate => candidate.roomName === roomResult.roomName);

          if (colony === undefined) {
            return errorResult(`colony context not found for room ${roomResult.roomName}`);
          }

          const energyResult = resolveEnergy(args[2], colony);

          if (!energyResult.ok) {
            return errorResult(energyResult.error);
          }

          return dryRunSpawn(colony, roleResult.role, energyResult.energy);
        }
      }
    ]
  };
}

function inspectContexts(context: CommandContext): ColonyContext[] {
  // 只读 spawn 命令可重建当前 tick context，但不能持久化 primary 或 intel。
  return buildColonyContexts(context.memory, context.game, context.game.time, {
    persistPrimary: false,
    persistIntel: false
  }).contexts;
}

function okResult(message: string): CommandResult {
  return {
    ok: true,
    status: "OK",
    message,
    effect: CommandEffect.readOnly
  };
}

function errorResult(message: string): CommandResult {
  return {
    ok: false,
    status: "ERR",
    message,
    effect: CommandEffect.readOnly
  };
}

function formatQueueCounts(roomName: string, queue: SpawnRequestMemory[]): string {
  const queued = queue.filter(request => request.status === "queued").length;
  const blocked = queue.filter(request => request.status === "blocked").length;
  const validated = queue.filter(request => request.status === "validated").length;
  const failed = queue.filter(request => request.status === "failed").length;

  return `${roomName}:queued=${queued} blocked=${blocked} validated=${validated} failed=${failed}`;
}

function countSpawns(contexts: ColonyContext[]): { idle: number; busy: number } {
  let idle = 0;
  let busy = 0;

  for (const colony of contexts) {
    for (const spawn of colony.spawns) {
      if (spawn.spawning) {
        busy += 1;
      } else {
        idle += 1;
      }
    }
  }

  return { idle, busy };
}

function selectTopQueuedRequest(memory: Memory): SpawnRequestMemory | null {
  const requests: SpawnRequestMemory[] = [];

  for (const colony of Object.values(memory.colonies)) {
    for (const request of colony.spawnQueue) {
      if (request.status === "queued") {
        requests.push(request);
      }
    }
  }

  requests.sort(compareSpawnRequests);

  return requests[0] ?? null;
}

function compareSpawnRequests(left: SpawnRequestMemory, right: SpawnRequestMemory): number {
  const priorityOrder = left.priority - right.priority;

  if (priorityOrder !== 0) {
    return priorityOrder;
  }

  const tickOrder = left.requestedTick - right.requestedTick;

  if (tickOrder !== 0) {
    return tickOrder;
  }

  return left.id.localeCompare(right.id);
}

function resolveRoomName(
  input: unknown,
  contexts: readonly ColonyContext[]
): { ok: true; roomName: string } | { ok: false; error: string } {
  if (input === undefined) {
    const primary = contexts.find(context => context.primary);

    return {
      ok: true,
      roomName: primary?.roomName ?? contexts[0]?.roomName ?? ""
    };
  }

  if (typeof input !== "string" || input.trim().length === 0) {
    return {
      ok: false,
      error: "room must be a non-empty string"
    };
  }

  return {
    ok: true,
    roomName: input.trim()
  };
}

function resolveRole(input: unknown): { ok: true; role: RoleName } | { ok: false; error: string } {
  if (input === undefined) {
    return {
      ok: true,
      role: DefaultRole
    };
  }

  if (typeof input !== "string" || !isRoleName(input)) {
    return {
      ok: false,
      error: `role must be one of ${RoleNames.join(",")}`
    };
  }

  return {
    ok: true,
    role: input
  };
}

function isRoleName(input: string): input is RoleName {
  return (RoleNames as readonly string[]).indexOf(input) >= 0;
}

function resolveEnergy(
  input: unknown,
  colony: ColonyContext
): { ok: true; energy: number } | { ok: false; error: string } {
  if (input === undefined) {
    return {
      ok: true,
      energy: colony.energy.available
    };
  }

  if (typeof input !== "number" || !Number.isInteger(input) || input < 0) {
    return {
      ok: false,
      error: "energy must be a non-negative integer"
    };
  }

  return {
    ok: true,
    energy: input
  };
}

function dryRunSpawn(colony: ColonyContext, role: RoleName, energy: number): CommandResult {
  const body = buildBody({
    role,
    intent: role === "harvester" ? "harvest" : role === "builder" ? "build" : role === "upgrader" ? "upgrade" : "balanced",
    energyBudget: energy
  });

  if (!body.ok) {
    return okResult(`spawn dryRun ${colony.roomName} ${role}: body=none cost=0 returnCode=none reason=${body.reason}`);
  }

  const spawn = colony.spawns.find(candidate => !candidate.spawning);

  if (spawn === undefined) {
    return okResult(
      `spawn dryRun ${colony.roomName} ${role}: body=${body.body.join(",")} cost=${body.cost} ` +
        "returnCode=none reason=no idle spawn in colony"
    );
  }

  const returnCode = spawn.spawnCreep(body.body, `dryRun-${role}-${colony.roomName}`, {
    memory: { role },
    dryRun: true
  });

  return okResult(
    `spawn dryRun ${colony.roomName} ${role}: body=${body.body.join(",")} cost=${body.cost} ` +
      `returnCode=${returnCode} reason=${body.reason}`
  );
}
