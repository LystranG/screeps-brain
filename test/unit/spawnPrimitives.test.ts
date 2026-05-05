import { assert } from "chai";
import { ColonyContext } from "colony/types";
import { createDefaultProjectMemorySections } from "memory/schema";
import { buildBody, calculateBodyCost } from "spawning/bodyBuilder";
import {
  createSpawnRequest,
  enqueueSpawnRequest,
  markSpawnRequestError,
  markSpawnRequestValidated,
  selectNextSpawnRequest
} from "spawning/queue";

before(() => {
  const globals = global as unknown as { [name: string]: unknown };
  globals.WORK = "work";
  globals.CARRY = "carry";
  globals.MOVE = "move";
  globals.BODYPART_COST = {
    work: 100,
    carry: 50,
    move: 50
  };
});

describe("spawn primitives body builder", () => {
  it("builds worker-style bodies from intent templates and derived costs", () => {
    const result = buildBody({
      role: "worker",
      intent: "balanced",
      energyBudget: 300
    });

    assert.isTrue(result.ok);
    assert.deepEqual(result.body, ["work", "carry", "move"]);
    assert.equal(result.cost, calculateBodyCost(result.body));
    assert.include(result.reason, "balanced");
  });

  it("returns a structured failure when energy budget below minimum 200", () => {
    const result = buildBody({
      role: "worker",
      intent: "balanced",
      energyBudget: 199
    });

    assert.isFalse(result.ok);
    assert.deepEqual(result.body, []);
    assert.equal(result.cost, 0);
    assert.equal(result.reason, "energy budget below minimum 200");
  });

  it("falls back from harvester template when budget cannot afford the preferred body", () => {
    const result = buildBody({
      role: "harvester",
      intent: "harvest",
      energyBudget: 250
    });

    assert.isTrue(result.ok);
    assert.deepEqual(result.body, ["work", "carry", "move"]);
    assert.equal(result.cost, 200);
    assert.equal(result.fallbackReason, "harvest template cost exceeds energy budget");
  });
});

describe("spawn primitives spawn queue", () => {
  it("creates explainable queued requests and rejects duplicate spawn request id values", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-1",
      roomName: "W1N1",
      role: "worker",
      priority: 5,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "bootstrap worker coverage",
      requestedTick: 10
    });

    const first = enqueueSpawnRequest(memory, request);
    const duplicate = enqueueSpawnRequest(memory, request);

    assert.isTrue(first.ok);
    assert.isFalse(duplicate.ok);
    assert.equal(duplicate.error, "duplicate spawn request id: spawn-worker-1");
    assert.deepEqual(memory.colonies.W1N1.spawnQueue[0], {
      id: "spawn-worker-1",
      roomName: "W1N1",
      role: "worker",
      priority: 5,
      body: ["work", "carry", "move"],
      memory: { role: "worker" },
      reason: "bootstrap worker coverage",
      requestedTick: 10,
      status: "queued",
      attempts: 0,
      lastError: null
    });
  });

  it("selects primary colony requests before priority and requestedTick ordering", () => {
    const memory = createMemoryWithDefaults();
    memory.config.colony.primaryRoomName = "W2N2";
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "remote-high-priority",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "remote urgent",
        requestedTick: 1
      })
    );
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "primary-later",
        roomName: "W2N2",
        role: "builder",
        priority: 5,
        body: ["work", "carry", "move"],
        memory: { role: "builder" } as CreepMemory,
        reason: "primary builder",
        requestedTick: 20
      })
    );
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "primary-earlier",
        roomName: "W2N2",
        role: "upgrader",
        priority: 5,
        body: ["work", "carry", "move"],
        memory: { role: "upgrader" } as CreepMemory,
        reason: "primary upgrader",
        requestedTick: 10
      })
    );

    const selected = selectNextSpawnRequest([createContext("W1N1", false), createContext("W2N2", true)], memory);

    assert.equal(selected?.request.id, "primary-earlier");
    assert.equal(selected?.context.roomName, "W2N2");
  });

  it("marks validation success and errors with attempts and lastError", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-2",
      roomName: "W1N1",
      role: "worker",
      priority: 3,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "validate queue mutation",
      requestedTick: 15
    });
    enqueueSpawnRequest(memory, request);

    markSpawnRequestError(memory, "W1N1", "spawn-worker-2", "-6", 16);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "queued");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].attempts, 1);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, "-6");

    markSpawnRequestValidated(memory, "W1N1", "spawn-worker-2", 17);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "validated");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, null);
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

function createContext(roomName: string, primary: boolean): ColonyContext {
  return {
    roomName,
    primary,
    readiness: "ready",
    missingReasons: [],
    room: { name: roomName } as Room,
    controller: null,
    spawns: [],
    sources: [],
    creeps: [],
    constructionSites: [],
    hostiles: [],
    energy: {
      available: 300,
      capacity: 300,
      spawnCapacity: 300
    },
    stage: {
      rcl: 1,
      spawnCount: 1,
      sourceCount: 1,
      creepCount: 0,
      constructionSiteCount: 0,
      hostileCount: 0,
      hasSpawn: true,
      hasSource: true,
      hasController: true,
      defense: "clear"
    },
    intel: {
      roomName,
      spawns: [],
      sources: [],
      creeps: [],
      constructionSites: [],
      hostiles: [],
      controller: null,
      energy: {
        available: 300,
        capacity: 300,
        spawnCapacity: 300
      },
      scannedTick: 1
    }
  };
}
