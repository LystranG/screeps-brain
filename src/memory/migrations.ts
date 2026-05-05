import {
  CURRENT_MEMORY_VERSION,
  CpuStageSummaryMemory,
  ProjectConfigMemory,
  RuntimeMemory,
  StatsMemory,
  createDefaultProjectMemorySections
} from "memory/schema";

export type MigrationResult = { ok: true; version: typeof CURRENT_MEMORY_VERSION } | { ok: false; reason: string };

type MigrationStep = (memory: Memory) => void;
type LegacyRuntimeMemory = Partial<Omit<RuntimeMemory, "environment" | "sim">>;
type LegacyConfigMemory = Partial<Omit<ProjectConfigMemory, "observability">>;
type LegacyStatsMemory = Partial<Omit<StatsMemory, "cpu">> & { cpu?: Record<string, unknown> };

const orderedMigrations: {[version: number]: MigrationStep} = {
  1: migrateToVersion1,
  2: migrateToVersion2,
  3: migrateToVersion3
};

/**
 * 从当前 Memory.version 逐步迁移到最新版本；不支持未来版本，避免降级写坏存档。
 */
export function runMemoryMigrations(memory: Memory): MigrationResult {
  try {
    const startingVersion = typeof memory.version === "number" ? memory.version : 0;

    if (startingVersion > CURRENT_MEMORY_VERSION) {
      return {
        ok: false,
        reason: `Unsupported Memory.version ${startingVersion}; current version is ${CURRENT_MEMORY_VERSION}`
      };
    }

    // 逐版本执行，后续新增 v2/v3 时可以在同一机制下保持可回放。
    for (let version = startingVersion + 1; version <= CURRENT_MEMORY_VERSION; version += 1) {
      orderedMigrations[version](memory);
    }

    // 当前版本的 Memory 也可能被手动编辑成 partial state；重跑当前迁移只补默认值。
    orderedMigrations[CURRENT_MEMORY_VERSION](memory);

    return { ok: true, version: CURRENT_MEMORY_VERSION };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown memory migration failure";
    const defaults = createDefaultProjectMemorySections();

    memory.runtime = {
      ...defaults.runtime,
      lastMigration:
        typeof memory.version === "number" && memory.version <= CURRENT_MEMORY_VERSION
          ? memory.version
          : defaults.runtime.lastMigration,
      migrationError: reason
    };

    return { ok: false, reason };
  }
}

function migrateToVersion1(memory: Memory): void {
  const defaults = createDefaultProjectMemorySections();
  const legacyRuntime = memory.runtime as LegacyRuntimeMemory | undefined;
  const legacyConfig = memory.config as LegacyConfigMemory | undefined;
  const legacyStats = memory.stats as LegacyStatsMemory | undefined;

  // partial legacy Memory 需要按嵌套 section 合并默认值，不能只判断顶层对象是否存在。
  memory.version = 1;
  memory.runtime = {
    bootstrapped: legacyRuntime?.bootstrapped ?? defaults.runtime.bootstrapped,
    environment: defaults.runtime.environment,
    sim: defaults.runtime.sim,
    migrationError: null,
    lastMigration: 1
  };
  memory.config = {
    automation: {
      ...defaults.config.automation,
      ...legacyConfig?.automation
    },
    strategy: {
      ...defaults.config.strategy,
      ...legacyConfig?.strategy
    },
    construction: {
      ...defaults.config.construction,
      ...legacyConfig?.construction
    },
    defense: {
      ...defaults.config.defense,
      ...legacyConfig?.defense
    }
  } as ProjectConfigMemory;
  memory.colonies = memory.colonies || defaults.colonies;
  memory.processes = memory.processes || defaults.processes;
  memory.commands = {
    queue: memory.commands?.queue || defaults.commands.queue,
    history: memory.commands?.history || defaults.commands.history
  };
  memory.stats = {
    ticks: typeof legacyStats?.ticks === "number" ? legacyStats.ticks : defaults.stats.ticks,
    cpu: legacyStats?.cpu || {}
  } as StatsMemory;
  memory.creeps = memory.creeps || {};
}

