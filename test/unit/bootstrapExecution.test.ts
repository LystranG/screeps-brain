import { assert } from "chai";
import { BootstrapSlot, buildBootstrapSlots } from "bootstrap/slots";
import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";
import { createDefaultProjectMemorySections } from "memory/schema";
import { TaskType } from "tasks/model";

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

function createCreep(name: string, role: RoleName, energy: number): Creep {
  return {
    name,
    memory: { role },
    store: {
      getUsedCapacity: (resource?: ResourceConstant): number => (resource === RESOURCE_ENERGY ? energy : energy)
    }
  } as unknown as Creep;
}
