export const MemoryKey = {
  version: "version",
  runtime: "runtime",
  config: "config",
  colonies: "colonies",
  processes: "processes",
  commands: "commands",
  stats: "stats",
  creeps: "creeps"
} as const;

export type MemoryKey = typeof MemoryKey[keyof typeof MemoryKey];
