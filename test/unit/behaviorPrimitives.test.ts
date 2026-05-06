import { assert } from "chai";
import { ColonyContext } from "colony/types";
import { ProcessName } from "constants/processes";
import { RoleName } from "constants/roles";
import { ProcessMemory, TaskMemory } from "memory/schema";
import { ProcessDefinition } from "processes/types";
import { createDefaultProcessDefinitions, runProcessDefinitions } from "processes/runner";
import { RuntimeServices } from "runtime/services";
import { createDefaultRoleRegistry } from "roles/registry";
import { clearTaskMemory, createTaskMemory, TaskStatus, TaskType, validateTaskMemory } from "tasks/model";

describe("behavior primitives task model", () => {
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
});

describe("behavior primitives role registry", () => {
  it("registers default skeleton roles with blocked phase status", () => {
    const registry = createDefaultRoleRegistry();

    assert.deepEqual(
      registry.list().map((role: { name: string }) => role.name),
      [RoleName.worker, RoleName.harvester, RoleName.upgrader, RoleName.builder]
    );

    const result = registry.run(RoleName.worker, createNoopCreep(RoleName.worker), createRoleContext());

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

  it("keeps default role runners side-effect free", () => {
    const registry = createDefaultRoleRegistry();
    const creep = {
      memory: {
        role: RoleName.harvester
      },
      harvest: () => assert.fail("harvest should not be called"),
      upgradeController: () => assert.fail("upgradeController should not be called"),
      build: () => assert.fail("build should not be called"),
      moveTo: () => assert.fail("moveTo should not be called")
    } as unknown as Creep;

    const result = registry.run(RoleName.harvester, creep, createRoleContext());

    assert.equal(result.status, "blocked");
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

function createRoleContext(): { colony: ColonyContext; services: RuntimeServices; game: Game; tick: number } {
  return {
    colony: {
      roomName: "W1N1",
      primary: true,
      creeps: [],
      spawns: [],
      sources: []
    } as unknown as ColonyContext,
    services: {} as RuntimeServices,
    game: {
      time: 200
    } as Game,
    tick: 200
  };
}

function createNoopCreep(role: string): Creep {
  return {
    memory: {
      role
    }
  } as unknown as Creep;
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