function migrateToVersion2(memory: Memory): void {
  const defaults = createDefaultProjectMemorySections();
  const legacyCpu = memory.stats?.cpu as Record<string, unknown> | undefined;
  const existingStages = legacyCpu?.stages as { [stageName: string]: CpuStageSummaryMemory } | undefined;
  const legacyStageStats = extractLegacyCpuStages(legacyCpu);

  // v2 只补齐观测、环境、sim 和结构化 CPU stats；已有用户策略值继续保留。
  memory.version = 2;
  memory.runtime = {
    ...defaults.runtime,
    ...memory.runtime,
    lastMigration: 2,
    migrationError: null,
    environment: {
      ...defaults.runtime.environment,
      ...memory.runtime?.environment
    },
    sim: {
      ...defaults.runtime.sim,
      ...memory.runtime?.sim,
      bootstrap: {
        ...defaults.runtime.sim.bootstrap,
        ...memory.runtime?.sim?.bootstrap
      },
      guidance: memory.runtime?.sim?.guidance || defaults.runtime.sim.guidance
    }
  };
  memory.config = {
    automation: {
      ...defaults.config.automation,
      ...memory.config?.automation
    },
    strategy: {
      ...defaults.config.strategy,
      ...memory.config?.strategy
    },
    construction: {
      ...defaults.config.construction,
      ...memory.config?.construction
    },
    defense: {
      ...defaults.config.defense,
      ...memory.config?.defense
    },
    colony: {
      ...defaults.config.colony,
      ...memory.config?.colony
    },
    observability: {
      ...defaults.config.observability,
      ...memory.config?.observability,
      profiler: {
        ...defaults.config.observability.profiler,
        ...memory.config?.observability?.profiler
      },
      deepProfiler: {
        ...defaults.config.observability.deepProfiler,
        ...memory.config?.observability?.deepProfiler
      }
    }
  };
  memory.stats = {
    ticks: typeof memory.stats?.ticks === "number" ? memory.stats.ticks : defaults.stats.ticks,
    cpu: {
      ...defaults.stats.cpu,
      ...memory.stats?.cpu,
      stages: {
        ...defaults.stats.cpu.stages,
        ...legacyStageStats,
        ...existingStages
      }
    }
  };
  memory.colonies = memory.colonies || defaults.colonies;
  memory.processes = memory.processes || defaults.processes;
  memory.commands = {
    queue: memory.commands?.queue || defaults.commands.queue,
    history: memory.commands?.history || defaults.commands.history
  };
  memory.creeps = memory.creeps || {};
}

function migrateToVersion3(memory: Memory): void {
  const defaults = createDefaultProjectMemorySections();

  // v3 只扩展 Phase 4 primitive 的 JSON 默认结构；现有 colony/process/creep 数据必须原样保留。
  memory.version = CURRENT_MEMORY_VERSION;
  memory.runtime = {
    ...defaults.runtime,
    ...memory.runtime,
    lastMigration: CURRENT_MEMORY_VERSION,
    migrationError: null,
    environment: {
      ...defaults.runtime.environment,
      ...memory.runtime?.environment
    },
    sim: {
      ...defaults.runtime.sim,
      ...memory.runtime?.sim,
      bootstrap: {
        ...defaults.runtime.sim.bootstrap,
        ...memory.runtime?.sim?.bootstrap
      },
      guidance: memory.runtime?.sim?.guidance || defaults.runtime.sim.guidance
    }
  };
  memory.config = {
    automation: {
      ...defaults.config.automation,
      ...memory.config?.automation
    },
    strategy: {
      ...defaults.config.strategy,
      ...memory.config?.strategy
    },
    construction: {
      ...defaults.config.construction,
      ...memory.config?.construction
    },
    defense: {
      ...defaults.config.defense,
      ...memory.config?.defense
    },
    colony: {
      ...defaults.config.colony,
      ...memory.config?.colony
    },
    observability: {
      ...defaults.config.observability,
      ...memory.config?.observability,
      profiler: {
        ...defaults.config.observability.profiler,
        ...memory.config?.observability?.profiler
      },
      deepProfiler: {
        ...defaults.config.observability.deepProfiler,
        ...memory.config?.observability?.deepProfiler
      }
    }
  };
  memory.stats = {
    ticks: typeof memory.stats?.ticks === "number" ? memory.stats.ticks : defaults.stats.ticks,
    cpu: {
      ...defaults.stats.cpu,
      ...memory.stats?.cpu,
      stages: {
        ...defaults.stats.cpu.stages,
        ...memory.stats?.cpu?.stages
      }
    }
  };
  memory.colonies = memory.colonies || defaults.colonies;
  memory.processes = memory.processes || defaults.processes;
  memory.commands = {
    queue: memory.commands?.queue || defaults.commands.queue,
    history: memory.commands?.history || defaults.commands.history
  };
  memory.creeps = memory.creeps || {};
}

function extractLegacyCpuStages(legacyCpu: Record<string, unknown> | undefined): { [stageName: string]: CpuStageSummaryMemory } {
  const stages: { [stageName: string]: CpuStageSummaryMemory } = {};

  if (!legacyCpu) {
    return stages;
  }

  for (const stageName of Object.keys(legacyCpu)) {
    if (stageName === "available" || stageName === "stages") {
      continue;
    }

    const value = legacyCpu[stageName];
    if (isCpuStageSummaryMemory(value)) {
      stages[stageName] = value;
    }
  }

  return stages;
}

function isCpuStageSummaryMemory(value: unknown): value is CpuStageSummaryMemory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CpuStageSummaryMemory>;

  return (
    typeof candidate.last === "number" &&
    typeof candidate.average === "number" &&
    typeof candidate.max === "number" &&
    typeof candidate.samples === "number"
  );
}
