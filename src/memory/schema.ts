export const CURRENT_MEMORY_VERSION = 1;

export interface RuntimeMemory {
  bootstrapped: boolean;
  lastMigration: number;
  migrationError: string | null;
}

export interface ProjectConfigMemory {
  automation: {
    enabled: boolean;
    mode: "manual";
  };
  strategy: {
    mode: "manual";
    allowExpansion: boolean;
    allowRemoteMining: boolean;
  };
  construction: {
    enabled: boolean;
    mode: "manual";
    allowRoads: boolean;
    allowExtensions: boolean;
    allowTowers: boolean;
  };
  defense: {
    enabled: boolean;
    mode: "manual";
    safeMode: "manual";
    allowRamparts: boolean;
  };
}

export interface ColoniesMemory {
  [roomName: string]: Record<string, unknown>;
}

export interface ProcessesMemory {
  [processId: string]: Record<string, unknown>;
}

export interface CommandsMemory {
  queue: Record<string, unknown>[];
  history: Record<string, unknown>[];
}

export interface StatsMemory {
  ticks: number;
  cpu: Record<string, unknown>;
}

export interface ProjectMemoryShape {
  version: number;
  runtime: RuntimeMemory;
  config: ProjectConfigMemory;
  colonies: ColoniesMemory;
  processes: ProcessesMemory;
  commands: CommandsMemory;
  stats: StatsMemory;
  creeps: {[creepName: string]: CreepMemory};
}

export function createDefaultProjectMemorySections(): Omit<ProjectMemoryShape, "creeps"> {
  return {
    version: CURRENT_MEMORY_VERSION,
    runtime: {
      bootstrapped: false,
      lastMigration: CURRENT_MEMORY_VERSION,
      migrationError: null
    },
    config: {
      automation: {
        enabled: false,
        mode: "manual"
      },
      strategy: {
        mode: "manual",
        allowExpansion: false,
        allowRemoteMining: false
      },
      construction: {
        enabled: false,
        mode: "manual",
        allowRoads: false,
        allowExtensions: false,
        allowTowers: false
      },
      defense: {
        enabled: false,
        mode: "manual",
        safeMode: "manual",
        allowRamparts: false
      }
    },
    colonies: {},
    processes: {},
    commands: {
      queue: [],
      history: []
    },
    stats: {
      ticks: 0,
      cpu: {}
    }
  };
}

declare global {
  interface Memory {
    version: number;
    runtime: RuntimeMemory;
    config: ProjectConfigMemory;
    colonies: ColoniesMemory;
    processes: ProcessesMemory;
    commands: CommandsMemory;
    stats: StatsMemory;
  }
}
