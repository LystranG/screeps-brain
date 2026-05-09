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

export function createMockGame(): {
  creeps: { [name: string]: any };
  cpu: { getUsed: () => number; tickLimit: number; bucket: number };
  shard: { name: string };
  rooms: { [roomName: string]: any };
  spawns: { [spawnName: string]: any };
  flags: { [flagName: string]: any };
  time: number;
} {
  return {
    creeps: {},
    cpu: { getUsed: () => 0, tickLimit: 500, bucket: 10000 },
    shard: { name: "sim" },
    rooms: {},
    spawns: {},
    flags: {},
    time: 12345
  };
}

export function createMockMemory(): {
  creeps: { [name: string]: any };
  [key: string]: any;
} {
  return { creeps: {} };
}

export function mockGame(): ReturnType<typeof createMockGame> {
  return (global as unknown as { Game: ReturnType<typeof createMockGame> }).Game;
}

export function mockMemory(): ReturnType<typeof createMockMemory> {
  return (global as unknown as { Memory: ReturnType<typeof createMockMemory> }).Memory;
}

export interface MockRoomOptions {
  name: string;
  controller?: any;
  spawns?: any[];
  sources?: any[];
}

export function createMockRoom(options: MockRoomOptions): any {
  const findResults: { [findType: number]: any[] } = {
    [FIND_MY_SPAWNS]: options.spawns ?? [],
    [FIND_SOURCES]: options.sources ?? []
  };

  return {
    name: options.name,
    controller: options.controller,
    find: (findType: number): any[] => findResults[findType] ?? []
  };
}
