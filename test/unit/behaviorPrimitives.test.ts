import { assert } from "chai";
import { ColonyContext } from "colony/types";
import { ProcessName } from "constants/processes";
import { RoleName } from "constants/roles";
import { ProcessMemory, TaskMemory } from "memory/schema";
import { ProcessDefinition } from "processes/types";
import { createDefaultProcessDefinitions, runProcessDefinitions } from "processes/runner";
import { RuntimeServices } from "runtime/services";
import { createDefaultRoleRegistry } from "roles/registry";
import { runCreepTask } from "tasks/executor";
import { clearTaskMemory, createTaskMemory, TaskStatus, TaskType, validateTaskMemory } from "tasks/model";

describe("behavior primitives task model", () => {
  it("provides Screeps action constants and creep action spies for behavior tests", () => {
    const creep = createActionCreep(RoleName.worker);

    assert.equal(ERR_NOT_IN_RANGE, -9);
    assert.equal(ERR_NOT_ENOUGH_RESOURCES, -6);
    assert.equal(RESOURCE_ENERGY, "energy");
    assert.equal(creep.store.getUsedCapacity(RESOURCE_ENERGY), 0);
    assert.equal(creep.store.getFreeCapacity(RESOURCE_ENERGY), 50);

    creep.harvest({ id: "source-1" } as Source);
    creep.upgradeController({ id: "controller-1" } as StructureController);
    creep.transfer({ id: "spawn-1" } as StructureSpawn, RESOURCE_ENERGY);
    creep.pickup({ id: "drop-1" } as Resource);
    creep.moveTo({ id: "source-1" } as Source);

    assert.deepEqual(creep.actionCalls.map(call => call.action), [
      "harvest",
      "upgradeController",
      "transfer",
      "pickup",
      "moveTo"
    ]);
  });

  // Acceptance guard: runtime consumers depend on `export function validateTaskMemory`.
  it("creates assigned task memory with serialized state fields", () => {
    const task = createTaskMemory(TaskType.harvest, "source-1", 101);

    assert.deepEqual(task, {
      type: "harvest",
      targetId: "source-1",
      status: TaskStatus.assigned,
      assignedTick: 101,
      updatedTick: 101,
      result: null,
      failure: null
    });
  });

  it("clears task memory to an idle noop state", () => {
    const task = clearTaskMemory(102);

    assert.deepEqual(task, {
      type: TaskType.noop,
      targetId: null,
      status: TaskStatus.idle,
      assignedTick: null,
      updatedTick: 102,
      result: null,
      failure: null
    });
  });

  it("validates serialized task memory and rejects unsafe shapes", () => {
    const validTask: TaskMemory = {
      type: "build",
      targetId: null,
      status: "running",
      assignedTick: 103,
      updatedTick: 104,
      result: null,
      failure: null
    };

    assert.deepEqual(validateTaskMemory(validTask), { ok: true, value: validTask });
    assert.deepEqual(validateTaskMemory({ ...validTask, type: undefined }), {
      ok: false,
      reason: "Task memory type is required"
    });
    assert.deepEqual(validateTaskMemory({ ...validTask, status: undefined }), {
      ok: false,
      reason: "Task memory status is required"
    });
    assert.deepEqual(validateTaskMemory({ ...validTask, targetId: 7 }), {
      ok: false,
      reason: "Task memory targetId must be a string or null"
    });
  });

  it("accepts minimal logistics task types at the model boundary", () => {
    assert.equal(TaskType.pickup, "pickup");
    assert.equal(TaskType.transfer, "transfer");
    assert.equal(TaskType.refill, "refill");
  });
});

