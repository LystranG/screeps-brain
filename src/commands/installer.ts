import { CommandRegistry, ConsoleCommandNamespace, ConsoleCommandTree } from "commands/types";
import { formatCommandResult, renderNamespaceHelp, renderRootHelp } from "commands/formatter";
import { COMMAND_API_VERSION } from "constants/commands";
import { createDefaultCommandRegistry } from "commands/registry";

export {};

declare global {
  // Screeps 会复用同一个 global VM；公开命令必须通过版本号替换旧闭包。
  const cmd: ConsoleCommandTree | undefined;
}

interface CommandGlobalState {
  cmd?: ConsoleCommandTree;
  __cmdApiVersion?: number;
}

const commandApiVersionKey = "__cmdApiVersion";

/**
 * 安装 Screeps 控制台入口；同版本直接复用，避免每 tick 重建命令树。
 */
export function installConsoleCommands(): void {
  const globalState = global as unknown as CommandGlobalState;

  // 字段名固定为计划约定的 __cmdApiVersion，使用索引访问避免 lint 误判为私有成员。
  if (globalState.cmd !== undefined && globalState[commandApiVersionKey] === COMMAND_API_VERSION) {
    return;
  }

  globalState.cmd = createConsoleCommandTree(createDefaultCommandRegistry());
  globalState[commandApiVersionKey] = COMMAND_API_VERSION;
}

function createConsoleCommandTree(registry: CommandRegistry): ConsoleCommandTree {
  return {
    help: () => renderRootHelp(registry.listNamespaces()),
    env: createNamespaceCommandTree(registry, "env", ["status"]),
    sim: createNamespaceCommandTree(registry, "sim", ["status", "guidance"]),
    config: createNamespaceCommandTree(registry, "config", [
      "logLevel",
      "profiler",
      "namespaceSampling",
      "namespaceEnabled",
      "construction",
      "defense",
      "deepProfiler",
      "allowExpansion",
      "allowRemoteMining"
    ]),
    debug: createNamespaceCommandTree(registry, "debug", ["stats", "observability", "dump"]),
    colony: createNamespaceCommandTree(registry, "colony", ["status"]),
    strategy: createNamespaceCommandTree(registry, "strategy", ["status"]),
    spawn: createNamespaceCommandTree(registry, "spawn", ["status"])
  };
}

function createNamespaceCommandTree(
  registry: CommandRegistry,
  namespaceName: string,
  commandNames: readonly string[]
): ConsoleCommandNamespace {
  const namespaceTree: ConsoleCommandNamespace = {
    help: () => {
      const namespace = registry.getNamespace(namespaceName);

      if (namespace === undefined) {
        return formatCommandResult(registry.execute([namespaceName, "help"], [], createCommandContext()));
      }

      return renderNamespaceHelp(namespace);
    }
  };

  for (const commandName of commandNames) {
    namespaceTree[commandName] = (...args: unknown[]): string => {
      return formatCommandResult(registry.execute([namespaceName, commandName], args, createCommandContext()));
    };
  }

  return namespaceTree;
}

function createCommandContext() {
  return {
    game: Game,
    memory: Memory
  };
}
