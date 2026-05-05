import { assert } from "chai";
import { CURRENT_MEMORY_VERSION } from "memory/schema";
import { runMemoryMigrations } from "../../src/memory/migrations";

describe("memory migrations", () => {
  it("upgrades empty Memory to the current skeleton", () => {
    const memory = {} as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.deepEqual(memory.creeps, {});
    assert.isFalse(memory.runtime.bootstrapped);
    assert.isNull(memory.runtime.migrationError);
    assert.isFalse(memory.config.automation.enabled);
    assert.equal(memory.config.strategy.mode, "manual");
    assert.deepEqual(memory.colonies, {});
    assert.deepEqual(memory.processes, {});
    assert.deepEqual(memory.commands.queue, []);
    assert.equal(memory.stats.ticks, 0);
  });

  it("initializes Phase 4 colony config defaults in project memory", () => {
    const memory = {} as Memory;

    const result = runMemoryMigrations(memory);
    const config = memory.config as typeof memory.config & {
      colony?: {
        primaryRoomName: string | null;
        intelRefreshCadence: number;
      };
    };

    assert.isTrue(result.ok);
    assert.equal(memory.version, 3);
    assert.deepEqual(config.colony, {
      primaryRoomName: null,
      intelRefreshCadence: 50
    });
  });

  it("upgrades old memory while preserving existing creep entries", () => {
    const memory = {
      version: 0,
      creeps: {
        worker1: {
          role: "worker",
          room: "W1N1",
          working: false
        }
      }
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.isTrue(result.ok);
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.deepEqual(memory.creeps.worker1 as unknown, {
      role: "worker",
      room: "W1N1",
      working: false
    });
  });

  it("upgrades v1 memory through observability, environment, sim, and colony defaults", () => {
    const memory = {
      version: 1,
      runtime: {
        bootstrapped: true,
        lastMigration: 1,
        migrationError: null
      },
      config: {
        automation: {
          enabled: true,
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
        ticks: 7,
        cpu: {}
      },
      creeps: {
        worker1: {
          role: "worker",
          room: "W1N1",
          working: false
        }
      }
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal((memory as Memory).version, CURRENT_MEMORY_VERSION);
    assert.isTrue(memory.config.automation.enabled);
    assert.deepEqual(memory.creeps.worker1 as unknown, {
      role: "worker",
      room: "W1N1",
      working: false
    });
    assert.equal(memory.config.observability.logLevel, "info");
    assert.deepEqual(memory.config.observability.enabledNamespaces, {});
    assert.deepEqual(memory.config.observability.namespaceSampling, {});
    assert.isTrue(memory.config.observability.profiler.enabled);
    assert.isFalse(memory.config.observability.deepProfiler.enabled);
    assert.equal(memory.runtime.environment.type, "unknown");
    assert.equal(memory.runtime.environment.shard, "unknown");
    assert.isFalse(memory.runtime.sim.bootstrap.completed);
    assert.isFalse(memory.runtime.sim.bootstrap.ready);
    assert.deepEqual(memory.runtime.sim.guidance, {});
    assert.deepEqual(memory.stats.cpu, {
      available: true,
      stages: {}
    });
    assert.deepEqual(memory.config.colony, {
      primaryRoomName: null,
      intelRefreshCadence: 50
    });
  });

  it("repairs partial legacy sections while preserving existing values", () => {
    const memory = {
      version: 0,
      runtime: {
        bootstrapped: true
      },
      config: {
        automation: {
          enabled: true
        },
        strategy: {},
        construction: {},
        defense: {}
      },
      commands: {},
      stats: {},
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.isTrue(result.ok);
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.isTrue(memory.runtime.bootstrapped);
    assert.equal(memory.runtime.lastMigration, CURRENT_MEMORY_VERSION);
    assert.isNull(memory.runtime.migrationError);
    assert.isTrue(memory.config.automation.enabled);
    assert.equal(memory.config.automation.mode, "manual");
    assert.equal(memory.config.strategy.mode, "manual");
    assert.isFalse(memory.config.construction.allowExtensions);
    assert.equal(memory.config.defense.safeMode, "manual");
    assert.deepEqual(memory.commands.queue, []);
    assert.deepEqual(memory.commands.history, []);
    assert.equal(memory.stats.ticks, 0);
    assert.equal(memory.config.observability.logLevel, "info");
    assert.equal(memory.runtime.environment.type, "unknown");
    assert.isFalse(memory.runtime.sim.bootstrap.completed);
    assert.deepEqual(memory.stats.cpu, {
      available: true,
      stages: {}
    });
  });

  it("repairs partial current-version memory before runtime services use it", () => {
    const memory = {
      version: CURRENT_MEMORY_VERSION,
      runtime: {
        bootstrapped: true,
        lastMigration: CURRENT_MEMORY_VERSION,
        migrationError: null
      },
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        }
      },
      stats: {
        ticks: 12,
        cpu: {}
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.config.observability.logLevel, "info");
    assert.isTrue(memory.config.observability.profiler.enabled);
    assert.equal(memory.runtime.environment.type, "unknown");
    assert.isFalse(memory.runtime.sim.bootstrap.completed);
    assert.deepEqual(memory.stats.cpu.stages, {});
    assert.deepEqual(memory.colonies, {});
    assert.deepEqual(memory.processes, {});
    assert.deepEqual(memory.commands.queue, []);
    assert.deepEqual(memory.commands.history, []);
  });

  it("preserves legacy CPU stage summaries when migrating to v2", () => {
    const legacyHarvest = {
      last: 2,
      average: 3,
      max: 5,
      samples: 4
    };
    const memory = {
      version: 1,
      runtime: {
        bootstrapped: true,
        lastMigration: 1,
        migrationError: null
      },
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        }
      },
      stats: {
        ticks: 7,
        cpu: {
          harvest: legacyHarvest
        }
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.deepEqual(memory.stats.cpu.stages.harvest, legacyHarvest);
  });

  it("is idempotent when run repeatedly to version 2", () => {
    const memory = {} as Memory;

    runMemoryMigrations(memory);
    const firstMigration = JSON.stringify(memory);
    runMemoryMigrations(memory);

    assert.equal(JSON.stringify(memory), firstMigration);
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
  });

  it("returns a failure result for future memory versions", () => {
    const memory = {
      version: CURRENT_MEMORY_VERSION + 1,
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.isFalse(result.ok);
    if (!result.ok) {
      assert.include(result.reason, "Unsupported Memory.version");
    }
  });
});
