import { assert } from "chai";
import * as sinon from "sinon";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { KERNEL_STAGE_ORDER, LifecycleStageName } from "../../src/runtime/lifecycle";
import { Game, Memory } from "./mock";

describe("kernel", () => {
  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = _.clone(Game);
    // @ts-ignore : allow adding Memory to global
    global.Memory = _.clone(Memory);
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
    // @ts-ignore : allow mutating mocked global Memory
    global.Memory.version = 999;
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
});
