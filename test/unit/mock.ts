const SCREEPS_FIND_CONSTANTS = {
  FIND_SOURCES: 105,
  FIND_MY_CREEPS: 102,
  FIND_HOSTILE_CREEPS: 103,
  FIND_MY_SPAWNS: 112,
  FIND_MY_CONSTRUCTION_SITES: 114
};

const SCREEPS_STRUCTURE_CONSTANTS = {
  STRUCTURE_SPAWN: "spawn"
};

const SCREEPS_BODY_CONSTANTS = {
  WORK: "work",
  CARRY: "carry",
  MOVE: "move"
};

const SCREEPS_BODY_COSTS = {
  BODYPART_COST: {
    work: 100,
    carry: 50,
    move: 50
  }
};

const SCREEPS_RETURN_CONSTANTS = {
  OK: 0,
  ERR_NOT_OWNER: -1,
  ERR_NO_PATH: -2,
  ERR_NAME_EXISTS: -3,
  ERR_BUSY: -4,
  ERR_NOT_FOUND: -5,
  ERR_NOT_ENOUGH_RESOURCES: -6,
  ERR_INVALID_TARGET: -7,
  ERR_FULL: -8,
  ERR_NOT_IN_RANGE: -9,
  ERR_INVALID_ARGS: -10,
  ERR_TIRED: -11,
  ERR_NO_BODYPART: -12,
  ERR_NOT_ENOUGH_EXTENSIONS: -6,
  ERR_RCL_NOT_ENOUGH: -14,
  ERR_GCL_NOT_ENOUGH: -15
};

const SCREEPS_RESOURCE_CONSTANTS = {
  RESOURCE_ENERGY: "energy"
};

for (const [constantName, constantValue] of Object.entries({
  ...SCREEPS_FIND_CONSTANTS,
  ...SCREEPS_STRUCTURE_CONSTANTS,
  ...SCREEPS_BODY_CONSTANTS,
  ...SCREEPS_BODY_COSTS,
  ...SCREEPS_RETURN_CONSTANTS,
  ...SCREEPS_RESOURCE_CONSTANTS
})) {
  (global as unknown as { [name: string]: unknown })[constantName] = constantValue;
}

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
  getObjectById: (id: string) => any | null;
} {
  const game = {
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
    time: 12345,
    getObjectById(id: string): any | null {
      const currentGame = mockGame();
      const directCollections = [currentGame.creeps, currentGame.spawns];

      for (const collection of directCollections) {
        const direct = collection[id];

        if (direct !== undefined) {
          return direct;
        }
      }

      for (const room of Object.values(currentGame.rooms)) {
        const roomValue = room as any;
        const candidates = [
          roomValue.controller,
          ...(roomValue.find(FIND_SOURCES) ?? []),
          ...(roomValue.find(FIND_MY_SPAWNS) ?? []),
          ...(roomValue.find(FIND_MY_CREEPS) ?? [])
        ];
        const found = candidates.find(candidate => candidate?.id === id);

        if (found !== undefined) {
          return found;
        }
      }

      return null;
    }
  };

  return game;
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

export interface MockRoomOptions {
  name: string;
  controller?: any;
  spawns?: any[];
  sources?: any[];
  creeps?: any[];
  constructionSites?: any[];
  hostiles?: any[];
  energyAvailable?: number;
  energyCapacityAvailable?: number;
}

export function createMockRoom(options: MockRoomOptions): any {
  const findResults: { [findType: number]: any[] } = {
    [FIND_MY_SPAWNS]: options.spawns ?? [],
    [FIND_SOURCES]: options.sources ?? [],
    [FIND_MY_CREEPS]: options.creeps ?? [],
    [FIND_MY_CONSTRUCTION_SITES]: options.constructionSites ?? [],
    [FIND_HOSTILE_CREEPS]: options.hostiles ?? []
  };

  return {
    name: options.name,
    controller: options.controller,
    energyAvailable: options.energyAvailable ?? 0,
    energyCapacityAvailable: options.energyCapacityAvailable ?? 0,
    find: (findType: number): any[] => findResults[findType] ?? []
  };
}
