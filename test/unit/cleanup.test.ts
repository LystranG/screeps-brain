import { assert } from "chai";
import * as sinon from "sinon";
import { cleanupDeadCreepMemory } from "../../src/cleanup/creepMemory";
import { createMockGame, createMockMemory, mockGame, mockMemory } from "./mock";

describe("cleanup|kernel cleanup", () => {
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

  it("deletes missing creep memory", () => {
    consoleLog = sinon.stub(console, "log");
    const memory = mockMemory();
    memory.creeps.missingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };

    const deletedCount = cleanupDeadCreepMemory();

    assert.equal(deletedCount, 1);
    assert.isUndefined(memory.creeps.missingCreep);
    assert.isTrue(consoleLog.calledOnceWith("Cleaned up 1 stale creep memory entries"));
  });

  it("preserves existing creep memory", () => {
    const memory = mockMemory();
    const game = mockGame();
    memory.creeps.existingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };
    game.creeps.existingCreep = "mock creep";

    const deletedCount = cleanupDeadCreepMemory();

    assert.equal(deletedCount, 0);
    assert.isDefined(memory.creeps.existingCreep);
  });

  it("logs one summary when stale creep memory is deleted", () => {
    consoleLog = sinon.stub(console, "log");
    const memory = mockMemory();
    memory.creeps.firstMissingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };
    memory.creeps.secondMissingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };

    const deletedCount = cleanupDeadCreepMemory();

    assert.equal(deletedCount, 2);
    assert.isTrue(consoleLog.calledOnceWith("Cleaned up 2 stale creep memory entries"));
  });
});
