import { assert } from "chai";
import * as sinon from "sinon";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_LIFECYCLE_STAGES, KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame, createMockMemory, mockGame, mockMemory } from "./mock";

describe("kernel lifecycle", () => {
  const expectedStageOrder: LifecycleStageName[] = [
    "refreshServices",
    "installCommands",
    "detectEnvironmentBootstrap",
    "cleanup"
  ];

  interface KernelCommandGlobalState {
    cmd?: { help(): string };
    __cmdApiVersion?: number;
  }

  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = createMockGame();
    // @ts-ignore : allow adding Memory to global
    global.Memory = createMockMemory();
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

    assert.isTrue(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.deepEqual(observedStages, expectedStageOrder);
    assert.deepEqual(result.failures, []);
  });

  it("defines lifecycle stages as ordered stage objects with runners", () => {
    assert.deepEqual(
      KERNEL_LIFECYCLE_STAGES.map(stage => stage.name),
      expectedStageOrder
    );
    assert.isTrue(KERNEL_LIFECYCLE_STAGES.every(stage => typeof stage.run === "function"));
  });

  it("continues after non-critical stage failure", () => {
    consoleLog = sinon.stub(console, "log");
    const observedStages: LifecycleStageName[] = [];
    const stages: LifecycleStageOverrides = {};

    for (const stageName of KERNEL_STAGE_ORDER) {
      stages[stageName] = () => {
        observedStages.push(stageName);
        if (stageName === "installCommands") {
          throw new Error("command install failed");
        }
      };
    }

    const result = new Kernel({ stages }).run();

    assert.isFalse(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.deepEqual(observedStages, expectedStageOrder);
    assert.deepEqual(result.failures, [{ stage: "installCommands", message: "command install failed" }]);
    assert.isTrue(consoleLog!.calledWith("Kernel stage installCommands failed: command install failed"));
  });

  it("runs the integrated lifecycle with services, commands, environment, and cleanup", () => {
    const game = mockGame();
    const memory = mockMemory();

    game.shard.name = "shard0";
    game.time = 50;
    Object.assign(memory, createDefaultProjectMemorySections());

    const result = new Kernel().run();

    assert.isTrue(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.exists((global as unknown as KernelCommandGlobalState).cmd);
    assert.isString((global as unknown as KernelCommandGlobalState).cmd?.help());
    assert.equal(memory.runtime.environment.type, "world");
    assert.equal(memory.runtime.environment.shard, "shard0");
  });

  it("runs dead creep memory cleanup in the cleanup stage", () => {
    consoleLog = sinon.stub(console, "log");
    const memory = mockMemory();
    const game = mockGame();
    game.shard.name = "shard0";
    Object.assign(memory, createDefaultProjectMemorySections());
    memory.creeps.persistValue = "any value";
    memory.creeps.notPersistValue = "any value";
    game.creeps.persistValue = "any value";

    new Kernel().run();

    assert.isDefined(memory.creeps.persistValue);
    assert.isUndefined(memory.creeps.notPersistValue);
    assert.isTrue(consoleLog!.calledOnceWith("Cleaned up 1 stale creep memory entries"));
  });
});
