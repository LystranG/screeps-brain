import { RoleRunResult, RoleRunnerContext } from "roles/registry";
import { TaskStatus, TaskType } from "tasks/model";
import { TaskMemory } from "memory/schema";

export function runCreepTask(creep: Creep, context: RoleRunnerContext): RoleRunResult {
  const task = creep.memory.task;

  if (task === undefined || task.status === TaskStatus.idle || task.type === TaskType.noop) {
    return {
      ok: true,
      status: "blocked",
      reason: "no assigned task"
    };
  }

  task.updatedTick = context.tick;

  if (task.type === TaskType.harvest) {
    return runHarvestTask(creep, context, task);
  }

  if (task.type === TaskType.upgrade) {
    return runUpgradeTask(creep, context, task);
  }

  if (task.type === TaskType.pickup) {
    return runPickupTask(creep, context, task);
  }

  if (task.type === TaskType.transfer || task.type === TaskType.refill) {
    return runTransferTask(creep, context, task);
  }

  return failTask(task, context.tick, `unsupported task type: ${task.type}`);
}

function runHarvestTask(creep: Creep, context: RoleRunnerContext, task: TaskMemory): RoleRunResult {
  const source = resolveSourceTarget(context, task.targetId);

  if (source === null) {
    return failTask(task, context.tick, `invalid target for harvest: ${task.targetId ?? "null"}`);
  }

  const result = creep.harvest(source);
  task.result = formatReturnCode(result);

  // Screeps 的动作返回码同时表达“已执行”和“需要移动”；这里把可恢复状态保留为 running，
  // 让下一 tick 继续同一任务，而不是反复清空后重新分配。
  if (result === OK) {
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
      return completeTask(task, context.tick, "harvest complete");
    }

    return markTaskRunning(task, context.tick, "harvest running");
  }

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(source);

    return markTaskRunning(task, context.tick, "harvest moving", "blocked");
  }

  if (result === ERR_NOT_ENOUGH_RESOURCES || creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
    return completeTask(task, context.tick, "harvest complete");
  }

  return failTask(task, context.tick, `harvest failed: ${formatReturnCode(result)}`);
}

function runUpgradeTask(creep: Creep, context: RoleRunnerContext, task: TaskMemory): RoleRunResult {
  const controller = resolveControllerTarget(context, task.targetId);

  if (controller === null) {
    return failTask(task, context.tick, `invalid target for upgrade: ${task.targetId ?? "null"}`);
  }

  const result = creep.upgradeController(controller);
  task.result = formatReturnCode(result);

  // 没有能量不是永久失败；标记 complete 交回 bootstrap 分配层，下一轮可切回 harvest。
  if (result === OK) {
    return markTaskRunning(task, context.tick, "upgrade running");
  }

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller);

    return markTaskRunning(task, context.tick, "upgrade moving", "blocked");
  }

  if (result === ERR_NOT_ENOUGH_RESOURCES || creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
    return completeTask(task, context.tick, "upgrade complete");
  }

  return failTask(task, context.tick, `upgrade failed: ${formatReturnCode(result)}`);
}

function runPickupTask(creep: Creep, context: RoleRunnerContext, task: TaskMemory): RoleRunResult {
  const resource = resolveGameObject<Resource>(context, task.targetId);

  if (resource === null) {
    return failTask(task, context.tick, `invalid target for pickup: ${task.targetId ?? "null"}`);
  }

  const result = creep.pickup(resource);
  task.result = formatReturnCode(result);

  if (result === OK) {
    return markTaskRunning(task, context.tick, "pickup running");
  }

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(resource);

    return markTaskRunning(task, context.tick, "pickup moving", "blocked");
  }

  if (result === ERR_FULL) {
    return completeTask(task, context.tick, "pickup complete");
  }

  return failTask(task, context.tick, `pickup failed: ${formatReturnCode(result)}`);
}

function runTransferTask(creep: Creep, context: RoleRunnerContext, task: TaskMemory): RoleRunResult {
  const target = resolveTransferTarget(context, task.targetId);

  if (target === null) {
    return failTask(task, context.tick, `invalid target for ${task.type}: ${task.targetId ?? "null"}`);
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);
  task.result = formatReturnCode(result);

  if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES) {
    return completeTask(task, context.tick, `${task.type} complete`);
  }

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target);

    return markTaskRunning(task, context.tick, `${task.type} moving`, "blocked");
  }

  return failTask(task, context.tick, `${task.type} failed: ${formatReturnCode(result)}`);
}

function resolveSourceTarget(context: RoleRunnerContext, targetId: string | null): Source | null {
  return context.colony.sources.find(source => source.id === targetId) ?? resolveGameObject<Source>(context, targetId);
}

function resolveControllerTarget(context: RoleRunnerContext, targetId: string | null): StructureController | null {
  if (context.colony.controller?.id === targetId) {
    return context.colony.controller;
  }

  return resolveGameObject<StructureController>(context, targetId);
}

function resolveTransferTarget(context: RoleRunnerContext, targetId: string | null): Structure | null {
  return (
    context.colony.spawns.find(spawn => spawn.id === targetId) ??
    resolveGameObject<Structure>(context, targetId)
  );
}

function resolveGameObject<T extends _HasId>(context: RoleRunnerContext, targetId: string | null): T | null {
  if (targetId === null || context.game.getObjectById === undefined) {
    return null;
  }

  return context.game.getObjectById(targetId as Id<T>) ?? null;
}

function markTaskRunning(
  task: TaskMemory,
  tick: number,
  reason: string,
  status: RoleRunResult["status"] = "ok"
): RoleRunResult {
  task.status = TaskStatus.running;
  task.updatedTick = tick;
  task.failure = null;

  return {
    ok: true,
    status,
    reason
  };
}

function completeTask(task: TaskMemory, tick: number, reason: string): RoleRunResult {
  task.status = TaskStatus.complete;
  task.updatedTick = tick;
  task.failure = null;

  return {
    ok: true,
    status: "ok",
    reason
  };
}

function failTask(task: TaskMemory, tick: number, failure: string): RoleRunResult {
  task.status = TaskStatus.failed;
  task.updatedTick = tick;
  task.failure = failure;

  return {
    ok: false,
    status: "error",
    reason: failure
  };
}

function formatReturnCode(result: number): string {
  if (result === OK) {
    return "OK";
  }

  if (result === ERR_NOT_IN_RANGE) {
    return "ERR_NOT_IN_RANGE";
  }

  if (result === ERR_NOT_ENOUGH_RESOURCES) {
    return "ERR_NOT_ENOUGH_RESOURCES";
  }

  if (result === ERR_FULL) {
    return "ERR_FULL";
  }

  return String(result);
}
