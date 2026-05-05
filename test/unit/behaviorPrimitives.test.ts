import { assert } from "chai";
import { TaskMemory } from "memory/schema";
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
