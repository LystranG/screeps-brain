import { assert } from "chai";
import * as sinon from "sinon";
import { Logger } from "logging/Logger";
import { createDefaultProjectMemorySections } from "memory/schema";
import { SIM_BOOTSTRAP_VERSION, runSimBootstrap } from "environment/simBootstrap";
import { createMockGame } from "./mock";

describe("sim bootstrap", () => {
  it("no-ops outside sim", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 1);
    game.shard.name = "shard0";

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 1);

    assert.deepEqual(result, { ran: false, ready: false });
    assert.equal(memory.runtime.sim.bootstrap.version, 0);
  });

  it("records idempotent missing-object guidance and logger output once", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 10);
    const warn = sinon.stub(logger, "warn");

    const firstResult = runSimBootstrap(memory, game as unknown as Game, logger, 10);
    const secondResult = runSimBootstrap(memory, game as unknown as Game, logger, 11);

    assert.isTrue(firstResult.ran);
    assert.isFalse(firstResult.ready);
    assert.sameMembers(firstResult.guidanceCodes || [], ["missing-source", "missing-spawn", "missing-creep"]);
    assert.sameMembers(secondResult.guidanceCodes || [], ["missing-source", "missing-spawn", "missing-creep"]);
    assert.equal(warn.callCount, 3);
    assert.equal(memory.runtime.sim.bootstrap.version, SIM_BOOTSTRAP_VERSION);
    assert.isTrue(memory.runtime.sim.bootstrap.completed);
    assert.isFalse(memory.runtime.sim.bootstrap.ready);
    assert.equal(memory.runtime.sim.bootstrap.lastRunTick, 11);
    assert.equal(memory.runtime.sim.guidance["missing-source"].lastSeenTick, 11);
    assert.equal(memory.runtime.sim.guidance["missing-source"].lastLoggedTick, 10);
  });

  it("marks ready when visible sources and spawns exist", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 20);

    game.rooms = {
      W1N1: { sources: [{}] }
    };
    game.spawns = {
      Spawn1: {}
    };
    game.creeps = {
      Worker1: {}
    };

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 20);

    assert.isTrue(result.ready);
    assert.deepEqual(result.guidanceCodes, []);
    assert.isTrue(memory.runtime.sim.bootstrap.ready);
  });

  it("uses room.find source detection when the room mock exposes it", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 30);
    const find = sinon.stub().returns([{}]);

    game.rooms = {
      W1N1: { find }
    };
    game.spawns = {
      Spawn1: {}
    };
    game.creeps = {
      Worker1: {}
    };

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 30);

    assert.isTrue(result.ready);
    assert.isTrue(find.calledOnce);
  });
});

function createMemoryWithDefaults(): Memory {
  return {
    ...createDefaultProjectMemorySections(),
    creeps: {},
    flags: {},
    powerCreeps: {},
    rooms: {},
    spawns: {}
  };
}