describe("behavior primitives task executor", () => {
  it("runs harvest tasks and records running OK status", () => {
    const source = createIdentifiedTarget<Source>("source-1");
    const creep = createActionCreep(RoleName.worker, 0, 50, { harvest: OK });

    creep.memory.task = createTaskMemory(TaskType.harvest, source.id, 210);
    const result = runCreepTask(creep, createRoleContext({ sources: [source], tick: 211 }));

    assert.deepEqual(result, {
      ok: true,
      status: "ok",
      reason: "harvest running"
    });
    assert.equal(creep.memory.task.status, TaskStatus.running);
    assert.equal(creep.memory.task.updatedTick, 211);
    assert.equal(creep.memory.task.result, "OK");
    assert.isNull(creep.memory.task.failure);
    assert.deepEqual(creep.actionCalls.map(call => call.action), ["harvest"]);
  });

  it("moves toward harvest targets that are out of range", () => {
    const source = createIdentifiedTarget<Source>("source-1");
    const creep = createActionCreep(RoleName.worker, 0, 50, { harvest: ERR_NOT_IN_RANGE });

    creep.memory.task = createTaskMemory(TaskType.harvest, source.id, 220);
    const result = runCreepTask(creep, createRoleContext({ sources: [source], tick: 221 }));

    assert.deepEqual(result, {
      ok: true,
      status: "blocked",
      reason: "harvest moving"
    });
    assert.equal(creep.memory.task.status, TaskStatus.running);
    assert.equal(creep.memory.task.result, "ERR_NOT_IN_RANGE");
    assert.deepEqual(creep.actionCalls.map(call => call.action), ["harvest", "moveTo"]);
  });

  it("completes harvest tasks when carry becomes full", () => {
    const source = createIdentifiedTarget<Source>("source-1");
    const creep = createActionCreep(RoleName.worker, 50, 0, { harvest: OK });

    creep.memory.task = createTaskMemory(TaskType.harvest, source.id, 230);
    const result = runCreepTask(creep, createRoleContext({ sources: [source], tick: 231 }));

    assert.deepEqual(result, {
      ok: true,
      status: "ok",
      reason: "harvest complete"
    });
    assert.equal(creep.memory.task.status, TaskStatus.complete);
    assert.equal(creep.memory.task.result, "OK");
  });

  it("executes upgrade tasks and moves toward controllers that are out of range", () => {
    const controller = createIdentifiedTarget<StructureController>("controller-1");
    const creep = createActionCreep(RoleName.upgrader, 50, 0, { upgradeController: ERR_NOT_IN_RANGE });

    creep.memory.task = createTaskMemory(TaskType.upgrade, controller.id, 240);
    const result = runCreepTask(creep, createRoleContext({ controller, tick: 241 }));

    assert.deepEqual(result, {
      ok: true,
      status: "blocked",
      reason: "upgrade moving"
    });
    assert.equal(creep.memory.task.status, TaskStatus.running);
    assert.equal(creep.memory.task.result, "ERR_NOT_IN_RANGE");
    assert.deepEqual(creep.actionCalls.map(call => call.action), ["upgradeController", "moveTo"]);
  });

  it("completes upgrade tasks when the creep has no energy", () => {
    const controller = createIdentifiedTarget<StructureController>("controller-1");
    const creep = createActionCreep(RoleName.upgrader, 0, 50, { upgradeController: ERR_NOT_ENOUGH_RESOURCES });

    creep.memory.task = createTaskMemory(TaskType.upgrade, controller.id, 250);
    const result = runCreepTask(creep, createRoleContext({ controller, tick: 251 }));

    assert.deepEqual(result, {
      ok: true,
      status: "ok",
      reason: "upgrade complete"
    });
    assert.equal(creep.memory.task.status, TaskStatus.complete);
    assert.equal(creep.memory.task.result, "ERR_NOT_ENOUGH_RESOURCES");
  });

  it("fails tasks with an invalid target", () => {
    const creep = createActionCreep(RoleName.worker);

    creep.memory.task = createTaskMemory(TaskType.harvest, "missing-source", 260);
    const result = runCreepTask(creep, createRoleContext({ tick: 261 }));

    assert.deepEqual(result, {
      ok: false,
      status: "error",
      reason: "invalid target for harvest: missing-source"
    });
    assert.equal(creep.memory.task.status, TaskStatus.failed);
    assert.equal(creep.memory.task.updatedTick, 261);
    assert.include(creep.memory.task.failure, "invalid target");
    assert.deepEqual(creep.actionCalls, []);
  });

  it("handles minimal logistics task types without throwing", () => {
    const droppedEnergy = createIdentifiedTarget<Resource>("drop-1");
    const creep = createActionCreep(RoleName.worker, 0, 50, { pickup: ERR_NOT_IN_RANGE });

    creep.memory.task = createTaskMemory(TaskType.pickup, droppedEnergy.id, 270);
    const result = runCreepTask(
      creep,
      createRoleContext({
        gameObjects: {
          [droppedEnergy.id]: droppedEnergy
        },
        tick: 271
      })
    );

    assert.equal(result.status, "blocked");
    assert.equal(creep.memory.task.status, TaskStatus.running);
    assert.deepEqual(creep.actionCalls.map(call => call.action), ["pickup", "moveTo"]);
  });
});

