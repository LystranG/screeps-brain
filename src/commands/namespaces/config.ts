import { CommandContext, CommandDefinition, CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect, CommandPath } from "constants/commands";
import { validateBooleanArgument, validateConfirmToken, validateSamplingRate } from "commands/arguments";
import { validateLogLevel } from "validation/runtime";

function okResult(message: string, effect: CommandEffect = CommandEffect.writesMemory): CommandResult {
  return {
    ok: true,
    status: "OK",
    message,
    effect
  };
}

function errorResult(message: string, effect: CommandEffect = CommandEffect.writesMemory): CommandResult {
  return {
    ok: false,
    status: "ERR",
    message,
    effect
  };
}

function confirmResult(message: string): CommandResult {
  return {
    ok: false,
    status: "CONFIRM",
    message,
    effect: CommandEffect.requiresConfirm
  };
}

function validateNamespace(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const namespace = value.trim();

  return namespace.length > 0 ? namespace : null;
}

function createLogLevelCommand(): CommandDefinition {
  return {
    name: "logLevel",
    signature: "cmd.config.logLevel(level)",
    description: "Update Memory.config.observability.logLevel.",
    effect: CommandEffect.writesMemory,
    run(args: readonly unknown[], context: CommandContext): CommandResult {
      const level = args[0];

      if (typeof level !== "string") {
        return errorResult("Log level must be one of: debug, info, warn, error");
      }

      const validation = validateLogLevel(level);

      if (!validation.ok) {
        return errorResult(validation.reason);
      }

      const previous = context.memory.config.observability.logLevel;
      context.memory.config.observability.logLevel = validation.value;

      return okResult(`logLevel: ${previous} -> ${validation.value}`);
    }
  };
}

function createProfilerCommand(): CommandDefinition {
  return {
    name: "profiler",
    signature: "cmd.config.profiler(enabled)",
    description: "Toggle Memory.config.observability.profiler.enabled.",
    effect: CommandEffect.writesMemory,
    run(args: readonly unknown[], context: CommandContext): CommandResult {
      const validation = validateBooleanArgument(args[0]);

      if (!validation.ok) {
        return errorResult(validation.reason);
      }

      const previous = context.memory.config.observability.profiler.enabled;
      context.memory.config.observability.profiler.enabled = validation.value;

      return okResult(`profiler: ${String(previous)} -> ${String(validation.value)}`);
    }
  };
}

function createNamespaceSamplingCommand(): CommandDefinition {
  return {
    name: "namespaceSampling",
    signature: "cmd.config.namespaceSampling(namespace, rate)",
    description: "Set Memory.config.observability.namespaceSampling[namespace] to rate.",
    effect: CommandEffect.writesMemory,
    run(args: readonly unknown[], context: CommandContext): CommandResult {
      const namespace = validateNamespace(args[0]);

      if (namespace === null) {
        return errorResult("Namespace must be a non-empty string");
      }

      const validation = validateSamplingRate(args[1]);

      if (!validation.ok) {
        return errorResult(validation.reason);
      }

      const previous = context.memory.config.observability.namespaceSampling[namespace];
      context.memory.config.observability.namespaceSampling[namespace] = validation.value;

      return okResult(`namespaceSampling.${namespace}: ${previous ?? "unset"} -> ${validation.value}`);
    }
  };
}

function createNamespaceEnabledCommand(): CommandDefinition {
  return {
    name: "namespaceEnabled",
    signature: "cmd.config.namespaceEnabled(namespace, enabled)",
    description: "Set Memory.config.observability.enabledNamespaces[namespace].enabled.",
    effect: CommandEffect.writesMemory,
    run(args: readonly unknown[], context: CommandContext): CommandResult {
      const namespace = validateNamespace(args[0]);

      if (namespace === null) {
        return errorResult("Namespace must be a non-empty string");
      }

      const validation = validateBooleanArgument(args[1]);

      if (!validation.ok) {
        return errorResult(validation.reason);
      }

      const previous = context.memory.config.observability.enabledNamespaces[namespace]?.enabled;
      context.memory.config.observability.enabledNamespaces[namespace] = {
        ...context.memory.config.observability.enabledNamespaces[namespace],
        enabled: validation.value
      };

      return okResult(`namespaceEnabled.${namespace}: ${previous === undefined ? "unset" : String(previous)} -> ${String(validation.value)}`);
    }
  };
}

