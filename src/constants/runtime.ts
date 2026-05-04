export const ShardName = {
  sim: "sim",
  shard0: "shard0",
  shard1: "shard1",
  shard2: "shard2",
  shard3: "shard3",
  private: "private",
  unknown: "unknown"
} as const;

export type ShardName = typeof ShardName[keyof typeof ShardName];

export const RuntimeEnvironment = {
  sim: "sim",
  world: "world",
  private: "private",
  unknown: "unknown"
} as const;

export type RuntimeEnvironment = typeof RuntimeEnvironment[keyof typeof RuntimeEnvironment];

export const LogLevel = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error"
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

export const LoggerNamespace = {
  kernelMigrate: "kernel:migrate",
  kernelRefreshServices: "kernel:refreshServices",
  kernelEnvironment: "kernel:environment",
  kernelColonies: "kernel:colonies",
  kernelSpawning: "kernel:spawning",
  kernelCleanup: "kernel:cleanup",
  stats: "stats",
  simBootstrap: "sim:bootstrap"
} as const;

export type LoggerNamespace = typeof LoggerNamespace[keyof typeof LoggerNamespace];

export const CpuAvailability = {
  available: "available",
  unavailable: "unavailable"
} as const;

export type CpuAvailability = typeof CpuAvailability[keyof typeof CpuAvailability];
