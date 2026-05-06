import { assert } from "chai";
import { applyBootstrapSpawnDemand } from "bootstrap/spawnDemand";
import { BootstrapSlot, buildBootstrapSlots } from "bootstrap/slots";
import { assignBootstrapTasks } from "bootstrap/taskAssignment";
import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createSpawnRequest, enqueueSpawnRequest } from "spawning/queue";
import { createTaskMemory, TaskStatus, TaskType } from "tasks/model";

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
  globals.RESOURCE_ENERGY = "energy";
});

describe("bootstrap execution slots", () => {
  it("builds deterministic ready-room population and source/controller slots", () => {
    const result = buildBootstrapSlots(
      createContext({
        spawns: [createSpawn("Spawn1")],
        sources: [createSource("source-a"), createSource("source-b")],
        controller: createController("controller-a"),
        creeps: []
      }),
      createMemory(),
      250
    );

    assert.equal(result.targetPopulation, 3);
    assert.deepEqual(
      result.slots.map(slot => slot.id),
      ["source:source-a:0", "source:source-b:0", "upgrade:controller-a:0", "workerFallback:W1N1:0", "workerFallback:W1N1:1"]
    );
    assert.deepEqual(
      result.slots
        .filter((slot): slot is BootstrapSlot & { spawn: NonNullable<BootstrapSlot["spawn"]> } => {
          return slot.kind === "workerFallback" && slot.spawn !== null;
        })
        .map(slot => slot.spawn.role),
      [RoleName.worker, RoleName.worker]
    );
    assert.deepEqual(
      result.slots.map(slot => slot.task?.kind ?? null),
      [TaskType.harvest, TaskType.harvest, TaskType.upgrade, null, null]
    );
    assert.sameMembers(
      Array.from(
        new Set(
          result.slots.reduce<string[]>((kinds, slot) => {
            return kinds.concat(slot.logistics.map(demand => demand.kind));
          }, [])
        )
      ),
      ["pickup", "transfer", "refill"]
    );
  });

  it("blocks only per-slot demand when spawn, source, or controller facts are missing", () => {
    const noSpawn = buildBootstrapSlots(
      createContext({
        spawns: [],
        sources: [createSource("source-a")],
        controller: createController("controller-a"),
        creeps: [createCreep("Worker1", RoleName.worker, 0)]
      }),
      createMemory(),
      251
    );

    assert.equal(noSpawn.targetPopulation, 0);
    assert.equal(noSpawn.slots.filter(slot => slot.spawn !== null).length, 0);
    assert.deepEqual(
      noSpawn.slots.map(slot => slot.task?.kind ?? null),
      [TaskType.harvest, TaskType.upgrade]
    );

    const noSource = buildBootstrapSlots(
      createContext({
        spawns: [createSpawn("Spawn1")],
        sources: [],
        controller: createController("controller-a"),
        creeps: []
      }),
      createMemory(),
      252
    );

    assert.notInclude(
      noSource.slots.map(slot => slot.task?.kind ?? null),
      TaskType.harvest
    );
    assert.include(
      noSource.slots.map(slot => slot.task?.kind ?? null),
      TaskType.upgrade
    );

    const noController = buildBootstrapSlots(
      createContext({
        spawns: [createSpawn("Spawn1")],
        sources: [createSource("source-a")],
        controller: null,
        creeps: []
      }),
      createMemory(),
      253
    );

    assert.include(
      noController.slots.map(slot => slot.task?.kind ?? null),
      TaskType.harvest
    );
    assert.notInclude(
      noController.slots.map(slot => slot.task?.kind ?? null),
      TaskType.upgrade
    );
  });
});

describe("bootstrap execution spawn demand", () => {
  it("enqueues stable bootstrap spawn requests and counts active duplicates", () => {
    const memory = createMemory();
    const context = createContext({
      spawns: [createSpawn("Spawn1")],
      sources: [createSource("source-a"), createSource("source-b")],
      controller: createController("controller-a"),
      creeps: []
    });
    const result = buildBootstrapSlots(context, memory, 260);

    const created = applyBootstrapSpawnDemand(result.slots, memory, context, 260);

    assert.equal(created.created, 5);
    assert.equal(created.duplicate, 0);
    assert.equal(memory.colonies.W1N1.spawnQueue[0].id, "bootstrap:W1N1:source:source-a:0:worker");
    assert.equal(memory.colonies.W1N1.spawnQueue[0].role, RoleName.worker);

    const duplicate = applyBootstrapSpawnDemand(result.slots, memory, context, 261);

    assert.equal(duplicate.created, 0);
    assert.equal(duplicate.duplicate, 5);
    assert.lengthOf(memory.colonies.W1N1.spawnQueue, 5);
  });

  it("does not re-enqueue queued, validated, or spawning requests for the same slot", () => {
    const memory = createMemory();
    const context = createContext({
      spawns: [createSpawn("Spawn1")],
      sources: [createSource("source-a")],
      controller: createController("controller-a"),
      creeps: []
    });
    const result = buildBootstrapSlots(context, memory, 262);
    const sourceSlot = result.slots.find(slot => slot.id === "source:source-a:0");

    assert.isDefined(sourceSlot);

    for (const status of ["queued", "validated", "spawning"] as const) {
      memory.colonies = {};
      const request = createSpawnRequest({
        id: `bootstrap:W1N1:${sourceSlot?.id}:worker`,
        roomName: "W1N1",
        role: RoleName.worker,
        priority: 20,
        body: ["work", "carry", "move"],
        memory: { role: RoleName.worker } as CreepMemory,
        reason: "existing active request",
        requestedTick: 262
      });
      request.status = status;
      enqueueSpawnRequest(memory, request);

      const duplicate = applyBootstrapSpawnDemand([sourceSlot as BootstrapSlot], memory, context, 263);

      assert.equal(duplicate.created, 0);
      assert.equal(duplicate.duplicate, 1);
      assert.lengthOf(memory.colonies.W1N1.spawnQueue, 1);
    }
  });
});

