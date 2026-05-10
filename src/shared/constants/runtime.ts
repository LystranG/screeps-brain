// Screeps 运行时常量：shard 分类、环境类型、日志级别、logger 命名空间。
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
  kernelEnvironment: "kernel:environment",
  kernelCleanup: "kernel:cleanup",
  simBootstrap: "sim:bootstrap"
} as const;

export type LoggerNamespace = typeof LoggerNamespace[keyof typeof LoggerNamespace];
