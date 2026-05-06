import type { ColonyContext } from "colony/types";
import type { ProjectMemoryShape } from "memory/schema";
import { buildStrategyPlan, shouldRefreshStrategyPlan } from "strategy/planner";

export interface StrategyPlanningRunSummary {
  evaluated: number;
  refreshed: number;
  skipped: number;
  errors: string[];
}

/**
 * 将纯规划器接入运行时 Memory；本层只写策略摘要，不生成 spawn 请求或 task 分配。
 */
export function runStrategyPlanning(
  contexts: readonly ColonyContext[],
  memory: ProjectMemoryShape,
  tick: number
): StrategyPlanningRunSummary {
  const summary: StrategyPlanningRunSummary = {
    evaluated: 0,
    refreshed: 0,
    skipped: 0,
    errors: []
  };

  for (const context of contexts) {
    summary.evaluated += 1;

    const colony = memory.colonies[context.roomName];
    if (!colony) {
      summary.skipped += 1;
      summary.errors.push(`${context.roomName}: missing colony memory`);
      continue;
    }

    const decision = shouldRefreshStrategyPlan(context, memory, tick);
    if (!decision.refresh) {
      summary.skipped += 1;
      continue;
    }

    if (decision.trigger === null) {
      summary.skipped += 1;
      summary.errors.push(`${context.roomName}: refresh requested without trigger`);
      continue;
    }

    colony.strategy = buildStrategyPlan(context, memory, tick, decision.trigger);
    summary.refreshed += 1;
  }

  return summary;
}
