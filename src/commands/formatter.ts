import { CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect } from "constants/commands";

export function formatCommandResult(result: CommandResult): string {
  return `${result.status} ${result.message}`;
}

export function renderRootHelp(namespaces: readonly CommandNamespaceDefinition[]): string {
  const lines = [
    "cmd.help()",
    ...namespaces.map(namespace => `cmd.${namespace.name}.help() [${namespace.effect}] ${namespace.summary}`)
  ];

  return lines.join("\n");
}

export function renderNamespaceHelp(namespace: CommandNamespaceDefinition): string {
  const lines = [`cmd.${namespace.name}.help() [${namespace.effect}] ${namespace.summary}`];

  for (const command of namespace.commands) {
    // Help 只读取定义元数据，避免公开命令树和文档说明发生漂移。
    lines.push(`${command.signature} [${command.effect}] ${command.description}`);
  }

  if (namespace.effect === CommandEffect.futureBlocked && namespace.commands.length === 0) {
    lines.push(`cmd.${namespace.name}.help() [future/blocked] Future namespace has no active commands.`);
  }

  return lines.join("\n");
}
