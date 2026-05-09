// 精简后的持久化 Memory 类型定义。
// 仅保留运行时环境、sim 引导、可观测性配置和命令历史。
// 后续重构阶段将在此扩展声明式架构所需的新字段。
export const CURRENT_MEMORY_VERSION = 5;

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
    flagResult?: string;
    active?: boolean;
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

export interface RuntimeMemory {
  bootstrapped: boolean;
  lastMigration: number;
  migrationError: string | null;
  environment: RuntimeEnvironmentSummaryMemory;
  sim: SimBootstrapMemory;
}

export interface CommandsMemory {
  queue: Record<string, unknown>[];
  history: Record<string, unknown>[];
}

export interface ProjectConfigMemory {
  observability: ObservabilityConfigMemory;
}

export interface ProjectMemoryShape {
  version: number;
  runtime: RuntimeMemory;
  config: ProjectConfigMemory;
  commands: CommandsMemory;
  creeps: { [creepName: string]: CreepMemory };
}

// 创建除 creeps 外的 Memory 默认结构，用于初始化和测试。
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
    commands: {
      queue: [],
      history: []
    }
  };
}

// 扩展 Screeps 全局 Memory 类型，确保持久化结构在编译期可见。
declare global {
  interface Memory {
    version: number;
    runtime: RuntimeMemory;
    config: ProjectConfigMemory;
    commands: CommandsMemory;
  }

  interface CreepMemory {
    [key: string]: unknown;
  }
}
