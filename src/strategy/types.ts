import type { ColonyContext } from "colony/types";
import type { ProjectMemoryShape } from "memory/schema";

export type StrategyTrigger = "cadence" | "state-change" | "missing-plan" | "policy-change" | "manual";

export interface StrategyPlanInput {
  context: ColonyContext;
  memory: ProjectMemoryShape;
  tick: number;
  trigger: StrategyTrigger;
}

export interface StrategyRefreshDecision {
  refresh: boolean;
  trigger: StrategyTrigger | null;
}
