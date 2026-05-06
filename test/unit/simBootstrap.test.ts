import { assert } from "chai";
import * as sinon from "sinon";
import { Logger } from "logging/Logger";
import { createDefaultProjectMemorySections } from "memory/schema";
import { SIM_BOOTSTRAP_VERSION, runSimBootstrap } from "environment/simBootstrap";
import { createMockGame } from "./mock";

interface GuidanceWithFlagResult {
  flagResult?: string;
}

describe("environment|sim bootstrap|observability sim bootstrap|environment|kernel", () => {
  it("no-ops outside sim", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 1);
    game.shard.name = "shard0";

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 1);

    assert.deepEqual(result, { ran: false, ready: false });
    assert.equal(memory.runtime.sim.bootstrap.version, 0);
  });

  it("does not run sim bootstrap guidance for world, private, or unknown shards", () => {
    const logger = new Logger({}, () => 2);
    const warn = sinon.stub(logger, "warn");

    ["shard1", "private", "custom"].forEach((shardName, index) => {
      const game = createMockGame();
      const memory = createMemoryWithDefaults();

      game.shard.name = shardName;

      const result = runSimBootstrap(memory, game as unknown as Game, logger, index + 2);

      assert.deepEqual(result, { ran: false, ready: false });
      assert.deepEqual(memory.runtime.sim.guidance, {});
      assert.equal(memory.runtime.sim.bootstrap.version, 0);
    });

    assert.isFalse(warn.called);
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
    assert.sameMembers(firstResult.guidanceCodes || [], [
      "missing-controller",
      "missing-source",
      "missing-spawn",
      "missing-creep"
    ]);
    assert.sameMembers(secondResult.guidanceCodes || [], [
      "missing-controller",
      "missing-source",
      "missing-spawn",
      "missing-creep"
    ]);
    assert.equal(warn.callCount, 4);
    assert.equal(memory.runtime.sim.bootstrap.version, SIM_BOOTSTRAP_VERSION);
    assert.isTrue(memory.runtime.sim.bootstrap.completed);
    assert.isFalse(memory.runtime.sim.bootstrap.ready);
    assert.equal(memory.runtime.sim.bootstrap.lastRunTick, 11);
    assert.equal(memory.runtime.sim.guidance["missing-source"].lastSeenTick, 11);
    assert.equal(memory.runtime.sim.guidance["missing-source"].lastLoggedTick, 10);
  });

  it("records spawn and source guidance when official sim only has a controller", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 12);
    sinon.stub(logger, "warn");

    game.rooms = {
      W1N1: {
        controller: {
          id: "controller-sim",
          my: true,
          level: 1
        },
        find: () => []
      }
    };

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 12);

    assert.includeMembers(result.guidanceCodes || [], ["missing-spawn", "missing-source"]);
    assert.notInclude(result.guidanceCodes || [], "missing-controller");
    assert.include(
      memory.runtime.sim.guidance["missing-spawn"].message ?? "",
      "runtime code cannot create sources, spawns, or initial creeps"
    );
    assert.include(
      memory.runtime.sim.guidance["missing-source"].message ?? "",
      "runtime code cannot create sources, spawns, or initial creeps"
    );
  });

  it("records controller guidance when sim lacks a controller", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 13);
    sinon.stub(logger, "warn");

    game.rooms = {
      W1N1: {
        find: () => [{}]
      }
    };
    game.spawns = {
      Spawn1: {}
    };

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 13);

    assert.include(result.guidanceCodes || [], "missing-controller");
    assert.include(
      memory.runtime.sim.guidance["missing-controller"].message ?? "",
      "runtime code cannot create sources, spawns, or initial creeps"
    );
  });

  it("marks ready when visible sources and spawns exist", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 20);

    game.rooms = {
      W1N1: { controller: {}, sources: [{}] }
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
      W1N1: { controller: {}, find }
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

  it("attempts createFlag once for missing guidance", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 40);
    sinon.stub(logger, "warn");
    const createFlag = sinon.stub().returns("lystran-sim-source-needed");

    game.rooms = {
      W1N1: {
        controller: {
          pos: {
            createFlag
          }
        }
      }
    };

    runSimBootstrap(memory, game as unknown as Game, logger, 40);

    assert.isTrue(createFlag.calledWith("lystran-sim-source-needed"));
    assert.isTrue(createFlag.calledWith("lystran-sim-spawn-needed"));
    assert.isTrue(createFlag.calledWith("lystran-sim-creep-needed"));
    assert.equal(guidanceFlagResult(memory, "missing-source"), "created");
  });

  it("records createFlag attempts so idempotent reruns do not repeat them", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 45);
    sinon.stub(logger, "warn");
    const createFlag = sinon.stub().returns("lystran-sim-source-needed");

    game.rooms = {
      W1N1: {
        controller: {
          pos: {
            createFlag
          }
        }
      }
    };

    runSimBootstrap(memory, game as unknown as Game, logger, 45);
    runSimBootstrap(memory, game as unknown as Game, logger, 46);

    assert.equal(createFlag.callCount, 3);
    assert.equal(guidanceFlagResult(memory, "missing-source"), "created");
  });

  it("does not retry createFlag when Game.flags already contains lystran-sim-source-needed", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 50);
    sinon.stub(logger, "warn");
    const createFlag = sinon.stub().returns("lystran-sim-source-needed");

    // Game.flags 已有视觉提示时，只跳过对应 flag，其他 guidance 仍可创建。
    game.flags = {
      "lystran-sim-source-needed": {}
    };
    game.rooms = {
      W1N1: {
        controller: {
          pos: {
            createFlag
          }
        }
      }
    };

    runSimBootstrap(memory, game as unknown as Game, logger, 50);

    assert.isFalse(createFlag.calledWith("lystran-sim-source-needed"));
    assert.isTrue(createFlag.calledWith("lystran-sim-spawn-needed"));
    assert.isTrue(createFlag.calledWith("lystran-sim-creep-needed"));
    assert.equal(guidanceFlagResult(memory, "missing-source"), "exists");
  });

  it("treats ERR_NAME_EXISTS createFlag result as non-fatal", () => {
    const game = createMockGame();
    const memory = createMemoryWithDefaults();
    const logger = new Logger({}, () => 60);
    sinon.stub(logger, "warn");
    const createFlag = sinon.stub().returns(-3);

    game.rooms = {
      W1N1: {
        controller: {
          pos: {
            createFlag
          }
        }
      }
    };

    const result = runSimBootstrap(memory, game as unknown as Game, logger, 60);

    assert.isTrue(result.ran);
    assert.equal(guidanceFlagResult(memory, "missing-source"), "created");
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

function guidanceFlagResult(memory: Memory, code: string): string | undefined {
  return (memory.runtime.sim.guidance[code] as GuidanceWithFlagResult).flagResult;
}