describe("behavior primitives role registry", () => {
  it("registers default bootstrap roles and keeps builder deferred", () => {
    const registry = createDefaultRoleRegistry();

    assert.deepEqual(
      registry.list().map((role: { name: string }) => role.name),
      [RoleName.worker, RoleName.harvester, RoleName.upgrader, RoleName.builder]
    );

    const result = registry.run(RoleName.builder, createNoopCreep(RoleName.builder), createRoleContext());

    assert.deepEqual(result, {
      ok: true,
      status: "blocked",
      reason: "role behavior deferred to Phase 6"
    });
  });

  it("returns an unknown role result instead of dispatching unregistered memory", () => {
    const registry = createDefaultRoleRegistry();
    const result = registry.run("miner", createNoopCreep("miner"), createRoleContext());

    assert.deepEqual(result, {
      ok: false,
      status: "blocked",
      reason: "unknown role: miner"
    });
  });

  it("executes harvest tasks through worker and harvester roles", () => {
    const registry = createDefaultRoleRegistry();
    const source = createIdentifiedTarget<Source>("source-1");
    const worker = createActionCreep(RoleName.worker, 0, 50, { harvest: OK });
    const harvester = createActionCreep(RoleName.harvester, 0, 50, { harvest: ERR_NOT_IN_RANGE });

    worker.memory.task = createTaskMemory(TaskType.harvest, source.id, 280);
    harvester.memory.task = createTaskMemory(TaskType.harvest, source.id, 280);

    const workerResult = registry.run(RoleName.worker, worker, createRoleContext({ sources: [source], tick: 281 }));
    const harvesterResult = registry.run(RoleName.harvester, harvester, createRoleContext({ sources: [source], tick: 281 }));

    assert.equal(workerResult.reason, "harvest running");
    assert.equal(harvesterResult.reason, "harvest moving");
    assert.deepEqual(worker.actionCalls.map(call => call.action), ["harvest"]);
    assert.deepEqual(harvester.actionCalls.map(call => call.action), ["harvest", "moveTo"]);
  });

  it("executes upgrade tasks through upgrader roles", () => {
    const registry = createDefaultRoleRegistry();
    const controller = createIdentifiedTarget<StructureController>("controller-1");
    const creep = createActionCreep(RoleName.upgrader, 50, 0, { upgradeController: OK });

    creep.memory.task = createTaskMemory(TaskType.upgrade, controller.id, 290);
    const result = registry.run(RoleName.upgrader, creep, createRoleContext({ controller, tick: 291 }));

    assert.equal(result.reason, "upgrade running");
    assert.deepEqual(creep.actionCalls.map(call => call.action), ["upgradeController"]);
  });
});

