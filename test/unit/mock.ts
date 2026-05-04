// 每个测试都创建新对象，避免 shallow clone 共享嵌套 Memory/Game 状态。
export function createMockGame(): {
  creeps: { [name: string]: any };
  cpu: {
    getUsed: () => number;
    tickLimit: number;
    bucket: number;
  };
  shard: {
    name: string;
  };
  rooms: { [roomName: string]: any };
  spawns: { [spawnName: string]: any };
  flags: { [flagName: string]: any };
  time: number;
} {
  return {
    creeps: {},
    cpu: {
      getUsed: () => 0,
      tickLimit: 500,
      bucket: 10000
    },
    shard: {
      name: "sim"
    },
    rooms: {},
    spawns: {},
    flags: {},
    time: 12345
  };
}

// Memory mock 只提供当前测试需要的最小结构，其余 section 由迁移测试补齐。
export function createMockMemory(): {
  creeps: { [name: string]: any };
  [key: string]: any;
} {
  return {
    creeps: {}
  };
}

// 从 global 读取当前测试的 Game，避免测试误改导出的共享 fixture。
export function mockGame(): ReturnType<typeof createMockGame> {
  return (global as unknown as { Game: ReturnType<typeof createMockGame> }).Game;
}

// 从 global 读取当前测试的 Memory，确保断言针对 runtime 实际使用的对象。
export function mockMemory(): ReturnType<typeof createMockMemory> {
  return (global as unknown as { Memory: ReturnType<typeof createMockMemory> }).Memory;
}
