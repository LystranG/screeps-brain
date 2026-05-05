import { assert } from "chai";
import { ColonyContext, ColonyReadiness, VolatileRoomIntel } from "colony/types";

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
