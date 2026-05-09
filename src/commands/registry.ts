// 命令注册表：路由 namespace.command 路径到对应 handler，返回结构化结果。
import { CommandContext, CommandNamespaceDefinition, CommandRegistry, CommandResult } from "commands/types";
import { CommandEffect } from "constants/commands";
import { createSimNamespace } from "commands/namespaces/sim";

function errorResult(message: string): CommandResult {
  return {
    ok: false,
    status: "ERR",
    message,
    effect: CommandEffect.readOnly
  };
}

export function createCommandRegistry(namespaces: readonly CommandNamespaceDefinition[]): CommandRegistry {
  return {
    execute(path: readonly string[], args: readonly unknown[], context: CommandContext): CommandResult {
      const namespaceName = path[0];
      const commandName = path[1];

      if (namespaceName === undefined) {
        return errorResult("Unknown command namespace: ");
      }

      const namespace = namespaces.find(candidate => candidate.name === namespaceName);

      if (namespace === undefined) {
        return errorResult(`Unknown command namespace: ${namespaceName}`);
      }

      if (commandName === undefined) {
        return errorResult(`Unknown command: ${namespaceName}`);
      }

      const command = namespace.commands.find(candidate => candidate.name === commandName);

      if (command === undefined) {
        return errorResult(`Unknown command: ${namespaceName}.${commandName}`);
      }

      return command.run(args, context);
    },

    getNamespace(name: string): CommandNamespaceDefinition | undefined {
      return namespaces.find(namespace => namespace.name === name);
    },

    listNamespaces(): readonly CommandNamespaceDefinition[] {
      return namespaces;
    }
  };
}

export function createDefaultCommandRegistry(): CommandRegistry {
  return createCommandRegistry([
    createSimNamespace()
  ]);
}
