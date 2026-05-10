import { assert } from "chai";
import { RuntimeEnvironment } from "shared/constants/runtime";
import { detectRuntimeEnvironment, updateRuntimeEnvironmentSummary } from "environment/detection";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("environment|sim bootstrap|observability environment detection", () => {
  it("reports cpuAvailable false for sim and true for non-sim shards", () => {
    const simGame = createMockGame();
    const privateGame = createMockGame();
    const unknownGame = createMockGame();

    privateGame.shard.name = "private";
    unknownGame.shard.name = "custom";

    assert.isFalse(detectRuntimeEnvironment(simGame as unknown as Game).cpuAvailable);
    assert.isTrue(detectRuntimeEnvironment(privateGame as unknown as Game).cpuAvailable);
    assert.isTrue(detectRuntimeEnvironment(unknownGame as unknown as Game).cpuAvailable);
  });

  it('classifies Game.shard.name === "sim" with CPU unavailable', () => {
    const game = createMockGame() as unknown as Game;

    const metadata = detectRuntimeEnvironment(game);

    assert.equal(metadata.type, RuntimeEnvironment.sim);
    assert.equal(metadata.shardName, "sim");
    assert.isFalse(metadata.cpuAvailable);
    assert.include(metadata.reason, 'Game.shard.name === "sim"');
  });

  it("classifies shard0 as world with CPU available", () => {
    const game = createMockGame();
    game.shard.name = "shard0";

    const metadata = detectRuntimeEnvironment(game as unknown as Game);

    assert.equal(metadata.type, RuntimeEnvironment.world);
    assert.isTrue(metadata.cpuAvailable);
    assert.include(metadata.reason, "official world shard");
  });

  it("classifies private and unknown shards conservatively", () => {
    const privateGame = createMockGame();
    privateGame.shard.name = "private";
    const unknownGame = createMockGame();
    unknownGame.shard.name = "custom";

    assert.equal(detectRuntimeEnvironment(privateGame as unknown as Game).type, RuntimeEnvironment.private);
    assert.equal(detectRuntimeEnvironment(unknownGame as unknown as Game).type, RuntimeEnvironment.unknown);
  });

  it("counts visible rooms, owned rooms, and spawns", () => {
    const game = createMockGame();
    game.rooms = {
      W1N1: { controller: { my: true } },
      W1N2: { controller: { my: false } },
      W1N3: {}
    };
    game.spawns = {
      Spawn1: {},
      Spawn2: {}
    };

    const metadata = detectRuntimeEnvironment(game as unknown as Game);

    assert.equal(metadata.visibleRoomCount, 3);
    assert.equal(metadata.ownedRoomCount, 1);
    assert.equal(metadata.spawnCount, 2);
  });

  it("updates lastChangedTick only when type or shard changes", () => {
    const memory = createMemoryWithDefaults();
    const firstMetadata = {
      type: RuntimeEnvironment.sim,
      shardName: "sim",
      cpuAvailable: false,
      visibleRoomCount: 1,
      ownedRoomCount: 0,
      spawnCount: 0,
      reason: 'Game.shard.name === "sim"'
    };

    updateRuntimeEnvironmentSummary(memory, firstMetadata, 10);
    updateRuntimeEnvironmentSummary(memory, firstMetadata, 11);
    updateRuntimeEnvironmentSummary(
      memory,
      {
        ...firstMetadata,
        type: RuntimeEnvironment.world,
        shardName: "shard1",
        cpuAvailable: true
      },
      12
    );

    assert.equal(memory.runtime.environment.type, RuntimeEnvironment.world);
    assert.equal(memory.runtime.environment.shard, "shard1");
    assert.equal(memory.runtime.environment.lastSeenTick, 12);
    assert.equal(memory.runtime.environment.lastChangedTick, 12);
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