describe("behavior primitives process runner", () => {
  it("runs process definitions by priority and records cadence state", () => {
    const memory = createProcessMemory();
    const observed: string[] = [];
    const definitions: ProcessDefinition[] = [
      createProcessDefinition("slow", 20, 5, () => {
        observed.push("slow");
        return { status: "ok", message: "slow ran" };
      }),
      createProcessDefinition("fast", 10, 3, () => {
        observed.push("fast");
        return { status: "ok", message: "fast ran" };
      })
    ];

    const results = runProcessDefinitions([], {} as RuntimeServices, memory, {} as Game, 100, definitions);

    assert.deepEqual(observed, ["fast", "slow"]);
    assert.deepEqual(
      results.map((result: { processId: string }) => result.processId),
      ["fast", "slow"]
    );
    assert.equal(memory.processes.fast.lastRunTick, 100);
    assert.equal(memory.processes.fast.lastResult, "fast ran");
    assert.isNull(memory.processes.fast.lastError);
    assert.equal(memory.processes.fast.nextRunTick, 103);
    assert.equal(memory.processes.slow.nextRunTick, 105);
  });

  it("skips disabled and future scheduled processes without clobbering status", () => {
    const memory = createProcessMemory({
      disabled: {
        id: "disabled",
        name: "disabled",
        enabled: false,
        priority: 1,
        cadence: 10,
        nextRunTick: 0,
        lastRunTick: null,
        lastResult: null,
        lastError: null
      },
      future: {
        id: "future",
        name: "future",
        enabled: true,
        priority: 2,
        cadence: 10,
        nextRunTick: 120,
        lastRunTick: 80,
        lastResult: "previous",
        lastError: null
      }
    });

    const results = runProcessDefinitions(
      [],
      {} as RuntimeServices,
      memory,
      {} as Game,
      100,
      [
        createProcessDefinition("disabled", 1, 10, () => assert.fail("disabled should not run")),
        createProcessDefinition("future", 2, 10, () => assert.fail("future should not run"))
      ]
    );

    assert.deepEqual(
      results.map((result: { status: string }) => result.status),
      ["skipped", "skipped"]
    );
    assert.isNull(memory.processes.disabled.lastRunTick);
    assert.equal(memory.processes.future.lastRunTick, 80);
    assert.equal(memory.processes.future.lastResult, "previous");
    assert.isNull(memory.processes.future.lastError);
  });

  it("isolates process errors and continues later processes", () => {
    const memory = createProcessMemory();
    const observed: string[] = [];

    const results = runProcessDefinitions(
      [],
      {} as RuntimeServices,
      memory,
      {} as Game,
      110,
      [
        createProcessDefinition("boom", 1, 1, () => {
          observed.push("boom");
          throw new Error("process failed");
        }),
        createProcessDefinition("after", 2, 1, () => {
          observed.push("after");
          return { status: "ok", message: "after ran" };
        })
      ]
    );

    assert.deepEqual(observed, ["boom", "after"]);
    assert.equal(results[0].status, "error");
    assert.equal(memory.processes.boom.lastRunTick, 110);
    assert.equal(memory.processes.boom.lastError, "process failed");
    assert.equal(memory.processes.after.lastResult, "after ran");
  });

  it("creates default process definitions and dispatches creep.memory.role through the registry", () => {
    const calls: string[] = [];
    const colony = {
      roomName: "W1N1",
      primary: true,
      readiness: "degraded",
      missingReasons: ["missing spawn", "missing source", "missing controller"],
      room: { name: "W1N1" },
      controller: null,
      spawns: [],
      sources: [],
      creeps: [createNoopCreep(RoleName.worker), createNoopCreep("miner")],
      constructionSites: [],
      hostiles: [],
      energy: {
        available: 0,
        capacity: 0,
        spawnCapacity: 0
      },
      stage: {
        rcl: null,
        spawnCount: 0,
        sourceCount: 0,
        creepCount: 2,
        constructionSiteCount: 0,
        hostileCount: 0,
        hasSpawn: false,
        hasSource: false,
        hasController: false,
        defense: "clear"
      },
      intel: {
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
        scannedTick: 120
      }
    } as unknown as ColonyContext;
    const roleRegistry = {
      run(roleName: string): { ok: boolean; status: "blocked"; reason: string } {
        calls.push(roleName);

        return {
          ok: roleName !== "miner",
          status: "blocked",
          reason: roleName === "miner" ? "unknown role: miner" : "role behavior deferred to Phase 6"
        };
      }
    };
    const definitions = createDefaultProcessDefinitions(
      roleRegistry as unknown as ReturnType<typeof createDefaultRoleRegistry>
    );
    const results = runProcessDefinitions([colony], {} as RuntimeServices, createProcessMemory(), {} as Game, 120, definitions);

    assert.deepEqual(
      definitions.map((definition: { id: string }) => definition.id),
      [ProcessName.colonyIntel, ProcessName.strategyPlanning, ProcessName.bootstrapExecution, ProcessName.creepRoles]
    );
    const creepRolesResult = results.find(result => result.processId === ProcessName.creepRoles);

    assert.deepEqual(calls, [RoleName.worker, "miner"]);
    assert.isDefined(creepRolesResult);
    assert.equal(creepRolesResult?.status, "ok");
    assert.include(creepRolesResult?.message, "unknown role: miner");
  });
});

