import { assert } from "chai";
import { ColonyContext } from "colony/types";
import { createDefaultProjectMemorySections } from "memory/schema";
import { buildBody, calculateBodyCost } from "spawning/bodyBuilder";
import {
  MAX_VALIDATION_ATTEMPTS,
  createSpawnRequest,
  enqueueSpawnRequest,
  markSpawnRequestError,
  markSpawnRequestSpawned,
  markSpawnRequestSpawning,
  markSpawnRequestWaiting,
  markSpawnRequestValidated,
  selectNextSpawnRequestByStatus,
  selectNextSpawnRequest
} from "spawning/queue";
import { runSpawnLifecycle, runSpawnValidation } from "spawning/runner";

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
  globals.OK = 0;
  globals.ERR_BUSY = -4;
  globals.ERR_NAME_EXISTS = -3;
  globals.ERR_INVALID_ARGS = -10;
  globals.ERR_NOT_ENOUGH_ENERGY = -6;
  globals.ERR_NOT_OWNER = -1;
  globals.ERR_RCL_NOT_ENOUGH = -14;
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

describe("spawn primitives dry-run runner", () => {
  it("skips when there is no queued request or no idle spawn", () => {
    const memory = createMemoryWithDefaults();
    const noRequest = runSpawnValidation([createContext("W1N1", true, [createSpawn("Spawn1")])], memory, {} as Game, 20);

    assert.isFalse(noRequest.ok);
    assert.equal(noRequest.status, "skipped");
    assert.equal(noRequest.reason, "no queued spawn request");

    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "spawn-worker-3",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "busy spawn validation",
        requestedTick: 20
      })
    );

    const noIdleSpawn = runSpawnValidation(
      [createContext("W1N1", true, [createSpawn("Spawn1", true)])],
      memory,
      {} as Game,
      21
    );

    assert.isFalse(noIdleSpawn.ok);
    assert.equal(noIdleSpawn.status, "waiting");
    assert.equal(noIdleSpawn.reason, "no idle spawn in colony");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "waiting");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, "no idle spawn in colony");
  });

  it("dry-runs spawnCreep and marks requests validated on OK", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1");
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "spawn-worker-4",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "dry-run success",
        requestedTick: 20
      })
    );

    const result = runSpawnValidation([createContext("W1N1", true, [spawn])], memory, {} as Game, 22);

    assert.isTrue(result.ok);
    assert.equal(result.status, "validated");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "validated");
    assert.deepEqual(spawn.calls[0].body, ["work", "carry", "move"]);
    assert.deepEqual(spawn.calls[0].options, {
      memory: { role: "worker" },
      dryRun: true
    });
    assert.include(spawn.calls[0].name, "worker-W1N1-22");
  });

  it("records recoverable dry-run failures as waiting without consuming attempts", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1", false, ERR_NOT_ENOUGH_ENERGY);
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "spawn-worker-5",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "dry-run failure",
        requestedTick: 20
      })
    );

    const result = runSpawnValidation([createContext("W1N1", true, [spawn])], memory, {} as Game, 23);

    assert.isFalse(result.ok);
    assert.equal(result.status, "waiting");
    assert.equal(result.reason, "-6");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "waiting");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].attempts, 0);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, "-6");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastTriedTick, 23);
    assert.isTrue(spawn.calls[0].options.dryRun);
  });

  it("records dry-run busy as waiting without pushing the request to failed", () => {
    const memory = createMemoryWithDefaults();
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "spawn-worker-dry-run-busy",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "dry-run busy",
        requestedTick: 30
      })
    );

    for (let offset = 0; offset < MAX_VALIDATION_ATTEMPTS + 1; offset += 1) {
      const result = runSpawnValidation(
        [createContext("W1N1", true, [createSpawn("Spawn1", false, ERR_BUSY)])],
        memory,
        {} as Game,
        31 + offset
      );

      assert.equal(result.status, "waiting");
    }

    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "waiting");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].attempts, 0);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, "-4");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastTriedTick, 34);
  });

  it("records oversized queued requests as waiting instead of hiding them from lifecycle selection", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1");
    const request = createSpawnRequest({
      id: "spawn-harvester-oversized",
      roomName: "W1N1",
      role: "harvester",
      priority: 1,
      body: ["work", "work", "carry", "move"],
      memory: { role: "harvester" } as CreepMemory,
      reason: "preferred harvest body exceeds current spawn capacity",
      requestedTick: 34
    });
    enqueueSpawnRequest(memory, request);

    const result = runSpawnValidation([createContext("W1N1", true, [spawn], 200)], memory, {} as Game, 35);

    assert.isFalse(result.ok);
    assert.equal(result.status, "waiting");
    assert.equal(result.reason, "body cost exceeds spawn capacity");
    assert.equal(result.requestId, "spawn-harvester-oversized");
    assert.equal(request.status, "waiting");
    assert.equal(request.lastError, "body cost exceeds spawn capacity");
    assert.equal(request.lastTriedTick, 35);
    assert.equal(spawn.calls.length, 0);
  });

  it("records queued requests as waiting when colony readiness prevents selection", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-degraded",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "degraded colony selection",
      requestedTick: 35
    });
    enqueueSpawnRequest(memory, request);

    const result = runSpawnValidation(
      [createContext("W1N1", true, [createSpawn("Spawn1")], 300, "degraded", ["missing source"])],
      memory,
      {} as Game,
      36
    );

    assert.isFalse(result.ok);
    assert.equal(result.status, "waiting");
    assert.equal(result.reason, "colony not ready: missing source");
    assert.equal(result.requestId, "spawn-worker-degraded");
    assert.equal(request.status, "waiting");
    assert.equal(request.lastError, "colony not ready: missing source");
    assert.equal(request.lastTriedTick, 36);
  });

  it("validates a later secondary request when the primary candidate has no idle spawn", () => {
    const memory = createMemoryWithDefaults();
    memory.config.colony.primaryRoomName = "W1N1";
    const primarySpawn = createSpawn("PrimarySpawn", true);
    const secondarySpawn = createSpawn("SecondarySpawn");
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "primary-busy",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "primary busy",
        requestedTick: 20
      })
    );
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "secondary-later-valid",
        roomName: "W2N2",
        role: "builder",
        priority: 2,
        body: ["work", "carry", "move"],
        memory: { role: "builder" } as CreepMemory,
        reason: "secondary fallback",
        requestedTick: 21
      })
    );

    const result = runSpawnValidation(
      [createContext("W1N1", true, [primarySpawn]), createContext("W2N2", false, [secondarySpawn])],
      memory,
      {} as Game,
      24
    );

    assert.isTrue(result.ok);
    assert.equal(result.status, "validated");
    assert.equal(result.requestId, "secondary-later-valid");
    assert.equal(primarySpawn.calls.length, 0);
    assert.equal(secondarySpawn.calls.length, 1);
    assert.deepEqual(secondarySpawn.calls[0].options, {
      memory: { role: "builder" },
      dryRun: true
    });
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "queued");
    assert.equal(memory.colonies.W2N2.spawnQueue[0].status, "validated");
  });

  it("fails an invalid high-priority request after the cap and validates a later valid request", () => {
    const memory = createMemoryWithDefaults();
    const invalidSpawn = createSpawn("Spawn1", false, ERR_INVALID_ARGS);
    const validSpawn = createSpawn("Spawn1", false, OK);
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "invalid high-priority",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "invalid high-priority regression",
        requestedTick: 20
      })
    );
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "later valid",
        roomName: "W1N1",
        role: "upgrader",
        priority: 2,
        body: ["work", "carry", "move"],
        memory: { role: "upgrader" } as CreepMemory,
        reason: "later valid regression",
        requestedTick: 21
      })
    );

    for (let offset = 0; offset < MAX_VALIDATION_ATTEMPTS; offset += 1) {
      runSpawnValidation([createContext("W1N1", true, [invalidSpawn])], memory, {} as Game, 25 + offset);
    }

    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "failed");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].attempts, MAX_VALIDATION_ATTEMPTS);

    const result = runSpawnValidation([createContext("W1N1", true, [validSpawn])], memory, {} as Game, 30);

    assert.isTrue(result.ok);
    assert.equal(result.status, "validated");
    assert.equal(result.requestId, "later valid");
    assert.equal(validSpawn.calls.length, 1);
    assert.equal(memory.colonies.W1N1.spawnQueue[1].status, "validated");
  });
});

