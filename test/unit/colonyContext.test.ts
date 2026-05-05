import { assert } from "chai";
import { buildVolatileRoomIntel, persistColonyIntel, shouldPersistIntel } from "colony/intel";
import { ColonyContext, ColonyReadiness, VolatileRoomIntel } from "colony/types";
import { ColonyIntelMemory, createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame, createMockRoom } from "./mock";

describe("colony context types", () => {
  it("describes live colony context fields without persisting room objects", () => {
    const intel = {
      roomName: "W1N1",
      spawns: [],
      sources: [],
      creeps: [],
      constructionSites: [],
      hostiles: [],
      controller: null,
      energy: {
        available: 0,
        capacity: 0,
        spawnCapacity: 0
      },
      scannedTick: 1
    } as unknown as VolatileRoomIntel;

    const context = {
      roomName: "W1N1",
      primary: true,
      readiness: "degraded" as ColonyReadiness,
      missingReasons: ["missing spawn"],
      room: {} as Room,
      controller: null,
      spawns: [],
      sources: [],
      creeps: [],
      constructionSites: [],
      hostiles: [],
      energy: intel.energy,
      stage: {
        rcl: null,
        spawnCount: 0,
        sourceCount: 0,
        creepCount: 0,
        constructionSiteCount: 0,
        hostileCount: 0,
        hasSpawn: false,
        hasSource: false,
        hasController: false,
        defense: "clear"
      },
      intel
    } as ColonyContext;

    assert.equal(context.roomName, "W1N1");
    assert.equal(context.readiness, "degraded");
    assert.deepEqual(context.missingReasons, ["missing spawn"]);
    assert.equal(context.energy.available, 0);
    assert.equal(context.stage.defense, "clear");
  });
});

describe("room intel", () => {
  it("builds volatile intel from one room scan without persisting live objects", () => {
    const game = createMockGame();
    game.time = 44;
    const spawn = { id: "spawn-1", structureType: STRUCTURE_SPAWN };
    const source = { id: "source-1" };
    const creep = { id: "creep-1", my: true };
    const constructionSite = { id: "site-1", my: true };
    const hostile = { id: "hostile-1", my: false };
    const room = createMockRoom({
      name: "W1N1",
      controller: { id: "controller-1", my: true, level: 2 },
      spawns: [spawn],
      sources: [source],
      creeps: [creep],
      constructionSites: [constructionSite],
      hostiles: [hostile],
      energyAvailable: 150,
      energyCapacityAvailable: 300
    });

    const intel = buildVolatileRoomIntel(room as Room, game as unknown as Game);

    assert.deepEqual(intel.spawns, [spawn]);
    assert.deepEqual(intel.sources, [source]);
    assert.deepEqual(intel.creeps, [creep]);
    assert.deepEqual(intel.constructionSites, [constructionSite]);
    assert.deepEqual(intel.hostiles, [hostile]);
    assert.equal(intel.controller?.id, "controller-1");
    assert.deepEqual(intel.energy, {
      available: 150,
      capacity: 300,
      spawnCapacity: 300
    });
    assert.equal(intel.scannedTick, 44);
  });

  it("persists conservative colony intel only on fact changes or cadence", () => {
    const memory = createMemoryWithDefaults();
    const previous = createIntelMemory({
      lastSeenTick: 10,
      lastRefreshTick: 10
    });
    const unchanged = createIntelMemory({
      lastSeenTick: 11,
      lastRefreshTick: 11
    });
    const changed = createIntelMemory({
      lastSeenTick: 12,
      lastRefreshTick: 12,
      sourceIds: ["source-1", "source-2"]
    });

    assert.isFalse(shouldPersistIntel(previous, unchanged, 20, 50));
    assert.isTrue(shouldPersistIntel(previous, unchanged, 60, 50));
    assert.isTrue(shouldPersistIntel(previous, changed, 20, 50));

    memory.colonies.W1N1 = {
      roomName: "W1N1",
      primary: previous.primary,
      status: previous.status,
      intel: previous,
      spawnQueue: []
    };

    assert.isFalse(persistColonyIntel(memory, "W1N1", unchanged, 20));
    assert.isTrue(persistColonyIntel(memory, "W1N1", changed, 20));
    assert.deepEqual(memory.colonies.W1N1.intel.sourceIds, ["source-1", "source-2"]);
    assert.deepEqual(Object.keys(memory.colonies.W1N1.intel), [
      "roomName",
      "lastSeenTick",
      "lastRefreshTick",
      "status",
      "missingReasons",
      "controllerId",
      "rcl",
      "sourceIds",
      "spawnIds",
      "primary",
      "stage"
    ]);
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

function createIntelMemory(overrides: Partial<ColonyIntelMemory> = {}): ColonyIntelMemory {
  return {
    roomName: "W1N1",
    lastSeenTick: 1,
    lastRefreshTick: 1,
    status: "ready",
    missingReasons: [],
    controllerId: "controller-1",
    rcl: 2,
    sourceIds: ["source-1"],
    spawnIds: ["spawn-1"],
    primary: true,
    stage: "rcl2",
    ...overrides
  };
}
