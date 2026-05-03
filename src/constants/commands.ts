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
