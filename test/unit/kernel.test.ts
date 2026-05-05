import { assert } from "chai";
import * as sinon from "sinon";
import { RuntimeEnvironment } from "constants/runtime";
import { CURRENT_MEMORY_VERSION, createDefaultProjectMemorySections } from "memory/schema";
import { createSpawnRequest, enqueueSpawnRequest } from "spawning/queue";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
import { createMockGame, createMockMemory, createMockRoom, mockGame, mockMemory } from "./mock";

describe("kernel|stats cleanup|kernel runtime kernel", () => {
  const expectedCommandStageOrder: LifecycleStageName[] = [
    "migrate",
    "refreshServices",
    "installCommands",
    "detectEnvironmentBootstrap",
    "runColoniesAndProcesses",
    "runSpawning",
    "cleanup",
    "flushStats"
  ];
  const expectedCommandStageOrderAudit = ["migrate", "refreshServices", "installCommands", "detectEnvironmentBootstrap"];

  interface KernelCommandGlobalState {
    cmd?: {
      help(): string;
    };
    __cmdApiVersion?: number;
  }

  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = createMockGame();
    // @ts-ignore : allow adding Memory to global
    global.Memory = createMockMemory();
    (global as unknown as { OK: ScreepsReturnCode }).OK = 0;
    delete (global as unknown as KernelCommandGlobalState).cmd;
    delete (global as unknown as KernelCommandGlobalState).__cmdApiVersion;
  });

  afterEach(() => {
    if (consoleLog) {
      consoleLog.restore();
      consoleLog = null;
    }

    delete (global as unknown as KernelCommandGlobalState).cmd;
    delete (global as unknown as KernelCommandGlobalState).__cmdApiVersion;
  });

  it("executes lifecycle stages in the required order", () => {
    const observedStages: LifecycleStageName[] = [];
    const stages: LifecycleStageOverrides = {};

    for (const stageName of KERNEL_STAGE_ORDER) {
      stages[stageName] = () => observedStages.push(stageName);
    }

    const result = new Kernel({ stages }).run();
    const expectedStageOrder = [...KERNEL_STAGE_ORDER];

    assert.isTrue(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.deepEqual(observedStages, expectedStageOrder);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(expectedStageOrder, expectedCommandStageOrder);
    assert.deepEqual(expectedCommandStageOrderAudit, [
      "migrate",
      "refreshServices",
      "installCommands",
      "detectEnvironmentBootstrap"
    ]);
  });

  it("blocks later stages when migration fails", () => {
    mockMemory().version = 999;
    const result = new Kernel().run();

    assert.isFalse(result.ok);
    assert.deepEqual(result.executedStages, ["migrate"]);
    assert.deepEqual(result.failures, [
      {
        stage: "migrate",
        message: `Unsupported Memory.version 999; current version is ${CURRENT_MEMORY_VERSION}`
      }
    ]);
    const failedMemory = (global as unknown as { Memory: Memory }).Memory;
    assert.strictEqual(
      failedMemory.runtime.migrationError,
      `Unsupported Memory.version 999; current version is ${CURRENT_MEMORY_VERSION}`
    );
  });

  it("repairs partial current-version memory before creating services", () => {
    const memory = mockMemory();
    const game = mockGame();
    const defaults = createDefaultProjectMemorySections();

    memory.config = defaults.config;
    memory.runtime = defaults.runtime;
    memory.stats = defaults.stats;
    memory.version = CURRENT_MEMORY_VERSION;
    delete (memory.config as Partial<Memory["config"]>).observability;
    delete (memory.runtime as Partial<Memory["runtime"]>).environment;
    delete (memory.runtime as Partial<Memory["runtime"]>).sim;
    game.shard.name = "shard0";

    const result = new Kernel().run();

    assert.isTrue(result.ok);
    assert.equal(memory.config.observability.logLevel, "info");
    assert.equal(memory.runtime.environment.type, RuntimeEnvironment.world);
    assert.equal(memory.stats.ticks, game.time);
  });

  it("continues after non-migration stage failure", () => {
    consoleLog = sinon.stub(console, "log");
    const observedStages: LifecycleStageName[] = [];
    const stages: LifecycleStageOverrides = {};

    for (const stageName of KERNEL_STAGE_ORDER) {
      stages[stageName] = () => {
        observedStages.push(stageName);

        if (stageName === "refreshServices") {
          throw new Error("refresh failed");
        }
      };
    }

    const result = new Kernel({ stages }).run();
    const expectedStageOrder = [...KERNEL_STAGE_ORDER];

    assert.isFalse(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.deepEqual(observedStages, expectedStageOrder);
    assert.deepEqual(result.failures, [
      {
        stage: "refreshServices",
        message: "refresh failed"
      }
    ]);
    assert.include(result.executedStages, "cleanup");
    assert.isTrue(consoleLog.calledOnceWith("Kernel stage refreshServices failed: refresh failed"));
  });

  it("runs the integrated lifecycle with services, command install, environment, cleanup profiling, and stats", () => {
    const game = mockGame();
    const memory = mockMemory();

    game.shard.name = "shard0";
    game.time = 50;
    game.cpu.getUsed = createCpuSequence([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const result = new Kernel().run();

    assert.isTrue(result.ok);
    assert.deepEqual(result.executedStages, [...KERNEL_STAGE_ORDER]);
    assert.equal(Memory.stats.ticks, 50);
    assert.isTrue(memory.stats.cpu.available);
    assert.equal(memory.runtime.environment.type, RuntimeEnvironment.world);
    assert.equal(memory.runtime.environment.shard, "shard0");
    assert.exists((global as unknown as KernelCommandGlobalState).cmd);
    const cmd = (global as unknown as KernelCommandGlobalState).cmd;

    assert.isString(cmd?.help());
    assert.include(cmd?.help() ?? "", "cmd.env.help()");
    assert.isAtLeast(memory.stats.cpu.stages.cleanup.samples, 1);
    assert.containsAllKeys(memory.stats.cpu.stages, [
      "installCommands",
      "detectEnvironmentBootstrap",
      "runColoniesAndProcesses",
      "runSpawning",
      "cleanup"
    ]);
  });

  it("runs colony context, process definitions, and dry-run spawning in the default lifecycle", () => {
    const game = mockGame();
    const memory = mockMemory() as Memory;
    const spawn = createKernelSpawn("SpawnPrimary");

    game.time = 200;
    game.rooms = {
      W1N1: createMockRoom({
        name: "W1N1",
        controller: { id: "controller-primary", my: true, level: 2 },
        spawns: [spawn],
        sources: [{ id: "source-a" }],
        creeps: [{ name: "Worker1", memory: { role: "worker" } }],
        constructionSites: [],
        hostiles: [],
        energyAvailable: 300,
        energyCapacityAvailable: 550
      }),
      W2N2: createMockRoom({
        name: "W2N2",
        controller: { id: "controller-sim", my: false, level: 1 },
        spawns: [],
        sources: [],
        creeps: [],
        constructionSites: [],
        hostiles: [],
        energyAvailable: 0,
        energyCapacityAvailable: 0
      })
    };
    game.spawns = {
      SpawnPrimary: spawn
    };

    Object.assign(memory, {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    });
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "spawn-worker-200",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "kernel dry-run validation",
        requestedTick: 199
      })
    );

    const result = new Kernel().run();

    assert.isTrue(result.ok);
    assert.equal(memory.config.colony.primaryRoomName, "W1N1");
    assert.equal(memory.colonies.W1N1.status, "ready");
    assert.equal(memory.colonies.W2N2.status, "degraded");
    assert.deepEqual(memory.colonies.W2N2.intel.missingReasons, ["missing spawn", "missing source"]);
    assert.equal(memory.processes.colonyIntel.lastRunTick, 200);
    assert.equal(memory.processes.creepRoles.lastRunTick, 200);
    assert.include(memory.processes.creepRoles.lastResult ?? "", "role behavior deferred to Phase 6");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "validated");
    assert.deepEqual(spawn.calls[0].options, {
      memory: { role: "worker" },
      dryRun: true
    });
  });

  it("records a failed stage sample and still reaches later lifecycle stages", () => {
    consoleLog = sinon.stub(console, "log");
    const game = mockGame();
    const memory = mockMemory();
    const stages: LifecycleStageOverrides = {
      runSpawning: () => {
        throw new Error("failed stage");
      }
    };

    game.shard.name = "shard0";
    game.time = 60;
    game.cpu.getUsed = createCpuSequence([0, 1, 2, 3, 4, 5, 6, 7]);

    const result = new Kernel({ stages }).run();

    assert.isFalse(result.ok);
    assert.deepEqual(result.executedStages, [...KERNEL_STAGE_ORDER]);
    assert.deepEqual(result.failures, [
      {
        stage: "runSpawning",
        message: "failed stage"
      }
    ]);
    assert.isAtLeast(memory.stats.cpu.stages.runSpawning.samples, 1);
    assert.isAtLeast(memory.stats.cpu.stages.cleanup.samples, 1);
    assert.equal(Memory.stats.ticks, 60);
    assert.isTrue(consoleLog.calledWith("Kernel stage runSpawning failed: failed stage"));
  });

  it("continues after command install failed while later stages still run", () => {
    consoleLog = sinon.stub(console, "log");
    const observedStages: LifecycleStageName[] = [];
    const stages: LifecycleStageOverrides = {
      installCommands: () => {
        observedStages.push("installCommands");
        throw new Error("command install failed");
      },
      detectEnvironmentBootstrap: () => observedStages.push("detectEnvironmentBootstrap"),
      runColoniesAndProcesses: () => observedStages.push("runColoniesAndProcesses"),
      runSpawning: () => observedStages.push("runSpawning"),
      cleanup: () => observedStages.push("cleanup"),
      flushStats: () => observedStages.push("flushStats")
    };

    const result = new Kernel({ stages }).run();

    assert.isFalse(result.ok);
    assert.include(result.executedStages, "installCommands");
    assert.include(result.executedStages, "cleanup");
    assert.deepEqual(result.failures, [
      {
        stage: "installCommands",
        message: "command install failed"
      }
    ]);
    assert.deepEqual(observedStages, [
      "installCommands",
      "detectEnvironmentBootstrap",
      "runColoniesAndProcesses",
      "runSpawning",
      "cleanup",
      "flushStats"
    ]);
    assert.isTrue(consoleLog.calledWith("Kernel stage installCommands failed: command install failed"));
  });

  it("runs dead creep memory cleanup in the cleanup stage", () => {
    consoleLog = sinon.stub(console, "log");
    const observedStages: LifecycleStageName[] = [];
    const stages: LifecycleStageOverrides = {};
    const memory = mockMemory();
    const game = mockGame();
    memory.creeps.persistValue = "any value";
    memory.creeps.notPersistValue = "any value";
    game.creeps.persistValue = "any value";

    for (const stageName of KERNEL_STAGE_ORDER) {
      if (stageName === "runSpawning") {
        stages[stageName] = () => {
          observedStages.push(stageName);
          assert.isDefined(memory.creeps.notPersistValue);
        };
      } else if (stageName !== "cleanup") {
        stages[stageName] = () => observedStages.push(stageName);
      }
    }

    const result = new Kernel({ stages }).run();

    assert.isTrue(result.ok);
    assert.deepEqual(result.executedStages, [...KERNEL_STAGE_ORDER]);
    assert.deepEqual(observedStages, [
      "migrate",
      "refreshServices",
      "installCommands",
      "detectEnvironmentBootstrap",
      "runColoniesAndProcesses",
      "runSpawning",
      "flushStats"
    ]);
    assert.isDefined(memory.creeps.persistValue);
    assert.isUndefined(memory.creeps.notPersistValue);
    assert.isTrue(consoleLog.calledOnceWith("Cleaned up 1 stale creep memory entries"));
  });
});

function createCpuSequence(values: number[]): () => number {
  const cpuValues = [...values];

  return () => {
    const value = cpuValues.shift();

    return value === undefined ? values[values.length - 1] : value;
  };
}

interface KernelSpawn extends StructureSpawn {
  calls: Array<{
    body: BodyPartConstant[];
    name: string;
    options: SpawnOptions;
  }>;
}

function createKernelSpawn(name: string): KernelSpawn {
  const calls: KernelSpawn["calls"] = [];

  return {
    id: `${name}-id`,
    name,
    spawning: null,
    calls,
    spawnCreep: (body: BodyPartConstant[], creepName: string, options: SpawnOptions): ScreepsReturnCode => {
      calls.push({
        body,
        name: creepName,
        options
      });

      return OK;
    }
  } as KernelSpawn;
}