describe("spawn primitives lifecycle runner", () => {
  it("queued -> validated -> spawning -> spawned through dry-run, real spawn, and creep appearance", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1");
    enqueueSpawnRequest(
      memory,
      createSpawnRequest({
        id: "spawn-worker-lifecycle",
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: "full lifecycle",
        requestedTick: 40
      })
    );

    const validated = runSpawnLifecycle([createContext("W1N1", true, [spawn])], memory, { creeps: {} } as Game, 40);

    assert.isTrue(validated.ok);
    assert.equal(validated.status, "validated");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "validated");
    assert.isTrue(spawn.calls[0].options.dryRun);

    const spawning = runSpawnLifecycle([createContext("W1N1", true, [spawn])], memory, { creeps: {} } as Game, 41);
    const request = memory.colonies.W1N1.spawnQueue[0];

    assert.isTrue(spawning.ok);
    assert.equal(spawning.status, "spawning");
    assert.equal(request.status, "spawning");
    assert.equal(request.spawnName, "Spawn1");
    assert.equal(request.creepName, "bootstrap-worker-W1N1-41-spawn-worker-lifecycle");
    assert.equal(request.lastTriedTick, 41);
    assert.isNull(request.completedTick);
    assert.deepEqual(spawn.calls[1].options, {
      memory: { role: "worker" }
    });

    const spawned = runSpawnLifecycle(
      [createContext("W1N1", true, [spawn])],
      memory,
      { creeps: { "bootstrap-worker-W1N1-41-spawn-worker-lifecycle": {} as Creep } } as unknown as Game,
      42
    );

    assert.isTrue(spawned.ok);
    assert.equal(spawned.status, "spawned");
    assert.equal(request.status, "spawned");
    assert.equal(request.completedTick, 42);
  });

  it("keeps a spawning request active while its recorded spawn is still creating the creep", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1");
    const request = createSpawnRequest({
      id: "spawn-worker-visible-later",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "spawn object still busy",
      requestedTick: 44
    });
    request.status = "spawning";
    request.spawnName = "Spawn1";
    request.creepName = "WorkerVisibleLater";
    spawn.spawning = { name: "WorkerVisibleLater" } as Spawning;
    enqueueSpawnRequest(memory, request);

    const result = runSpawnLifecycle([createContext("W1N1", true, [spawn])], memory, { creeps: {} } as Game, 45);

    assert.isFalse(result.ok);
    assert.equal(result.status, "waiting");
    assert.equal(result.reason, "spawn still creating creep");
    assert.equal(request.status, "spawning");
    assert.isNull(request.completedTick);
  });

  it("reconciles matched visible spawning creeps without marking them spawned early", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1");
    const request = createSpawnRequest({
      id: "bootstrap:W1N1:source:source-a:0:worker",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "real sim visible spawning creep",
      requestedTick: 46
    });
    request.status = "waiting";
    request.lastError = "-6";
    enqueueSpawnRequest(memory, request);

    const result = runSpawnLifecycle(
      [createContext("W1N1", true, [spawn])],
      memory,
      {
        creeps: {
          "bootstrap-worker-W1N1-99-bootstrap-W1N1-source-source-a-0-worker": {
            spawning: true
          } as Creep
        }
      } as unknown as Game,
      47
    );

    assert.isTrue(result.ok);
    assert.equal(result.status, "spawning");
    assert.equal(request.status, "spawning");
    assert.equal(request.spawnName, "Spawn1");
    assert.equal(request.creepName, "bootstrap-worker-W1N1-99-bootstrap-W1N1-source-source-a-0-worker");
    assert.equal(request.lastError, null);
    assert.equal(request.completedTick, null);
  });

  it("reconciles matched visible finished creeps as spawned with inferred spawn name", () => {
    const memory = createMemoryWithDefaults();
    const spawn = createSpawn("Spawn1");
    const request = createSpawnRequest({
      id: "bootstrap:W1N1:source:source-b:0:worker",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "real sim visible finished creep",
      requestedTick: 48
    });
    request.status = "waiting";
    request.lastError = "-6";
    enqueueSpawnRequest(memory, request);

    const result = runSpawnLifecycle(
      [createContext("W1N1", true, [spawn])],
      memory,
      {
        creeps: {
          "bootstrap-worker-W1N1-99-bootstrap-W1N1-source-source-b-0-worker": {
            spawning: false
          } as Creep
        }
      } as unknown as Game,
      49
    );

    assert.isTrue(result.ok);
    assert.equal(result.status, "spawned");
    assert.equal(request.status, "spawned");
    assert.equal(request.spawnName, "Spawn1");
    assert.equal(request.creepName, "bootstrap-worker-W1N1-99-bootstrap-W1N1-source-source-b-0-worker");
    assert.equal(request.lastError, null);
    assert.equal(request.completedTick, 49);
  });

  it("records recoverable spawn wait states without consuming attempts", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-wait",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "recoverable wait",
      requestedTick: 50
    });
    request.status = "validated";
    enqueueSpawnRequest(memory, request);

    const energyWait = runSpawnLifecycle(
      [createContext("W1N1", true, [createSpawn("Spawn1", false, ERR_NOT_ENOUGH_ENERGY)])],
      memory,
      { creeps: {} } as Game,
      51
    );

    assert.isFalse(energyWait.ok);
    assert.equal(energyWait.status, "waiting");
    assert.equal(request.status, "waiting");
    assert.equal(request.attempts, 0);
    assert.equal(request.lastError, "-6");
    assert.equal(request.lastTriedTick, 51);

    const busyWait = runSpawnLifecycle(
      [createContext("W1N1", true, [createSpawn("Spawn1", false, ERR_BUSY)])],
      memory,
      { creeps: {} } as Game,
      52
    );

    assert.isFalse(busyWait.ok);
    assert.equal(busyWait.status, "waiting");
    assert.equal(request.status, "waiting");
    assert.equal(request.attempts, 0);
    assert.equal(request.lastError, "-4");
    assert.equal(request.lastTriedTick, 52);
  });

  it("retries waiting requests through dry-run validation before real spawn", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-wait-retry",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "recoverable wait retry",
      requestedTick: 54
    });
    request.status = "waiting";
    request.lastError = "-6";
    request.lastTriedTick = 55;
    enqueueSpawnRequest(memory, request);

    const spawn = createSpawn("Spawn1");
    const validated = runSpawnLifecycle([createContext("W1N1", true, [spawn])], memory, { creeps: {} } as Game, 56);

    assert.isTrue(validated.ok);
    assert.equal(validated.status, "validated");
    assert.equal(request.status, "validated");
    assert.equal(request.lastError, null);
    assert.deepEqual(spawn.calls[0].options, {
      memory: { role: "worker" },
      dryRun: true
    });

    const spawning = runSpawnLifecycle([createContext("W1N1", true, [spawn])], memory, { creeps: {} } as Game, 57);

    assert.isTrue(spawning.ok);
    assert.equal(spawning.status, "spawning");
    assert.equal(request.status, "spawning");
    assert.equal(request.spawnName, "Spawn1");
    assert.equal(request.creepName, "bootstrap-worker-W1N1-57-spawn-worker-wait-retry");
    assert.deepEqual(spawn.calls[1].options, {
      memory: { role: "worker" }
    });
  });

  it("marks fatal real spawn errors failed", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-fatal",
      roomName: "W1N1",
      role: "worker",
      priority: 1,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "fatal real spawn",
      requestedTick: 60
    });
    request.status = "validated";
    enqueueSpawnRequest(memory, request);

    const result = runSpawnLifecycle(
      [createContext("W1N1", true, [createSpawn("Spawn1", false, ERR_NAME_EXISTS)])],
      memory,
      { creeps: {} } as Game,
      61
    );

    assert.isFalse(result.ok);
    assert.equal(result.status, "failed");
    assert.equal(request.status, "failed");
    assert.equal(request.lastError, "-3");
    assert.equal(request.lastTriedTick, 61);
  });

  it("documents the spawn lifecycle state matrix with stable request evidence", () => {
    const cases: Array<{
      name: string;
      initialStatus: "queued" | "waiting" | "validated";
      returnCode: ScreepsReturnCode;
      expectedResultStatus: "validated" | "spawning" | "waiting" | "failed";
      expectedStoredStatus: "validated" | "spawning" | "waiting" | "failed";
      expectedLastError: string | null;
      expectedAttempts: number;
    }> = [
      {
        name: "queued recoverable dry-run",
        initialStatus: "queued",
        returnCode: ERR_NOT_ENOUGH_ENERGY,
        expectedResultStatus: "waiting",
        expectedStoredStatus: "waiting",
        expectedLastError: "-6",
        expectedAttempts: 0
      },
      {
        name: "waiting recovered dry-run",
        initialStatus: "waiting",
        returnCode: OK,
        expectedResultStatus: "validated",
        expectedStoredStatus: "validated",
        expectedLastError: null,
        expectedAttempts: 0
      },
      {
        name: "validated real spawn",
        initialStatus: "validated",
        returnCode: OK,
        expectedResultStatus: "spawning",
        expectedStoredStatus: "spawning",
        expectedLastError: null,
        expectedAttempts: 0
      },
      {
        name: "validated fatal spawn",
        initialStatus: "validated",
        returnCode: ERR_NAME_EXISTS,
        expectedResultStatus: "failed",
        expectedStoredStatus: "failed",
        expectedLastError: "-3",
        expectedAttempts: 1
      }
    ];

    for (const stateCase of cases) {
      const memory = createMemoryWithDefaults();
      const request = createSpawnRequest({
        id: `spawn-worker-matrix-${stateCase.name}`,
        roomName: "W1N1",
        role: "worker",
        priority: 1,
        body: ["work", "carry", "move"],
        memory: { role: "worker" } as CreepMemory,
        reason: stateCase.name,
        requestedTick: 80
      });
      request.status = stateCase.initialStatus;
      request.lastError = stateCase.initialStatus === "waiting" ? "-6" : null;
      enqueueSpawnRequest(memory, request);

      const result = runSpawnLifecycle(
        [createContext("W1N1", true, [createSpawn("Spawn1", false, stateCase.returnCode)])],
        memory,
        { creeps: {} } as Game,
        81
      );

      assert.equal(result.status, stateCase.expectedResultStatus, stateCase.name);
      assert.equal(request.status, stateCase.expectedStoredStatus, stateCase.name);
      assert.equal(request.lastError, stateCase.expectedLastError, stateCase.name);
      assert.equal(request.attempts, stateCase.expectedAttempts, stateCase.name);
    }
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
      lastError: null,
      lastTriedTick: null,
      spawnName: null,
      creepName: null,
      completedTick: null
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

    const selected = selectNextSpawnRequest(
      [createContext("W1N1", false, [createSpawn("RemoteSpawn")]), createContext("W2N2", true, [createSpawn("PrimarySpawn")])],
      memory
    );

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

    markSpawnRequestError(memory, "W1N1", "spawn-worker-2", "-6", 17);
    markSpawnRequestError(memory, "W1N1", "spawn-worker-2", "-6", 18);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "failed");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].attempts, MAX_VALIDATION_ATTEMPTS);

    markSpawnRequestValidated(memory, "W1N1", "spawn-worker-2", 19);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "validated");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, null);
  });

  it("selects and mutates lifecycle statuses explicitly", () => {
    const memory = createMemoryWithDefaults();
    const request = createSpawnRequest({
      id: "spawn-worker-status",
      roomName: "W1N1",
      role: "worker",
      priority: 3,
      body: ["work", "carry", "move"],
      memory: { role: "worker" } as CreepMemory,
      reason: "status helpers",
      requestedTick: 70
    });
    request.status = "validated";
    enqueueSpawnRequest(memory, request);

    const selected = selectNextSpawnRequestByStatus(
      [createContext("W1N1", true, [createSpawn("Spawn1")])],
      memory,
      "validated"
    );

    assert.equal(selected?.request.id, "spawn-worker-status");

    markSpawnRequestWaiting(memory, "W1N1", "spawn-worker-status", ERR_BUSY, 71);
    assert.equal(request.status, "waiting");
    assert.equal(request.attempts, 0);
    assert.equal(request.lastError, "-4");
    assert.equal(request.lastTriedTick, 71);

    markSpawnRequestSpawning(memory, "W1N1", "spawn-worker-status", "Spawn1", "Worker1", 72);
    assert.equal(request.status, "spawning");
    assert.equal(request.spawnName, "Spawn1");
    assert.equal(request.creepName, "Worker1");
    assert.equal(request.lastTriedTick, 72);

    markSpawnRequestSpawned(memory, "W1N1", "spawn-worker-status", 73);
    assert.equal(request.status, "spawned");
    assert.equal(request.completedTick, 73);
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

function createContext(
  roomName: string,
  primary: boolean,
  spawns: StructureSpawn[] = [],
  spawnCapacity = 300,
  readiness: ColonyContext["readiness"] = "ready",
  missingReasons: string[] = []
): ColonyContext {
  return {
    roomName,
    primary,
    readiness,
    missingReasons,
    room: { name: roomName } as Room,
    controller: null,
    spawns,
    sources: [],
    creeps: [],
    constructionSites: [],
    hostiles: [],
    energy: {
      available: spawnCapacity,
      capacity: spawnCapacity,
      spawnCapacity
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
      spawns,
      sources: [],
      creeps: [],
      constructionSites: [],
      hostiles: [],
      controller: null,
      energy: {
        available: spawnCapacity,
        capacity: spawnCapacity,
        spawnCapacity
      },
      scannedTick: 1
    }
  };
}

interface MockSpawnCall {
  body: BodyPartConstant[];
  name: string;
  options: SpawnOptions;
}

interface MockSpawn extends StructureSpawn {
  calls: MockSpawnCall[];
}

function createSpawn(name: string, busy = false, returnCode: ScreepsReturnCode = OK): MockSpawn {
  const calls: MockSpawnCall[] = [];

  return {
    name,
    spawning: busy ? {} : null,
    calls,
    spawnCreep: (body: BodyPartConstant[], creepName: string, options: SpawnOptions): ScreepsReturnCode => {
      calls.push({
        body,
        name: creepName,
        options
      });

      return returnCode;
    }
  } as MockSpawn;
}
