export const COMMAND_API_VERSION = 1;
export const COMMAND_HISTORY_LIMIT = 50;

export const CommandPath = {
  help: "help",
  env: "env",
  sim: "sim",
  colony: "colony",
  strategy: "strategy",
  config: "config",
  spawn: "spawn",
  debug: "debug"
} as const;

export type CommandPath = typeof CommandPath[keyof typeof CommandPath];

export const CommandStatusPrefix = {
  ok: "OK",
  err: "ERR",
  blocked: "BLOCKED",
  confirm: "CONFIRM",
  future: "FUTURE"
} as const;

export type CommandStatusPrefix = typeof CommandStatusPrefix[keyof typeof CommandStatusPrefix];

export const CommandEffect = {
  readOnly: "read-only",
  writesMemory: "writes-memory",
  requiresConfirm: "requires-confirm",
  futureBlocked: "future/blocked"
} as const;

export type CommandEffect = typeof CommandEffect[keyof typeof CommandEffect];