function createManualToggleCommand(
  name: "construction" | "defense",
  signature: string,
  getValue: (context: CommandContext) => boolean,
  setValue: (context: CommandContext, value: boolean) => void
): CommandDefinition {
  return {
    name,
    signature,
    description: `Toggle Memory.config.${name}.enabled.`,
    effect: CommandEffect.writesMemory,
    run(args: readonly unknown[], context: CommandContext): CommandResult {
      const validation = validateBooleanArgument(args[0]);

      if (!validation.ok) {
        return errorResult(validation.reason);
      }

      const previous = getValue(context);
      setValue(context, validation.value);

      return okResult(`${name}: ${String(previous)} -> ${String(validation.value)}`);
    }
  };
}

function createConfirmedToggleCommand(
  name: "deepProfiler" | "allowExpansion" | "allowRemoteMining",
  signature: string,
  confirmMessage: string,
  getValue: (context: CommandContext) => boolean,
  setValue: (context: CommandContext, value: boolean) => void
): CommandDefinition {
  return {
    name,
    signature,
    description: `Toggle ${name} after explicit CONFIRM.`,
    effect: CommandEffect.requiresConfirm,
    run(args: readonly unknown[], context: CommandContext): CommandResult {
      const validation = validateBooleanArgument(args[0]);

      if (!validation.ok) {
        return errorResult(validation.reason, CommandEffect.requiresConfirm);
      }

      const confirmation = validateConfirmToken(args[1]);

      if (!confirmation.ok) {
        return confirmResult(confirmMessage);
      }

      const previous = getValue(context);
      setValue(context, validation.value);

      return okResult(`${name}: ${String(previous)} -> ${String(validation.value)}`, CommandEffect.requiresConfirm);
    }
  };
}

export function createConfigNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.config,
    summary: "Configuration mutation commands",
    effect: CommandEffect.writesMemory,
    commands: [
      createLogLevelCommand(),
      createProfilerCommand(),
      createNamespaceSamplingCommand(),
      createNamespaceEnabledCommand(),
      createManualToggleCommand(
        "construction",
        "cmd.config.construction(enabled)",
        context => context.memory.config.construction.enabled,
        (context, value) => {
          context.memory.config.construction.enabled = value;
        }
      ),
      createManualToggleCommand(
        "defense",
        "cmd.config.defense(enabled)",
        context => context.memory.config.defense.enabled,
        (context, value) => {
          context.memory.config.defense.enabled = value;
        }
      ),
      createConfirmedToggleCommand(
        "deepProfiler",
        "cmd.config.deepProfiler(enabled, confirm?)",
        "deepProfiler requires CONFIRM",
        context => context.memory.config.observability.deepProfiler.enabled,
        (context, value) => {
          context.memory.config.observability.deepProfiler.enabled = value;
        }
      ),
      createConfirmedToggleCommand(
        "allowExpansion",
        "cmd.config.allowExpansion(enabled, confirm?)",
        "allowExpansion requires CONFIRM",
        context => context.memory.config.strategy.allowExpansion,
        (context, value) => {
          context.memory.config.strategy.allowExpansion = value;
        }
      ),
      createConfirmedToggleCommand(
        "allowRemoteMining",
        "cmd.config.allowRemoteMining(enabled, confirm?)",
        "allowRemoteMining requires CONFIRM",
        context => context.memory.config.strategy.allowRemoteMining,
        (context, value) => {
          context.memory.config.strategy.allowRemoteMining = value;
        }
      )
    ]
  };
}
