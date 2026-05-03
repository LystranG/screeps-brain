import { assert } from "chai";
import * as sinon from "sinon";
import { cleanupDeadCreepMemory } from "../../src/cleanup/creepMemory";
import { Game, Memory } from "./mock";

describe("cleanup|kernel cleanup", () => {
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

  it("deletes missing creep memory", () => {
    consoleLog = sinon.stub(console, "log");
    Memory.creeps.missingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };

    const deletedCount = cleanupDeadCreepMemory();

    assert.equal(deletedCount, 1);
    assert.isUndefined(Memory.creeps.missingCreep);
    assert.isTrue(consoleLog.calledOnceWith("Cleaned up 1 stale creep memory entries"));
  });

  it("preserves existing creep memory", () => {
    Memory.creeps.existingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };
    Game.creeps.existingCreep = "mock creep";

    const deletedCount = cleanupDeadCreepMemory();

    assert.equal(deletedCount, 0);
    assert.isDefined(Memory.creeps.existingCreep);
  });

  it("logs one summary when stale creep memory is deleted", () => {
    consoleLog = sinon.stub(console, "log");
    Memory.creeps.firstMissingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };
    Memory.creeps.secondMissingCreep = {
      role: "worker",
      room: "W1N1",
      working: false
    };

    const deletedCount = cleanupDeadCreepMemory();

    assert.equal(deletedCount, 2);
    assert.isTrue(consoleLog.calledOnceWith("Cleaned up 2 stale creep memory entries"));
  });
});
