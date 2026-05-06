import {
  CURRENT_MEMORY_VERSION,
  ColoniesMemory,
  ColonyIntelMemory,
  ColonyMemory,
  ColonyStatusMemory,
  CpuStageSummaryMemory,
  ProjectConfigMemory,
  RuntimeMemory,
  StatsMemory,
  StrategyPlanMemory,
  createDefaultProjectMemorySections
} from "memory/schema";

export type MigrationResult = { ok: true; version: typeof CURRENT_MEMORY_VERSION } | { ok: false; reason: string };

type MigrationStep = (memory: Memory) => void;
type LegacyRuntimeMemory = Partial<Omit<RuntimeMemory, "environment" | "sim">>;
type LegacyConfigMemory = Partial<Omit<ProjectConfigMemory, "observability">>;
type LegacyStatsMemory = Partial<Omit<StatsMemory, "cpu">> & { cpu?: Record<string, unknown> };
type PartialColonyMemory = Partial<Omit<ColonyMemory, "intel">> & { intel?: Partial<ColonyIntelMemory> };
type PartialStrategyPlanMemory = Partial<StrategyPlanMemory>;

const orderedMigrations: {[version: number]: MigrationStep} = {
  1: migrateToVersion1,
  2: migrateToVersion2,
  3: migrateToVersion3,
  4: migrateToVersion4
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
  memory.colonies = repairColonies(memory.colonies, memory.config);
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
  memory.colonies = repairColonies(memory.colonies, memory.config);
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
  memory.version = 3;
  memory.runtime = {
    ...defaults.runtime,
    ...memory.runtime,
    lastMigration: 3,
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
  memory.colonies = repairColonies(memory.colonies, memory.config);
  memory.processes = memory.processes || defaults.processes;
  memory.commands = {
    queue: memory.commands?.queue || defaults.commands.queue,
    history: memory.commands?.history || defaults.commands.history
  };
  memory.creeps = memory.creeps || {};
}

function migrateToVersion4(memory: Memory): void {
  const defaults = createDefaultProjectMemorySections();

  // v4 只补策略配置门和每个 colony 的解释型摘要；Phase 4 的运行时、队列和进程数据原样保留。
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
  memory.colonies = repairColonies(memory.colonies, memory.config);
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

function repairColonies(
  colonies: ColoniesMemory | undefined,
  config: ProjectConfigMemory | undefined
): ColoniesMemory {
  const repaired: ColoniesMemory = {};

  for (const roomName of Object.keys(colonies ?? {})) {
    repaired[roomName] = repairColony(roomName, colonies?.[roomName] as PartialColonyMemory | undefined, config);
  }

  return repaired;
}

function repairColony(
  roomName: string,
  colony: PartialColonyMemory | undefined,
  config: ProjectConfigMemory | undefined
): ColonyMemory {
  const existingColony = colony ?? {};
  const resolvedRoomName = existingColony.roomName || roomName;
  const primary = existingColony.primary ?? config?.colony?.primaryRoomName === resolvedRoomName;
  const status = isColonyStatusMemory(existingColony.status) ? existingColony.status : "degraded";

  // 旧 Memory 可能已有 colony 记录但缺少 Phase 4 字段；这里只补 JSON 安全默认值，不删除用户队列。
  return {
    roomName: resolvedRoomName,
    primary,
    status,
    intel: repairColonyIntel(resolvedRoomName, primary, status, existingColony.intel),
    spawnQueue: Array.isArray(existingColony.spawnQueue) ? existingColony.spawnQueue : [],
    strategy: repairStrategyPlan(resolvedRoomName, existingColony.strategy as PartialStrategyPlanMemory | undefined)
  };
}

export function repairStrategyPlan(
  roomName: string,
  existingPlan: PartialStrategyPlanMemory | undefined
): StrategyPlanMemory {
  const plan = existingPlan ?? {};

  return {
    version: typeof plan.version === "number" ? plan.version : 1,
    roomName: typeof plan.roomName === "string" ? plan.roomName : roomName,
    stage: typeof plan.stage === "string" ? plan.stage : "unknown",
    status: plan.status === "fresh" || plan.status === "blocked" || plan.status === "stale" ? plan.status : "stale",
    lastRunTick: typeof plan.lastRunTick === "number" ? plan.lastRunTick : 0,
    nextRunTick: typeof plan.nextRunTick === "number" ? plan.nextRunTick : 0,
    lastTrigger: typeof plan.lastTrigger === "string" ? plan.lastTrigger : "migration",
    signature: typeof plan.signature === "string" ? plan.signature : "",
    priorities: Array.isArray(plan.priorities) ? plan.priorities : [],
    intents: Array.isArray(plan.intents) ? plan.intents : [],
    deferrals: Array.isArray(plan.deferrals) ? plan.deferrals : [],
    reasons: Array.isArray(plan.reasons) && plan.reasons.length > 0 ? plan.reasons : ["strategy pending evaluation"]
  };
}

function repairColonyIntel(
  roomName: string,
  primary: boolean,
  status: ColonyStatusMemory,
  intel: Partial<ColonyIntelMemory> | undefined
): ColonyIntelMemory {
  const existingIntel = intel ?? {};

  return {
    roomName: existingIntel.roomName || roomName,
    lastSeenTick: typeof existingIntel.lastSeenTick === "number" ? existingIntel.lastSeenTick : 0,
    lastRefreshTick: typeof existingIntel.lastRefreshTick === "number" ? existingIntel.lastRefreshTick : 0,
    status: isColonyStatusMemory(existingIntel.status) ? existingIntel.status : status,
    missingReasons: Array.isArray(existingIntel.missingReasons) ? existingIntel.missingReasons : [],
    controllerId: typeof existingIntel.controllerId === "string" ? existingIntel.controllerId : null,
    rcl: typeof existingIntel.rcl === "number" ? existingIntel.rcl : null,
    sourceIds: Array.isArray(existingIntel.sourceIds) ? existingIntel.sourceIds : [],
    spawnIds: Array.isArray(existingIntel.spawnIds) ? existingIntel.spawnIds : [],
    primary: existingIntel.primary ?? primary,
    stage: typeof existingIntel.stage === "string" ? existingIntel.stage : "unknown"
  };
}

function isColonyStatusMemory(value: unknown): value is ColonyStatusMemory {
  return value === "ready" || value === "degraded" || value === "error";
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
