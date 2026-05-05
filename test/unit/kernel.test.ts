import { assert } from "chai";
import * as sinon from "sinon";
import { RuntimeEnvironment } from "constants/runtime";
import { CURRENT_MEMORY_VERSION } from "memory/schema";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
import { createMockGame, createMockMemory, mockGame, mockMemory } from "./mock";

describe("kernel|stats cleanup|kernel runtime kernel", () => {
  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = createMockGame();
    // @ts-ignore : allow adding Memory to global
    global.Memory = createMockMemory();
  });

  afterEach(() => {
    if (consoleLog) {
      consoleLog.restore();
      consoleLog = null;
    }
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

  it("runs the integrated lifecycle with services, environment, cleanup profiling, and stats", () => {
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
    assert.isAtLeast(memory.stats.cpu.stages.cleanup.samples, 1);
    assert.containsAllKeys(memory.stats.cpu.stages, [
      "refreshServices",
      "detectEnvironmentBootstrap",
      "runColoniesAndProcesses",
      "runSpawning",
      "cleanup"
    ]);
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
