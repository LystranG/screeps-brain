import { CommandEffect, CommandPath } from "constants/commands";
import { CommandNamespaceDefinition, CommandResult } from "commands/types";
import { validateDumpPath } from "commands/arguments";

export function createDebugNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.debug,
    summary: "Debug inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "stats",
        signature: "cmd.debug.stats()",
        description: "Show Memory.stats CPU stage summaries.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const stats = context.memory.stats;
          const stageSummaries = Object.keys(stats.cpu.stages).map(stageName => {
            const stage = stats.cpu.stages[stageName];

            return (
              `${stageName} last=${stage.last} average=${stage.average} max=${stage.max} samples=${stage.samples}`
            );
          });
          const stages = stageSummaries.length > 0 ? stageSummaries.join("; ") : "none";

          return {
            ok: true,
            status: "OK",
            message: `debug stats: ticks=${stats.ticks} cpuAvailable=${String(stats.cpu.available)} stages=${stages}`,
            effect: CommandEffect.readOnly
          };
        }
      },
      {
        name: "observability",
        signature: "cmd.debug.observability()",
        description: "Show observability configuration summary.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const observability = context.memory.config.observability;

          return {
            ok: true,
            status: "OK",
            message:
              `debug observability: logLevel=${observability.logLevel} ` +
              `profilerEnabled=${String(observability.profiler.enabled)} ` +
              `deepProfilerEnabled=${String(observability.deepProfiler.enabled)} ` +
              `enabledNamespaces=${Object.keys(observability.enabledNamespaces).length} ` +
              `namespaceSampling=${Object.keys(observability.namespaceSampling).length}`,
            effect: CommandEffect.readOnly
          };
        }
      },
      {
        name: "dump",
        signature: "cmd.debug.dump(path, maxLength?)",
        description:
          "Dump whitelisted Memory path: Memory.runtime, Memory.config, Memory.stats, or Memory.commands.",
        effect: CommandEffect.readOnly,
        run: (args, context): CommandResult => dumpMemory(args, context.memory)
      }
    ]
  };
}

function dumpMemory(args: readonly unknown[], memory: Memory): CommandResult {
  const pathValidation = validateDumpPath(args[0]);

  if (!pathValidation.ok) {
    return debugError(pathValidation.reason);
  }

  const maxLength = parseMaxLength(args[1]);

  if (maxLength === null) {
    return debugError("maxLength must be an integer from 1 through 2000");
  }

  const json = JSON.stringify(readDumpValue(memory, pathValidation.value));
  const truncated = json.length > maxLength ? `${json.slice(0, maxLength)}...` : json;

  return {
    ok: true,
    status: "OK",
    message: `debug dump ${pathValidation.value}: ${truncated}`,
    effect: CommandEffect.readOnly
  };
}

function parseMaxLength(value: unknown): number | null {
  if (value === undefined) {
    return 500;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }

  if (value < 1 || value > 2000) {
    return null;
  }

  return value;
}

function readDumpValue(memory: Memory, path: "Memory.runtime" | "Memory.config" | "Memory.stats" | "Memory.commands"): unknown {
  switch (path) {
    case "Memory.runtime":
      return memory.runtime;
    case "Memory.config":
      return memory.config;
    case "Memory.stats":
      return memory.stats;
    case "Memory.commands":
      return memory.commands;
    default:
      return undefined;
  }
}

function debugError(message: string): CommandResult {
  return {
    ok: false,
    status: "ERR",
    message,
    effect: CommandEffect.readOnly
  };
}
