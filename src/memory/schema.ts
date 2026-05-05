import { RoleName } from "constants/roles";

export const CURRENT_MEMORY_VERSION = 3;

export interface LogNamespaceConfigMemory {
  enabled?: boolean;
  sampleRate?: number;
}

export interface ObservabilityConfigMemory {
  logLevel: "debug" | "info" | "warn" | "error";
  enabledNamespaces: { [namespace: string]: LogNamespaceConfigMemory };
  namespaceSampling: { [namespace: string]: number };
  profiler: {
    enabled: boolean;
  };
  deepProfiler: {
    enabled: boolean;
  };
}

export interface RuntimeEnvironmentSummaryMemory {
  type: "sim" | "world" | "private" | "unknown";
  shard: string;
  lastChangedTick: number;
  lastSeenTick: number;
}

export interface SimGuidanceMemory {
  [code: string]: {
    message?: string;
    lastSeenTick?: number;
    lastLoggedTick?: number;
    flagName?: string;
  };
}

export interface SimBootstrapMemory {
  bootstrap: {
    version: number;
    completed: boolean;
    ready: boolean;
    lastRunTick: number;
  };
  guidance: SimGuidanceMemory;
}

export interface CpuStageSummaryMemory {
  last: number;
  average: number;
  max: number;
  samples: number;
}

export interface RuntimeMemory {
  bootstrapped: boolean;
  lastMigration: number;
  migrationError: string | null;
  environment: RuntimeEnvironmentSummaryMemory;
  sim: SimBootstrapMemory;
}

export interface ColonyConfigMemory {
  primaryRoomName: string | null;
  intelRefreshCadence: number;
}

export type ColonyStatusMemory = "ready" | "degraded" | "error";

export interface ColonyIntelMemory {
  roomName: string;
  lastSeenTick: number;
  lastRefreshTick: number;
  status: ColonyStatusMemory;
  missingReasons: string[];
  controllerId: string | null;
  rcl: number | null;
  sourceIds: string[];
  spawnIds: string[];
  primary: boolean;
  stage: string;
}

export interface TaskMemory {
  type: string;
  targetId: string | null;
  status: "queued" | "assigned" | "running" | "succeeded" | "failed" | "blocked";
  assignedTick: number | null;
  updatedTick: number;
  result: string | null;
  failure: string | null;
}

export interface SpawnRequestMemory {
  id: string;
  roomName: string;
  role: RoleName;
  priority: number;
  body: BodyPartConstant[];
  memory: CreepMemory;
  reason: string;
  requestedTick: number;
  status: "queued" | "validating" | "blocked" | "spawning" | "spawned" | "failed";
  attempts: number;
  lastError: string | null;
}

export interface ColonyMemory {
  roomName: string;
  primary: boolean;
  status: ColonyStatusMemory;
  intel: ColonyIntelMemory;
  spawnQueue: SpawnRequestMemory[];
}

export interface ProcessMemory {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  cadence: number;
  nextRunTick: number;
  lastRunTick: number | null;
  lastResult: string | null;
  lastError: string | null;
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
  colony: ColonyConfigMemory;
  observability: ObservabilityConfigMemory;
}

export interface ColoniesMemory {
  [roomName: string]: ColonyMemory;
}

export interface ProcessesMemory {
  [processId: string]: ProcessMemory;
}

export interface CommandsMemory {
  queue: Record<string, unknown>[];
  history: Record<string, unknown>[];
}

export interface StatsMemory {
  ticks: number;
  cpu: {
    available: boolean;
    stages: { [stageName: string]: CpuStageSummaryMemory };
  };
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

/**
 * 创建除 `creeps` 外的项目 Memory 默认结构；`creeps` 由 Screeps 和迁移流程单独保留。
 */
export function createDefaultProjectMemorySections(): Omit<ProjectMemoryShape, "creeps"> {
  return {
    version: CURRENT_MEMORY_VERSION,
    runtime: {
      bootstrapped: false,
      lastMigration: CURRENT_MEMORY_VERSION,
      migrationError: null,
      environment: {
        type: "unknown",
        shard: "unknown",
        lastChangedTick: 0,
        lastSeenTick: 0
      },
      sim: {
        bootstrap: {
          version: 0,
          completed: false,
          ready: false,
          lastRunTick: 0
        },
        guidance: {}
      }
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
      },
      colony: {
        primaryRoomName: null,
        intelRefreshCadence: 50
      },
      observability: {
        logLevel: "info",
        enabledNamespaces: {},
        namespaceSampling: {},
        profiler: {
          enabled: true
        },
        deepProfiler: {
          enabled: false
        }
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
      cpu: {
        available: true,
        stages: {}
      }
    }
  };
}

declare global {
  // 扩展 Screeps 全局 Memory 类型，确保持久化结构在编译期可见。
  interface Memory {
    version: number;
    runtime: RuntimeMemory;
    config: ProjectConfigMemory;
    colonies: ColoniesMemory;
    processes: ProcessesMemory;
    commands: CommandsMemory;
    stats: StatsMemory;
  }

  interface CreepMemory {
    role?: RoleName;
    task?: TaskMemory;
  }
}
