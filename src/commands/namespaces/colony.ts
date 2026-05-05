import { buildColonyContexts } from "colony/context";
import { ColonyContext } from "colony/types";
import { CommandContext, CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect, CommandPath } from "constants/commands";
import { ProcessMemory } from "memory/schema";

interface ColonyInspectionSnapshot {
  contexts: ColonyContext[];
  primaryRoomName: string | null;
  errors: string[];
}

export function createColonyNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.colony,
    summary: "Read-only colony context inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.colony.status()",
        description: "Show colony readiness, primary room, degraded reasons, and process summary.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const snapshot = inspectColonies(context);
          const readyCount = snapshot.contexts.filter(colony => colony.readiness === "ready").length;
          const degradedCount = snapshot.contexts.filter(colony => colony.readiness === "degraded").length;
          const fields = [
            `primary=${snapshot.primaryRoomName ?? "none"}`,
            `contexts=${snapshot.contexts.length}`,
            `ready=${readyCount}`,
            `degraded=${degradedCount}`,
            `missing=${formatMissingReasons(snapshot.contexts)}`,
            `processes=${formatProcessSummary(context.memory.processes)}`
          ];

          if (snapshot.errors.length > 0) {
            fields.push(`errors=${snapshot.errors.join("|")}`);
          }

          return okResult(`colony status: ${fields.join(" ")}`);
        }
      },
      {
        name: "list",
        signature: "cmd.colony.list()",
        description: "List visible colony contexts with compact readiness and room facts.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const snapshot = inspectColonies(context);
          const lines = snapshot.contexts.map(formatListLine);

          return okResult(`colony list: ${lines.length === 0 ? "none" : lines.join("; ")}`);
        }
      },
      {
        name: "detail",
        signature: "cmd.colony.detail(room)",
        description: "Show detailed read-only status for one colony room.",
        effect: CommandEffect.readOnly,
        run: (args, context): CommandResult => {
          const roomName = args[0];

          if (typeof roomName !== "string" || roomName.trim().length === 0) {
            return errorResult("room must be a non-empty string");
          }

          const snapshot = inspectColonies(context);
          const colony = snapshot.contexts.find(candidate => candidate.roomName === roomName.trim());

          if (colony === undefined) {
            return errorResult(`colony context not found for room ${roomName.trim()}`);
          }

          return okResult(`colony detail ${colony.roomName}: ${formatDetail(colony)}`);
        }
      }
    ]
  };
}

function inspectColonies(context: CommandContext): ColonyInspectionSnapshot {
  // 控制台检查必须重建当前 tick 的 live context，但显式关闭持久化，避免只读命令改写 Memory。
  return buildColonyContexts(context.memory, context.game, context.game.time, {
    persistPrimary: false,
    persistIntel: false
  });
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

function formatMissingReasons(contexts: ColonyContext[]): string {
  const degraded = contexts.filter(colony => colony.missingReasons.length > 0);

  if (degraded.length === 0) {
    return "none";
  }

  return degraded.map(colony => `${colony.roomName}:${colony.missingReasons.join(",")}`).join("|");
}

function formatProcessSummary(processes: { [processId: string]: ProcessMemory }): string {
  const processIds = Object.keys(processes).sort();

  if (processIds.length === 0) {
    return "none";
  }

  return processIds
    .map(processId => {
      const process = processes[processId];
      const status = process.lastError === null ? "ok" : "error";
      const lastRunTick = process.lastRunTick === null ? "never" : String(process.lastRunTick);

      return `${processId}:${status}@${lastRunTick}->${process.nextRunTick}`;
    })
    .join(",");
}

function formatListLine(colony: ColonyContext): string {
  return [
    colony.roomName,
    colony.primary ? "primary" : "secondary",
    colony.readiness,
    `rcl=${colony.stage.rcl ?? "unknown"}`,
    `energy=${colony.energy.available}/${colony.energy.capacity}`,
    `sources=${colony.stage.sourceCount}`,
    `spawns=${colony.stage.spawnCount}`,
    `creeps=${colony.stage.creepCount}`,
    `sites=${colony.stage.constructionSiteCount}`,
    `hostiles=${colony.stage.hostileCount}`
  ].join(" ");
}

function formatDetail(colony: ColonyContext): string {
  const stage = colony.stage.rcl === null ? "unknown" : `rcl${colony.stage.rcl}`;
  const controller = colony.controller?.id ?? "none";
  const spawns = colony.spawns.map(spawn => spawn.name).join(",") || "none";
  const sources = colony.sources.map(source => source.id).join(",") || "none";
  const missing = colony.missingReasons.length === 0 ? "none" : colony.missingReasons.join(",");

  return [
    `primary=${colony.primary}`,
    `readiness=${colony.readiness}`,
    `stage=${stage}`,
    `controller=${controller}`,
    `energy=${colony.energy.available}/${colony.energy.capacity}`,
    `sources=${sources}`,
    `spawns=${spawns}`,
    `creeps=${colony.creeps.length}`,
    `sites=${colony.constructionSites.length}`,
    `hostiles=${colony.hostiles.length}`,
    `missing=${missing}`
  ].join(" ");
}
