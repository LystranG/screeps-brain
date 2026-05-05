import { TaskMemory } from "memory/schema";
import { ValidationResult } from "validation/results";

export const TaskStatus = {
  idle: "idle",
  assigned: "assigned",
  running: "running",
  complete: "complete",
  failed: "failed"
} as const;

export type TaskStatusName = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskType = {
  noop: "noop",
  harvest: "harvest",
  upgrade: "upgrade",
  build: "build"
} as const;

export type TaskTypeName = typeof TaskType[keyof typeof TaskType];

/**
 * 创建可序列化的任务状态；Phase 4 只记录分配事实，真正状态机留给后续行为层扩展。
 */
export function createTaskMemory(type: TaskTypeName, targetId: string | null, tick: number): TaskMemory {
  return {
    type,
    targetId,
    status: TaskStatus.assigned,
    assignedTick: tick,
    updatedTick: tick,
    result: null,
    failure: null
  };
}

/**
 * 清空 creep 当前任务时保留显式 noop 状态，避免后续读取端把缺失字段误判为旧版 Memory。
 */
export function clearTaskMemory(tick: number): TaskMemory {
  return {
    type: TaskType.noop,
    targetId: null,
    status: TaskStatus.idle,
    assignedTick: null,
    updatedTick: tick,
    result: null,
    failure: null
  };
}

export function validateTaskMemory(value: unknown): ValidationResult<TaskMemory> {
  if (!isObjectRecord(value)) {
    return { ok: false, reason: "Task memory must be an object" };
  }

  if (typeof value.type !== "string" || value.type.length === 0) {
    return { ok: false, reason: "Task memory type is required" };
  }

  if (typeof value.status !== "string" || value.status.length === 0) {
    return { ok: false, reason: "Task memory status is required" };
  }

  if (value.targetId !== null && typeof value.targetId !== "string") {
    return { ok: false, reason: "Task memory targetId must be a string or null" };
  }

  if (value.assignedTick !== null && !isFiniteNumber(value.assignedTick)) {
    return { ok: false, reason: "Task memory assignedTick must be a number or null" };
  }

  if (!isFiniteNumber(value.updatedTick)) {
    return { ok: false, reason: "Task memory updatedTick must be a number" };
  }

  if (value.result !== null && typeof value.result !== "string") {
    return { ok: false, reason: "Task memory result must be a string or null" };
  }

  if (value.failure !== null && typeof value.failure !== "string") {
    return { ok: false, reason: "Task memory failure must be a string or null" };
  }

  return { ok: true, value: value as unknown as TaskMemory };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}
