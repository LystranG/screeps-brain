import { assert } from "chai";
import * as sinon from "sinon";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
import { createMockGame, createMockMemory, mockGame, mockMemory } from "./mock";

describe("cleanup|kernel runtime kernel", () => {
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
        message: "Unsupported Memory.version 999; current version is 1"
      }
    ]);
    const failedMemory = (global as unknown as { Memory: Memory }).Memory;
    assert.strictEqual(failedMemory.runtime.migrationError, "Unsupported Memory.version 999; current version is 1");
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
