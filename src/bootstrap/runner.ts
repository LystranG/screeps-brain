import { ColonyContext } from "colony/types";
import { ProjectMemoryShape } from "memory/schema";
import { applyBootstrapSpawnDemand } from "bootstrap/spawnDemand";
import { assignBootstrapTasks } from "bootstrap/taskAssignment";
import { buildBootstrapSlots } from "bootstrap/slots";

export interface BootstrapExecutionSummary {
  colonies: number;
  slots: number;
  spawnRequestsCreated: number;
  spawnRequestsDuplicate: number;
  tasksAssigned: number;
  blocked: number;
}

/**
 * 执行层把 ColonyContext 事实转成 spawn/task demand；策略模块保持纯规划，不直接写执行队列。
 */
export function runBootstrapExecution(
  contexts: readonly ColonyContext[],
  memory: ProjectMemoryShape,
  tick: number
): BootstrapExecutionSummary {
  const summary: BootstrapExecutionSummary = {
    colonies: 0,
    slots: 0,
    spawnRequestsCreated: 0,
    spawnRequestsDuplicate: 0,
    tasksAssigned: 0,
    blocked: 0
  };

  for (const context of contexts) {
    summary.colonies += 1;

    const buildResult = buildBootstrapSlots(context, memory, tick);
    const spawnSummary = applyBootstrapSpawnDemand(buildResult.slots, memory, context, tick);
    const taskSummary = assignBootstrapTasks(buildResult.slots, context, tick);

    summary.slots += buildResult.slots.length;
    summary.spawnRequestsCreated += spawnSummary.created;
    summary.spawnRequestsDuplicate += spawnSummary.duplicate;
    summary.tasksAssigned += taskSummary.assigned;
    summary.blocked += buildResult.blocked.length;
  }

  return summary;
}
