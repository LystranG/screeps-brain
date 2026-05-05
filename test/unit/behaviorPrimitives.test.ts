import { assert } from "chai";
import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";
import { TaskMemory } from "memory/schema";
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
