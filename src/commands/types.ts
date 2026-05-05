import { CommandEffect, CommandStatusPrefix } from "constants/commands";

export type CommandStatus = CommandStatusPrefix;
export type CommandEffectLevel = CommandEffect;

export interface CommandResult {
  ok: boolean;
  status: CommandStatus;
  message: string;
  effect: CommandEffectLevel;
}

export interface CommandContext {
  game: Game;
  memory: Memory;
}

export interface CommandDefinition {
  name: string;
  signature: string;
  description: string;
  effect: CommandEffectLevel;
  run(args: readonly unknown[], context: CommandContext): CommandResult;
}

export interface CommandNamespaceDefinition {
  name: string;
  summary: string;
  effect: CommandEffectLevel;
  commands: readonly CommandDefinition[];
}

export interface ConsoleCommandNamespace {
  help(): string;
  [commandName: string]: ((...args: unknown[]) => string) | (() => string);
}

export interface ConsoleCommandTree {
  help(): string;
  [namespaceName: string]: ConsoleCommandNamespace | (() => string);
}

export interface CommandRegistry {
  execute(path: readonly string[], args: readonly unknown[], context: CommandContext): CommandResult;
  getNamespace(name: string): CommandNamespaceDefinition | undefined;
  listNamespaces(): readonly CommandNamespaceDefinition[];
}
