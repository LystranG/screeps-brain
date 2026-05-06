import { BootstrapSlot, BootstrapTaskDemand } from "bootstrap/slots";
import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";
import { TaskMemory } from "memory/schema";
import { createTaskMemory, TaskStatus, TaskType } from "tasks/model";

export interface BootstrapTaskAssignmentSummary {
  assigned: number;
  preserved: number;
  skipped: number;
}

interface CandidateTask {
  creep: Creep;
  demand: BootstrapTaskDemand;
  score: number;
}

/**
 * 只在当前房间内做轻量匹配：有效任务保持稳定，缺失或失败任务才重新绑定到可用槽位。
 */
export function assignBootstrapTasks(
  slots: readonly BootstrapSlot[],
  context: ColonyContext,
  tick: number
): BootstrapTaskAssignmentSummary {
  const demands = slots
    .map(slot => slot.task)
    .filter((task): task is BootstrapTaskDemand => task !== null)
    .sort(compareTaskDemand);
  const summary: BootstrapTaskAssignmentSummary = {
    assigned: 0,
    preserved: 0,
    skipped: 0
  };

  for (const creep of [...context.creeps].sort((left, right) => left.name.localeCompare(right.name))) {
    if (isValidCurrentTask(creep.memory.task, context)) {
      summary.preserved += 1;
      continue;
    }

    const candidate = selectCandidate(creep, demands, context);

    if (!candidate) {
      summary.skipped += 1;
      continue;
    }

    creep.memory.task = createAssignedTaskMemory(candidate.demand, tick);
    summary.assigned += 1;
  }

  return summary;
}

function createAssignedTaskMemory(demand: BootstrapTaskDemand, tick: number): TaskMemory {
  if (demand.kind === TaskType.harvest) {
    return createTaskMemory(TaskType.harvest, demand.targetId, tick);
  }

  if (demand.kind === TaskType.upgrade) {
    return createTaskMemory(TaskType.upgrade, demand.targetId, tick);
  }

  return createTaskMemory(demand.kind, demand.targetId, tick);
}

function selectCandidate(
  creep: Creep,
  demands: readonly BootstrapTaskDemand[],
  context: ColonyContext
): CandidateTask | null {
  const candidates = demands
    .filter(demand => isDemandTargetAvailable(demand, context))
    .map(demand => ({
      creep,
      demand: selectConcreteDemand(creep, demand, context),
      score: scoreDemand(creep, demand)
    }))
    .filter((candidate): candidate is CandidateTask => candidate.demand !== null)
    .sort(compareCandidates);

  return candidates[0] ?? null;
}

function selectConcreteDemand(
  creep: Creep,
  demand: BootstrapTaskDemand,
  context: ColonyContext
): BootstrapTaskDemand | null {
  if (shouldPreferUpgrade(creep, context)) {
    return context.controller
      ? {
          kind: TaskType.upgrade,
          targetId: context.controller.id,
          priority: demand.priority,
          reason: `upgrade controller ${context.controller.id}`
        }
      : null;
  }

  if (demand.kind !== TaskType.harvest) {
    return demand;
  }

  const source = creep.pos.findClosestByRange(context.sources);

  return source
    ? {
        kind: TaskType.harvest,
        targetId: source.id,
        priority: demand.priority,
        reason: `harvest source ${source.id}`
      }
    : null;
}

function isValidCurrentTask(task: TaskMemory | undefined, context: ColonyContext): boolean {
  if (!task) {
    return false;
  }

  if (task.status !== TaskStatus.assigned && task.status !== TaskStatus.running) {
    return false;
  }

  if (task.targetId === null) {
    return false;
  }

  if (task.type === TaskType.harvest) {
    return context.sources.some(source => source.id === task.targetId);
  }

  if (task.type === TaskType.upgrade) {
    return context.controller?.id === task.targetId;
  }

  return false;
}

function shouldPreferUpgrade(creep: Creep, context: ColonyContext): boolean {
  return context.controller !== null && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
}

function isDemandTargetAvailable(demand: BootstrapTaskDemand, context: ColonyContext): boolean {
  if (demand.kind === TaskType.harvest) {
    return context.sources.some(source => source.id === demand.targetId);
  }

  if (demand.kind === TaskType.upgrade) {
    return context.controller?.id === demand.targetId;
  }

  return false;
}

function scoreDemand(creep: Creep, demand: BootstrapTaskDemand): number {
  const role = creep.memory.role;
  let score = demand.priority;

  if (role === RoleName.worker) {
    score -= 20;
  }

  if (matchesSpecializedRole(role, demand)) {
    score -= 30;
  }

  return score;
}

function matchesSpecializedRole(role: RoleName | undefined, demand: BootstrapTaskDemand): boolean {
  return (
    (role === RoleName.harvester && demand.kind === TaskType.harvest) ||
    (role === RoleName.upgrader && demand.kind === TaskType.upgrade)
  );
}

function compareTaskDemand(left: BootstrapTaskDemand, right: BootstrapTaskDemand): number {
  const priorityOrder = left.priority - right.priority;

  if (priorityOrder !== 0) {
    return priorityOrder;
  }

  return left.targetId.localeCompare(right.targetId);
}

function compareCandidates(left: CandidateTask, right: CandidateTask): number {
  const scoreOrder = left.score - right.score;

  if (scoreOrder !== 0) {
    return scoreOrder;
  }

  const priorityOrder = left.demand.priority - right.demand.priority;

  if (priorityOrder !== 0) {
    return priorityOrder;
  }

  return left.creep.name.localeCompare(right.creep.name);
}