describe("bootstrap execution task assignment", () => {
  it("preserves valid current assignments instead of thrashing creep task memory", () => {
    const source = createSource("source-a");
    const currentTask = createTaskMemory(TaskType.harvest, source.id, 270);
    currentTask.status = TaskStatus.running;
    const creep = createCreep("Worker1", RoleName.worker, 0, currentTask);
    const context = createContext({
      spawns: [createSpawn("Spawn1")],
      sources: [source],
      controller: createController("controller-a"),
      creeps: [creep]
    });
    const result = buildBootstrapSlots(context, createMemory(), 271);

    const summary = assignBootstrapTasks(result.slots, context, 271);

    assert.equal(summary.preserved, 1);
    assert.equal(summary.assigned, 0);
    assert.equal(creep.memory.task, currentTask);
  });

  it("assigns empty workers to nearest source harvest and loaded workers to controller upgrade", () => {
    const source = createSource("source-a");
    const controller = createController("controller-a");
    const emptyWorker = createCreep("WorkerA", RoleName.worker, 0);
    const loadedWorker = createCreep("WorkerB", RoleName.worker, 50);
    const context = createContext({
      spawns: [createSpawn("Spawn1")],
      sources: [source, createSource("source-b")],
      controller,
      creeps: [loadedWorker, emptyWorker]
    });
    const result = buildBootstrapSlots(context, createMemory(), 272);

    const summary = assignBootstrapTasks(result.slots, context, 272);

    assert.equal(summary.assigned, 2);
    assert.deepEqual(emptyWorker.memory.task, createTaskMemory(TaskType.harvest, source.id, 272));
    assert.deepEqual(loadedWorker.memory.task, createTaskMemory(TaskType.upgrade, controller.id, 272));
  });

  it("reassigns invalid or missing target tasks when another valid slot exists", () => {
    const source = createSource("source-a");
    const staleTask = createTaskMemory(TaskType.harvest, "missing-source", 273);
    const creep = createCreep("Worker1", RoleName.worker, 0, staleTask);
    const context = createContext({
      spawns: [createSpawn("Spawn1")],
      sources: [source],
      controller: null,
      creeps: [creep]
    });
    const result = buildBootstrapSlots(context, createMemory(), 274);

    const summary = assignBootstrapTasks(result.slots, context, 274);

    assert.equal(summary.assigned, 1);
    assert.deepEqual(creep.memory.task, createTaskMemory(TaskType.harvest, source.id, 274));
  });
});

function createMemory(): Memory {
  return {
    creeps: {},
    ...createDefaultProjectMemorySections()
  } as Memory;
}

interface ContextOptions {
  spawns: StructureSpawn[];
  sources: Source[];
  controller: StructureController | null;
  creeps: Creep[];
}

function createContext(options: ContextOptions): ColonyContext {
  return {
    roomName: "W1N1",
    primary: true,
    readiness: options.spawns.length > 0 && options.sources.length > 0 && options.controller ? "ready" : "degraded",
    missingReasons: [],
    room: { name: "W1N1" } as Room,
    controller: options.controller,
    spawns: options.spawns,
    sources: options.sources,
    creeps: options.creeps,
    constructionSites: [],
    hostiles: [],
    energy: {
      available: 300,
      capacity: 300,
      spawnCapacity: 300
    },
    stage: {
      rcl: options.controller ? 1 : null,
      spawnCount: options.spawns.length,
      sourceCount: options.sources.length,
      creepCount: options.creeps.length,
      constructionSiteCount: 0,
      hostileCount: 0,
      hasSpawn: options.spawns.length > 0,
      hasSource: options.sources.length > 0,
      hasController: options.controller !== null,
      defense: "clear"
    },
    intel: {
      roomName: "W1N1",
      spawns: options.spawns,
      sources: options.sources,
      creeps: options.creeps,
      constructionSites: [],
      hostiles: [],
      controller: options.controller,
      energy: {
        available: 300,
        capacity: 300,
        spawnCapacity: 300
      },
      scannedTick: 250
    }
  };
}

function createSpawn(name: string): StructureSpawn {
  return {
    id: `${name}-id`,
    name,
    spawning: null
  } as unknown as StructureSpawn;
}

function createSource(id: string): Source {
  return {
    id
  } as Source;
}

function createController(id: string): StructureController {
  return {
    id
  } as StructureController;
}

function createCreep(name: string, role: RoleName, energy: number, task?: ReturnType<typeof createTaskMemory>): Creep {
  return {
    name,
    memory: {
      role,
      task
    },
    pos: {
      findClosestByRange: (targets: Source[]): Source | null => targets[0] ?? null
    },
    store: {
      getUsedCapacity: (resource?: ResourceConstant): number => (resource === RESOURCE_ENERGY ? energy : energy)
    }
  } as unknown as Creep;
}
