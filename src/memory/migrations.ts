import { CURRENT_MEMORY_VERSION, createDefaultProjectMemorySections } from "memory/schema";

export type MigrationResult = { ok: true; version: typeof CURRENT_MEMORY_VERSION } | { ok: false; reason: string };

type MigrationStep = (memory: Memory) => void;

const orderedMigrations: {[version: number]: MigrationStep} = {
  1: migrateToVersion1
};

export function runMemoryMigrations(memory: Memory): MigrationResult {
  try {
    const startingVersion = typeof memory.version === "number" ? memory.version : 0;

    if (startingVersion > CURRENT_MEMORY_VERSION) {
      return {
        ok: false,
        reason: `Unsupported Memory.version ${startingVersion}; current version is ${CURRENT_MEMORY_VERSION}`
      };
    }

    for (let version = startingVersion + 1; version <= CURRENT_MEMORY_VERSION; version += 1) {
      orderedMigrations[version](memory);
    }

    if (memory.version !== CURRENT_MEMORY_VERSION) {
      memory.version = CURRENT_MEMORY_VERSION;
    }

    return { ok: true, version: CURRENT_MEMORY_VERSION };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown memory migration failure";
    memory.runtime = {
      bootstrapped: false,
      lastMigration: typeof memory.version === "number" ? memory.version : 0,
      migrationError: reason
    };

    return { ok: false, reason };
  }
}

function migrateToVersion1(memory: Memory): void {
  const defaults = createDefaultProjectMemorySections();

  memory.version = CURRENT_MEMORY_VERSION;
  memory.runtime = {
    ...defaults.runtime,
    ...memory.runtime,
    lastMigration: CURRENT_MEMORY_VERSION,
    migrationError: null
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
    }
  };
  memory.colonies = memory.colonies || defaults.colonies;
  memory.processes = memory.processes || defaults.processes;
  memory.commands = {
    queue: memory.commands?.queue || defaults.commands.queue,
    history: memory.commands?.history || defaults.commands.history
  };
  memory.stats = {
    ticks: typeof memory.stats?.ticks === "number" ? memory.stats.ticks : defaults.stats.ticks,
    cpu: memory.stats?.cpu || defaults.stats.cpu
  };
  memory.creeps = memory.creeps || {};
}
