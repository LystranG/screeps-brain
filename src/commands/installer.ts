// 安装版本化的 Screeps 控制台命令入口 global.cmd；同版本复用，避免每 tick 重建。
import { CommandRegistry, ConsoleCommandNamespace, ConsoleCommandTree } from "commands/types";
import { formatCommandResult, renderNamespaceHelp, renderRootHelp } from "commands/formatter";
import { COMMAND_API_VERSION } from "constants/commands";
import { createDefaultCommandRegistry } from "commands/registry";

export {};

declare global {
  const cmd: ConsoleCommandTree | undefined;
}

interface CommandGlobalState {
  cmd?: ConsoleCommandTree;
  __cmdApiVersion?: number;
}

const commandApiVersionKey = "__cmdApiVersion";

export function installConsoleCommands(): void {
  const globalState = global as unknown as CommandGlobalState;

  if (globalState.cmd !== undefined && globalState[commandApiVersionKey] === COMMAND_API_VERSION) {
    return;
  }

  globalState.cmd = createConsoleCommandTree(createDefaultCommandRegistry());
  globalState[commandApiVersionKey] = COMMAND_API_VERSION;
}

function createConsoleCommandTree(registry: CommandRegistry): ConsoleCommandTree {
  return {
    help: () => renderRootHelp(registry.listNamespaces()),
    sim: createNamespaceCommandTree(registry, "sim", ["status", "guidance"])
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
