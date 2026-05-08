import { assert } from "chai";
import * as sinon from "sinon";
import { ProcessName } from "constants/processes";
import { RoleName } from "constants/roles";
import { RuntimeEnvironment } from "constants/runtime";
import { CURRENT_MEMORY_VERSION, createDefaultProjectMemorySections, createDefaultStrategyPlanMemory } from "memory/schema";
import { createSpawnRequest } from "spawning/queue";
import { createTaskMemory, TaskType } from "tasks/model";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_LIFECYCLE_STAGES, KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
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

  it("defines lifecycle stages as ordered stage objects with light module entry runners", () => {
    assert.deepEqual(
      KERNEL_LIFECYCLE_STAGES.map(stage => stage.name),
      [...KERNEL_STAGE_ORDER]
    );
    assert.isTrue(KERNEL_LIFECYCLE_STAGES.every(stage => typeof stage.run === "function"));
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

  it("runs colony context, process definitions, and real spawning in the default lifecycle", () => {
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
        creeps: [],
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
    memory.colonies.W1N1 = {
      roomName: "W1N1",
      primary: true,
      status: "ready",
      intel: {
        roomName: "W1N1",
        lastSeenTick: 199,
        lastRefreshTick: 199,
        status: "ready",
        missingReasons: [],
        controllerId: "controller-primary",
        rcl: 2,
        sourceIds: ["source-a"],
        spawnIds: ["SpawnPrimary-id"],
        primary: true,
        stage: "rcl2"
      },
      spawnQueue: [
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
      ],
      strategy: createDefaultStrategyPlanMemory("W1N1", "test")
    };

    const result = new Kernel().run();

    assert.isTrue(result.ok);
    assert.equal(memory.config.colony.primaryRoomName, "W1N1");
    assert.equal(memory.colonies.W1N1.status, "ready");
    assert.equal(memory.colonies.W2N2.status, "degraded");
    assert.deepEqual(memory.colonies.W2N2.intel.missingReasons, ["missing spawn", "missing source"]);
    assert.equal(memory.processes.colonyIntel.lastRunTick, 200);
    assert.equal(memory.processes[ProcessName.strategyPlanning].lastRunTick, 200);
    assert.include(memory.processes[ProcessName.strategyPlanning].lastResult ?? "", "strategy refreshed=");
    assert.equal(memory.processes[ProcessName.bootstrapExecution].lastStatus, "ok");
    assert.equal(memory.processes[ProcessName.bootstrapExecution].lastRunTick, 200);
    assert.equal(memory.processes.creepRoles.lastRunTick, 200);
    assert.equal(memory.processes.creepRoles.lastResult, "creep roles dispatched");
    assert.include(["validated", "spawning"], memory.colonies.W1N1.spawnQueue[0].status);
    assert.isTrue(memory.colonies.W1N1.spawnQueue.some(request => request.id.indexOf("bootstrap:W1N1:") === 0));
    assert.deepEqual(spawn.calls[0].options, {
      memory: { role: "worker" },
      dryRun: true
    });
  });

  describe("kernel strategy sim handoff", () => {
    it("runs sim-ready rooms through runColoniesAndProcesses and persists summaries", () => {
      const game = mockGame();
      const memory = mockMemory() as Memory;
      const spawn = createKernelSpawn("SpawnSim");

      game.shard.name = "sim";
      game.time = 250;
      game.rooms = {
        W9N9: createMockRoom({
          name: "W9N9",
          controller: { id: "controller-sim-ready", my: true, level: 1 },
          spawns: [spawn],
          sources: [{ id: "source-sim-a" }],
          creeps: [],
          constructionSites: [],
          hostiles: [],
          energyAvailable: 300,
          energyCapacityAvailable: 300
        })
      };
      game.spawns = {
        SpawnSim: spawn
      };

      Object.assign(memory, {
        ...createDefaultProjectMemorySections(),
        creeps: {}
      });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.include(result.executedStages, "runColoniesAndProcesses");
      assert.isTrue(memory.runtime.sim.bootstrap.ready);
      assert.equal(memory.colonies.W9N9.status, "ready");
      assert.equal(memory.colonies.W9N9.strategy.lastRunTick, 250);
      assert.equal(memory.processes[ProcessName.strategyPlanning].lastResult, "strategy refreshed=1 skipped=0 errors=0");
      assert.isTrue(memory.colonies.W9N9.spawnQueue.some(request => request.id.indexOf("bootstrap:W9N9:") === 0));
    });

    it("runs degraded sim rooms through normal path without creating spawn queue entries", () => {
      const game = mockGame();
      const memory = mockMemory() as Memory;

      game.shard.name = "sim";
      game.time = 260;
      game.rooms = {
        W8N8: createMockRoom({
          name: "W8N8",
          controller: { id: "controller-sim-degraded", my: true, level: 1 },
          spawns: [],
          sources: [],
          creeps: [],
          constructionSites: [],
          hostiles: [],
          energyAvailable: 0,
          energyCapacityAvailable: 0
        })
      };
      game.spawns = {};

      Object.assign(memory, {
        ...createDefaultProjectMemorySections(),
        creeps: {}
      });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.include(result.executedStages, "runColoniesAndProcesses");
      assert.isFalse(memory.runtime.sim.bootstrap.ready);
      assert.deepEqual(memory.colonies.W8N8.intel.missingReasons, ["missing spawn", "missing source"]);
      assert.equal(memory.colonies.W8N8.strategy.lastRunTick, 260);
      assert.equal(memory.colonies.W8N8.strategy.stage, "degraded");
      assert.include(memory.colonies.W8N8.strategy.reasons, "repair: degraded colony missing spawn, missing source");
      assert.lengthOf(memory.colonies.W8N8.spawnQueue, 0);
    });

    it("records guidance when official sim only has a controller", () => {
      const game = mockGame();
      const memory = mockMemory() as Memory;

      game.shard.name = "sim";
      game.time = 270;
      game.rooms = {
        W7N7: createMockRoom({
          name: "W7N7",
          controller: { id: "controller-only", my: true, level: 1 },
          spawns: [],
          sources: [],
          creeps: [],
          constructionSites: [],
          hostiles: []
        })
      };
      game.spawns = {};

      Object.assign(memory, {
        ...createDefaultProjectMemorySections(),
        creeps: {}
      });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.containsAllKeys(memory.runtime.sim.guidance, ["missing-spawn", "missing-source"]);
      assert.notProperty(memory.runtime.sim.guidance, "missing-controller");
      assert.include(
        memory.runtime.sim.guidance["missing-spawn"].message ?? "",
        "runtime code cannot create sources, spawns, or initial creeps"
      );
      assert.lengthOf(memory.colonies.W7N7.spawnQueue, 0);
    });

    it("runs sim-ready rooms with spawn source and controller through bootstrap", () => {
      const game = mockGame();
      const memory = mockMemory() as Memory;
      const spawn = createKernelSpawn("SpawnReadySim");

      game.shard.name = "sim";
      game.time = 280;
      game.rooms = {
        W6N6: createMockRoom({
          name: "W6N6",
          controller: { id: "controller-ready", my: true, level: 1 },
          spawns: [spawn],
          sources: [{ id: "source-ready" }],
          creeps: [],
          constructionSites: [],
          hostiles: [],
          energyAvailable: 300,
          energyCapacityAvailable: 300
        })
      };
      game.spawns = {
        SpawnReadySim: spawn
      };

      Object.assign(memory, {
        ...createDefaultProjectMemorySections(),
        creeps: {}
      });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.equal(memory.colonies.W6N6.status, "ready");
      assert.equal(memory.processes[ProcessName.bootstrapExecution].lastStatus, "ok");
      assert.isTrue(memory.colonies.W6N6.spawnQueue.some(request => request.id.indexOf("bootstrap:W6N6:") === 0));
      assert.deepEqual(Object.keys(memory.runtime.sim.guidance), ["missing-creep"]);
    });
  });

  describe("kernel bootstrap matrix", () => {
    it("normal ready room creates bootstrap queue demand", () => {
      const { game, memory, spawn } = setupKernelBootstrapRoom({ shardName: "shard0", tick: 300 });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.equal(memory.colonies.W1N1.status, "ready");
      assert.equal(memory.processes[ProcessName.bootstrapExecution].lastStatus, "ok");
      assert.isTrue(memory.colonies.W1N1.spawnQueue.some(request => request.id.indexOf("bootstrap:W1N1:") === 0));
      assert.include(["validated", "spawning"], memory.colonies.W1N1.spawnQueue[0].status);
      assert.deepEqual(game.creeps, {});
      assert.deepEqual(spawn.calls.map(call => call.options.dryRun), [true]);
    });

    it("sim ready room uses normal bootstrap process", () => {
      const { memory } = setupKernelBootstrapRoom({ shardName: "sim", tick: 310 });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.isTrue(memory.runtime.sim.bootstrap.ready);
      assert.equal(memory.colonies.W1N1.status, "ready");
      assert.equal(memory.processes[ProcessName.bootstrapExecution].lastStatus, "ok");
      assert.isTrue(memory.colonies.W1N1.spawnQueue.some(request => request.id.indexOf("bootstrap:W1N1:") === 0));
      assert.deepEqual(Object.keys(memory.runtime.sim.guidance), ["missing-creep"]);
    });

    it("missing spawn records degraded context without queue demand", () => {
      const { memory } = setupKernelBootstrapRoom({ shardName: "shard0", tick: 320, includeSpawn: false });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.equal(memory.colonies.W1N1.status, "degraded");
      assert.include(memory.colonies.W1N1.intel.missingReasons, "missing spawn");
      assert.lengthOf(memory.colonies.W1N1.spawnQueue, 0);
    });

    it("missing source records guidance without harvest demand", () => {
      const { memory } = setupKernelBootstrapRoom({ shardName: "sim", tick: 330, includeSource: false });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.include(memory.colonies.W1N1.intel.missingReasons, "missing source");
      assert.include(Object.keys(memory.runtime.sim.guidance), "missing-source");
      assert.isFalse(memory.colonies.W1N1.spawnQueue.some(request => request.reason.indexOf("harvest source") >= 0));
    });

    it("missing controller records guidance without upgrade demand", () => {
      const { memory } = setupKernelBootstrapRoom({ shardName: "sim", tick: 335, includeController: false });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.include(memory.colonies.W1N1.intel.missingReasons, "missing controller");
      assert.include(Object.keys(memory.runtime.sim.guidance), "missing-controller");
      assert.isFalse(memory.colonies.W1N1.spawnQueue.some(request => request.reason.indexOf("upgrade controller") >= 0));
    });

    it("missing creep creates spawn demand", () => {
      const { memory } = setupKernelBootstrapRoom({ shardName: "shard0", tick: 340 });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.lengthOf(Object.keys(memory.creeps), 0);
      assert.isAtLeast(memory.colonies.W1N1.spawnQueue.length, 1);
      assert.isTrue(memory.colonies.W1N1.spawnQueue.every(request => request.id.indexOf("bootstrap:W1N1:") === 0));
    });

    it("ready room worker executes assigned harvest through creepRoles", () => {
      const source = createKernelSource("source-a");
      const creep = createKernelActionCreep("Worker1", RoleName.worker, 0, 50);
      creep.memory.task = createTaskMemory(TaskType.harvest, source.id, 350);
      setupKernelBootstrapRoom({
        shardName: "shard0",
        tick: 351,
        sources: [source],
        creeps: [creep]
      });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.deepEqual(creep.actionCalls.map(call => call.action), ["harvest"]);
      assert.equal(creep.memory.task.status, "running");
      assert.equal(Memory.processes[ProcessName.creepRoles].lastStatus, "ok");
    });

    it("ready room worker executes assigned upgrade through creepRoles", () => {
      const controller = createKernelController("controller-a");
      const creep = createKernelActionCreep("Worker1", RoleName.worker, 50, 0);
      creep.memory.task = createTaskMemory(TaskType.upgrade, controller.id, 355);
      setupKernelBootstrapRoom({
        shardName: "shard0",
        tick: 356,
        controller,
        creeps: [creep]
      });

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.deepEqual(creep.actionCalls.map(call => call.action), ["upgradeController"]);
      assert.equal(creep.memory.task.status, "running");
      assert.equal(Memory.processes[ProcessName.creepRoles].lastStatus, "ok");
    });

    it("spawning request completes only after Game.creeps contains creepName", () => {
      const request = createSpawnRequest({
        id: "bootstrap:W1N1:source:source-a:0:worker",
        roomName: "W1N1",
        role: RoleName.worker,
        priority: 20,
        body: ["work", "carry", "move"],
        memory: { role: RoleName.worker } as CreepMemory,
        reason: "harvest source source-a",
        requestedTick: 360
      });
      request.status = "spawning";
      request.spawnName = "SpawnPrimary";
      request.creepName = "WorkerPending";

      const setup = setupKernelBootstrapRoom({ shardName: "shard0", tick: 361, spawnQueue: [request] });

      new Kernel().run();
      assert.equal(setup.memory.colonies.W1N1.spawnQueue[0].status, "spawning");

      setup.game.time = 362;
      setup.game.creeps.WorkerPending = createKernelActionCreep("WorkerPending", RoleName.worker, 0, 50);

      const result = new Kernel().run();

      assert.isTrue(result.ok);
      assert.equal(setup.memory.colonies.W1N1.spawnQueue[0].status, "spawned");
      assert.equal(setup.memory.colonies.W1N1.spawnQueue[0].completedTick, 362);
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

interface KernelActionCall {
  action: "harvest" | "upgradeController" | "moveTo";
  target: { id?: string };
}

interface KernelActionCreep extends Creep {
  actionCalls: KernelActionCall[];
}

interface KernelBootstrapRoomOptions {
  shardName: string;
  tick: number;
  includeSpawn?: boolean;
  includeSource?: boolean;
  includeController?: boolean;
  sources?: Source[];
  controller?: StructureController;
  creeps?: Creep[];
  spawnQueue?: ReturnType<typeof createSpawnRequest>[];
}

interface KernelBootstrapRoomSetup {
  game: ReturnType<typeof createMockGame>;
  memory: Memory;
  spawn: KernelSpawn;
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

function setupKernelBootstrapRoom(options: KernelBootstrapRoomOptions): KernelBootstrapRoomSetup {
  const game = mockGame();
  const memory = mockMemory() as Memory;
  const spawn = createKernelSpawn("SpawnPrimary");
  const includeSpawn = options.includeSpawn !== false;
  const includeSource = options.includeSource !== false;
  const includeController = options.includeController !== false;
  const sources = options.sources ?? (includeSource ? [createKernelSource("source-a")] : []);
  const controller = options.controller ?? createKernelController("controller-a");
  const creeps = options.creeps ?? [];

  game.shard.name = options.shardName;
  game.time = options.tick;
  game.rooms = {
    W1N1: createMockRoom({
      name: "W1N1",
      controller: includeController ? controller : undefined,
      spawns: includeSpawn ? [spawn] : [],
      sources,
      creeps,
      constructionSites: [],
      hostiles: [],
      energyAvailable: includeSpawn ? 300 : 0,
      energyCapacityAvailable: includeSpawn ? 300 : 0
    })
  };
  game.spawns = includeSpawn ? { SpawnPrimary: spawn } : {};
  game.creeps = creeps.reduce((indexedCreeps, creep) => {
    indexedCreeps[creep.name] = creep;

    return indexedCreeps;
  }, {} as ReturnType<typeof createMockGame>["creeps"]);

  Object.assign(memory, {
    ...createDefaultProjectMemorySections(),
    creeps: {}
  });

  if (options.spawnQueue) {
    memory.colonies.W1N1 = {
      roomName: "W1N1",
      primary: true,
      status: "ready",
      intel: {
        roomName: "W1N1",
        lastSeenTick: options.tick - 1,
        lastRefreshTick: options.tick - 1,
        status: "ready",
        missingReasons: [],
        controllerId: "controller-a",
        rcl: 1,
        sourceIds: sources.map(source => source.id),
        spawnIds: includeSpawn ? [spawn.id] : [],
        primary: true,
        stage: "rcl1"
      },
      spawnQueue: options.spawnQueue,
      strategy: createDefaultStrategyPlanMemory("W1N1", "kernel-bootstrap-matrix")
    };
  }

  return { game, memory, spawn };
}

function createKernelSource(id: string): Source {
  return {
    id,
    pos: {
      roomName: "W1N1",
      x: 10,
      y: 20
    }
  } as Source;
}

function createKernelController(id: string): StructureController {
  return {
    id,
    my: true,
    level: 1,
    pos: {
      roomName: "W1N1",
      x: 20,
      y: 20
    }
  } as StructureController;
}

function createKernelActionCreep(name: string, role: RoleName, usedEnergy: number, freeEnergy: number): KernelActionCreep {
  const actionCalls: KernelActionCall[] = [];

  return {
    name,
    memory: {
      role
    },
    pos: {
      findClosestByRange: (targets: Source[]): Source | null => targets[0] ?? null
    },
    store: {
      getUsedCapacity: (resource?: ResourceConstant): number =>
        resource === undefined || resource === RESOURCE_ENERGY ? usedEnergy : 0,
      getFreeCapacity: (resource?: ResourceConstant): number =>
        resource === undefined || resource === RESOURCE_ENERGY ? freeEnergy : 0
    },
    harvest(target: Source): ScreepsReturnCode {
      actionCalls.push({ action: "harvest", target });

      return OK;
    },
    upgradeController(target: StructureController): ScreepsReturnCode {
      actionCalls.push({ action: "upgradeController", target });

      return OK;
    },
    moveTo(target: RoomPosition | { pos: RoomPosition }): CreepMoveReturnCode | ERR_NO_PATH | ERR_INVALID_TARGET {
      actionCalls.push({ action: "moveTo", target: target as { id?: string } });

      return OK;
    },
    actionCalls
  } as unknown as KernelActionCreep;
}
