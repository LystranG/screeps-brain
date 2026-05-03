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
