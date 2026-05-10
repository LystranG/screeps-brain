import { assert } from "chai";
import * as sinon from "sinon";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_LIFECYCLE_STAGES, KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame, createMockMemory, mockGame, mockMemory } from "./mock";

describe("kernel lifecycle", () => {
  // v2.0 骨架生命周期：仅保留服务初始化和环境检测阶段。
  const expectedStageOrder: LifecycleStageName[] = [
    "refreshServices",
    "detectEnvironmentBootstrap"
  ];

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
        if (stageName === "detectEnvironmentBootstrap") {
          throw new Error("environment bootstrap failed");
        }
      };
    }

    const result = new Kernel({ stages }).run();

    assert.isFalse(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.deepEqual(observedStages, expectedStageOrder);
    assert.deepEqual(result.failures, [{ stage: "detectEnvironmentBootstrap", message: "environment bootstrap failed" }]);
    assert.isTrue(consoleLog!.calledWith("Kernel stage detectEnvironmentBootstrap failed: environment bootstrap failed"));
  });

  it("runs the integrated lifecycle with services and environment detection", () => {
    const game = mockGame();
    const memory = mockMemory();

    game.shard.name = "shard0";
    game.time = 50;
    Object.assign(memory, createDefaultProjectMemorySections());

    const result = new Kernel().run();

    assert.isTrue(result.ok);
    assert.deepEqual(result.executedStages, expectedStageOrder);
    assert.equal(memory.runtime.environment.type, "world");
    assert.equal(memory.runtime.environment.shard, "shard0");
  });
});
