import { StrategyIntentType } from "constants/strategy";
import type { ProjectConfigMemory } from "memory/schema";

const HIGH_RISK_INTENTS: ReadonlyArray<string> = [
  StrategyIntentType.deferExpansion,
  StrategyIntentType.deferRemoteMining,
  StrategyIntentType.deferMarket,
  StrategyIntentType.deferWarfare,
  StrategyIntentType.deferLargeFortification
];

const INTENT_POLICY_GATES: Readonly<Record<string, keyof ProjectConfigMemory["strategy"]>> = {
  [StrategyIntentType.deferExpansion]: "allowExpansion",
  [StrategyIntentType.deferRemoteMining]: "allowRemoteMining",
  [StrategyIntentType.deferMarket]: "allowMarket",
  [StrategyIntentType.deferWarfare]: "allowWarfare",
  [StrategyIntentType.deferLargeFortification]: "allowLargeFortification"
};

export function isHighRiskIntent(type: string): boolean {
  return HIGH_RISK_INTENTS.indexOf(type) >= 0;
}

export function policyGateForIntent(type: string): string | null {
  const gate = INTENT_POLICY_GATES[type];

  return gate ? `strategy.${gate}` : null;
}

/**
 * 高风险 intent 必须显式打开对应策略门控；低风险 intent 默认允许进入后续消费阶段。
 */
export function isIntentAllowed(type: string, memoryConfig: ProjectConfigMemory): boolean {
  const gate = INTENT_POLICY_GATES[type];

  if (!gate) {
    return true;
  }

  return Boolean(memoryConfig.strategy[gate]);
}
