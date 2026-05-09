// 命令系统常量：API 版本、命令路径、状态前缀、副作用级别。
export const COMMAND_API_VERSION = 1;

export const CommandPath = {
  help: "help",
  sim: "sim"
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
