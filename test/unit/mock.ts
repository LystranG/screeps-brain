export function createMockGame(): {
  creeps: { [name: string]: any };
  rooms: any;
  spawns: any;
  time: any;
} {
  return {
    creeps: {},
    rooms: [],
    spawns: {},
    time: 12345
  };
}

export function createMockMemory(): {
  creeps: { [name: string]: any };
  [key: string]: any;
} {
  return {
    creeps: {}
  };
}

export function mockGame(): ReturnType<typeof createMockGame> {
  return (global as unknown as { Game: ReturnType<typeof createMockGame> }).Game;
}

export function mockMemory(): ReturnType<typeof createMockMemory> {
  return (global as unknown as { Memory: ReturnType<typeof createMockMemory> }).Memory;
}
