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
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.deepEqual(config.colony, {
      primaryRoomName: null,
      intelRefreshCadence: 50
    });
  });

  it("initializes Phase 5 strategy config defaults in project memory", () => {
    const memory = {} as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, 4);
    assert.deepEqual(memory.config.strategy, {
      mode: "manual",
      planningCadence: 50,
      allowExpansion: false,
      allowRemoteMining: false,
      allowMarket: false,
      allowWarfare: false,
      allowLargeFortification: false
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

  it("repairs nested current-version runtime and colony config sections", () => {
    const memory = {
      version: CURRENT_MEMORY_VERSION,
      runtime: {
        bootstrapped: true,
        lastMigration: CURRENT_MEMORY_VERSION,
        migrationError: null,
        environment: {
          type: "sim"
        }
      },
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        },
        colony: {}
      },
      stats: {
        ticks: 12,
        cpu: {}
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.deepEqual(memory.runtime.environment, {
      type: "sim",
      shard: "unknown",
      lastChangedTick: 0,
      lastSeenTick: 0
    });
    assert.deepEqual(memory.config.colony, {
      primaryRoomName: null,
      intelRefreshCadence: 50
    });
  });

  it("upgrades v2 memory to v4 while preserving colony and process entries", () => {
    const colonyMemory = {
      roomName: "W1N1",
      primary: true,
      status: "ready",
      intel: {
        roomName: "W1N1",
        lastSeenTick: 20,
        lastRefreshTick: 20,
        status: "ready",
        missingReasons: [],
        controllerId: "controller1",
        rcl: 2,
        sourceIds: ["source1"],
        spawnIds: ["spawn1"],
        primary: true,
        stage: "rcl2"
      },
      spawnQueue: [
        {
          id: "spawn-request-1",
          roomName: "W1N1",
          role: "worker",
          priority: 10,
          body: ["work", "carry", "move"],
          memory: {
            role: "worker"
          },
          reason: "bootstrap",
          requestedTick: 20,
          status: "queued",
          attempts: 0,
          lastError: null
        }
      ]
    };
    const processMemory = {
      id: "process-1",
      name: "colonyIntel",
      enabled: true,
      priority: 5,
      cadence: 50,
      nextRunTick: 25,
      lastRunTick: 20,
      lastResult: "ok",
      lastError: null
    };
    const memory = {
      version: 2,
      runtime: {
        bootstrapped: true,
        lastMigration: 2,
        migrationError: null,
        environment: {
          type: "sim",
          shard: "sim",
          lastChangedTick: 1,
          lastSeenTick: 20
        },
        sim: {
          bootstrap: {
            version: 1,
            completed: true,
            ready: true,
            lastRunTick: 20
          },
          guidance: {}
        }
      },
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        },
        colony: {
          primaryRoomName: "W1N1"
        }
      },
      colonies: {
        W1N1: colonyMemory
      },
      processes: {
        "process-1": processMemory
      },
      commands: {
        queue: [{ command: "status" }],
        history: [{ command: "help" }]
      },
      stats: {
        ticks: 20,
        cpu: {
          available: true,
          stages: {
            kernel: {
              last: 1,
              average: 1,
              max: 1,
              samples: 1
            }
          }
        }
      },
      creeps: {
        worker1: {
          role: "worker"
        }
      }
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.deepEqual(memory.config.colony, {
      primaryRoomName: "W1N1",
      intelRefreshCadence: 50
    });
    assert.deepInclude(memory.colonies.W1N1 as unknown as Record<string, unknown>, colonyMemory);
    assert.deepEqual(memory.colonies.W1N1.strategy, {
      version: 1,
      roomName: "W1N1",
      stage: "unknown",
      status: "stale",
      lastRunTick: 0,
      nextRunTick: 0,
      lastTrigger: "migration",
      signature: "",
      priorities: [],
      intents: [],
      deferrals: [],
      reasons: ["strategy pending evaluation"]
    });
    assert.deepEqual(memory.processes["process-1"] as unknown, processMemory);
    assert.deepEqual(memory.commands.queue, [{ command: "status" }]);
    assert.deepEqual(memory.commands.history, [{ command: "help" }]);
    assert.deepEqual(memory.creeps.worker1, { role: "worker" });
  });

  it("repairs v2 colony records missing spawnQueue while preserving existing intel", () => {
    const memory = {
      version: 2,
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        },
        colony: {
          primaryRoomName: "W1N1"
        }
      },
      colonies: {
        W1N1: {
          roomName: "W1N1",
          primary: true,
          status: "ready",
          intel: {
            roomName: "W1N1",
            lastSeenTick: 30,
            lastRefreshTick: 30,
            status: "ready",
            missingReasons: [],
            controllerId: "controller1",
            rcl: 2,
            sourceIds: ["source1", "source2"],
            spawnIds: ["spawn1"],
            primary: true,
            stage: "rcl2"
          }
        }
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.deepEqual(memory.colonies.W1N1.spawnQueue, []);
    assert.equal(memory.colonies.W1N1.roomName, "W1N1");
    assert.isTrue(memory.colonies.W1N1.primary);
    assert.equal(memory.colonies.W1N1.status, "ready");
    assert.deepEqual(memory.colonies.W1N1.intel.sourceIds, ["source1", "source2"]);
    assert.deepEqual(memory.colonies.W1N1.intel.spawnIds, ["spawn1"]);
    assert.equal(memory.colonies.W1N1.intel.controllerId, "controller1");
  });

  it("migrateToVersion4 upgrades v3 memory while preserving colony intel and spawnQueue", () => {
    const spawnQueue = [
      {
        id: "spawn-request-1",
        roomName: "W1N1",
        role: "worker",
        priority: 10,
        body: ["work", "carry", "move"],
        memory: {
          role: "worker"
        },
        reason: "bootstrap",
        requestedTick: 20,
        status: "queued",
        attempts: 0,
        lastError: null
      }
    ];
    const memory = {
      version: 3,
      runtime: {
        bootstrapped: true,
        lastMigration: 3,
        migrationError: null,
        environment: {
          type: "sim",
          shard: "sim",
          lastChangedTick: 1,
          lastSeenTick: 20
        },
        sim: {
          bootstrap: {
            version: 1,
            completed: true,
            ready: true,
            lastRunTick: 20
          },
          guidance: {}
        }
      },
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        },
        strategy: {
          mode: "manual",
          allowExpansion: true,
          allowRemoteMining: false
        },
        colony: {
          primaryRoomName: "W1N1",
          intelRefreshCadence: 40
        }
      },
      colonies: {
        W1N1: {
          roomName: "W1N1",
          primary: true,
          status: "ready",
          intel: {
            roomName: "W1N1",
            lastSeenTick: 20,
            lastRefreshTick: 20,
            status: "ready",
            missingReasons: [],
            controllerId: "controller1",
            rcl: 2,
            sourceIds: ["source1"],
            spawnIds: ["spawn1"],
            primary: true,
            stage: "rcl2"
          },
          spawnQueue
        }
      },
      processes: {},
      commands: {
        queue: [],
        history: []
      },
      stats: {
        ticks: 20,
        cpu: {
          available: true,
          stages: {}
        }
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, 4);
    assert.equal(memory.runtime.lastMigration, 4);
    assert.deepEqual(memory.config.strategy, {
      mode: "manual",
      planningCadence: 50,
      allowExpansion: true,
      allowRemoteMining: false,
      allowMarket: false,
      allowWarfare: false,
      allowLargeFortification: false
    });
    assert.deepEqual(memory.colonies.W1N1.intel.sourceIds, ["source1"]);
    assert.deepEqual(memory.colonies.W1N1.spawnQueue as unknown, spawnQueue);
    assert.equal(memory.colonies.W1N1.strategy.status, "stale");
    assert.equal(memory.colonies.W1N1.strategy.lastTrigger, "migration");
    assert.include(memory.colonies.W1N1.strategy.reasons, "strategy pending evaluation");
  });

  it("repairs current-version colony records to safe degraded defaults", () => {
    const memory = {
      version: CURRENT_MEMORY_VERSION,
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        },
        colony: {
          primaryRoomName: "W2N2"
        }
      },
      colonies: {
        W2N2: {
          roomName: "W2N2",
          primary: true
        }
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.isArray(memory.colonies.W2N2.spawnQueue);
    assert.deepEqual(memory.colonies.W2N2.spawnQueue, []);
    assert.equal(memory.colonies.W2N2.status, "degraded");
    assert.equal(memory.colonies.W2N2.intel.roomName, "W2N2");
    assert.isArray(memory.colonies.W2N2.intel.missingReasons);
    assert.deepEqual(memory.colonies.W2N2.intel.missingReasons, []);
    assert.isTrue(memory.colonies.W2N2.primary);
  });

  it("repairs current-version strategy gates and missing colony strategy plans", () => {
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
        },
        strategy: {
          mode: "manual",
          planningCadence: 25,
          allowExpansion: true,
          allowRemoteMining: true
        },
        colony: {
          primaryRoomName: "W1N1"
        }
      },
      colonies: {
        W1N1: {
          roomName: "W1N1",
          primary: true,
          status: "ready",
          intel: {
            roomName: "W1N1",
            lastSeenTick: 30,
            lastRefreshTick: 30,
            status: "ready",
            missingReasons: [],
            controllerId: "controller1",
            rcl: 2,
            sourceIds: ["source1"],
            spawnIds: ["spawn1"],
            primary: true,
            stage: "rcl2"
          },
          spawnQueue: []
        }
      },
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.config.strategy.planningCadence, 25);
    assert.isFalse(memory.config.strategy.allowMarket);
    assert.isFalse(memory.config.strategy.allowWarfare);
    assert.isFalse(memory.config.strategy.allowLargeFortification);
    assert.deepEqual(memory.colonies.W1N1.strategy, {
      version: 1,
      roomName: "W1N1",
      stage: "unknown",
      status: "stale",
      lastRunTick: 0,
      nextRunTick: 0,
      lastTrigger: "migration",
      signature: "",
      priorities: [],
      intents: [],
      deferrals: [],
      reasons: ["strategy pending evaluation"]
    });
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