interface RoleContextOptions {
  controller?: StructureController | null;
  sources?: Source[];
  spawns?: StructureSpawn[];
  gameObjects?: Record<string, unknown>;
  tick?: number;
}

function createRoleContext(options: RoleContextOptions = {}): {
  colony: ColonyContext;
  services: RuntimeServices;
  game: Game;
  tick: number;
} {
  const controller = options.controller ?? null;
  const sources = options.sources ?? [];
  const spawns = options.spawns ?? [];
  const tick = options.tick ?? 200;

  return {
    colony: {
      roomName: "W1N1",
      primary: true,
      creeps: [],
      spawns,
      sources,
      controller
    } as unknown as ColonyContext,
    services: {} as RuntimeServices,
    game: {
      time: tick,
      getObjectById(id: string): unknown {
        return options.gameObjects?.[id] ?? null;
      }
    } as Game,
    tick
  };
}

function createNoopCreep(role: string): Creep {
  return {
    memory: {
      role
    }
  } as unknown as Creep;
}

interface ActionCall {
  action: "harvest" | "upgradeController" | "transfer" | "pickup" | "moveTo";
  target: { id?: string };
  resourceType?: ResourceConstant;
}

interface ActionCreep extends Creep {
  actionCalls: ActionCall[];
}

interface ActionReturnCodes {
  harvest?: ScreepsReturnCode;
  upgradeController?: ScreepsReturnCode;
  transfer?: ScreepsReturnCode;
  pickup?: ScreepsReturnCode;
  moveTo?: ScreepsReturnCode;
}

function createActionCreep(
  role: string,
  usedEnergy = 0,
  freeEnergy = 50,
  actionResults: ActionReturnCodes = {}
): ActionCreep {
  const actionCalls: ActionCall[] = [];
  const record = (
    action: ActionCall["action"],
    target: { id?: string },
    resourceType?: ResourceConstant
  ): ScreepsReturnCode => {
    actionCalls.push({ action, target, resourceType });

    return actionResults[action] ?? OK;
  };

  return {
    memory: {
      role
    },
    store: {
      getUsedCapacity(resourceType?: ResourceConstant): number {
        return resourceType === undefined || resourceType === RESOURCE_ENERGY ? usedEnergy : 0;
      },
      getFreeCapacity(resourceType?: ResourceConstant): number {
        return resourceType === undefined || resourceType === RESOURCE_ENERGY ? freeEnergy : 0;
      }
    },
    harvest(target: Source): ScreepsReturnCode {
      return record("harvest", target);
    },
    upgradeController(target: StructureController): ScreepsReturnCode {
      return record("upgradeController", target);
    },
    transfer(target: Structure, resourceType: ResourceConstant): ScreepsReturnCode {
      return record("transfer", target, resourceType);
    },
    pickup(target: Resource): ScreepsReturnCode {
      return record("pickup", target);
    },
    moveTo(target: RoomPosition | { pos: RoomPosition }): CreepMoveReturnCode | ERR_NO_PATH | ERR_INVALID_TARGET {
      return record("moveTo", target as { id?: string }) as CreepMoveReturnCode | ERR_NO_PATH | ERR_INVALID_TARGET;
    },
    actionCalls
  } as unknown as ActionCreep;
}

function createIdentifiedTarget<T extends { id: string }>(id: string): T {
  return {
    id,
    pos: {
      roomName: "W1N1",
      x: 10,
      y: 10
    }
  } as unknown as T;
}

function createProcessMemory(processes: Record<string, ProcessMemory> = {}): Memory {
  return {
    processes
  } as Memory;
}

function createProcessDefinition(
  id: string,
  priority: number,
  cadence: number,
  run: ProcessDefinition["run"]
): ProcessDefinition {
  return {
    id,
    name: id,
    enabled: true,
    priority,
    cadence,
    run
  };
}
