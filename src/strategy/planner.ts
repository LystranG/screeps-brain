import type { ProjectMemoryShape, StrategyIntentMemory, StrategyPlanMemory } from "memory/schema";
import { StrategyIntentStatus, StrategyIntentType } from "constants/strategy";
import type { StrategyRefreshDecision, StrategyTrigger } from "strategy/types";
import { isIntentAllowed, policyGateForIntent } from "strategy/policy";
import type { ColonyContext } from "colony/types";

interface SignatureShape {
  readiness: string;
  rcl: number | null;
  spawnCount: number;
  sourceCount: number;
  creepCount: number;
  constructionSiteCount: number;
  hostileCount: number;
  spawnCapacity: number;
  strategyMode: string;
  planningCadence: number;
  allowExpansion: boolean;
  allowRemoteMining: boolean;
  allowMarket: boolean;
  allowWarfare: boolean;
  allowLargeFortification: boolean;
}

const HIGH_RISK_DEFERRALS: readonly StrategyIntentType[] = [
  StrategyIntentType.deferExpansion,
  StrategyIntentType.deferRemoteMining,
  StrategyIntentType.deferMarket,
  StrategyIntentType.deferWarfare,
  StrategyIntentType.deferLargeFortification
];

export function createStrategySignature(context: ColonyContext, memory: ProjectMemoryShape): string {
  const signature: SignatureShape = {
    readiness: context.readiness,
    rcl: context.stage.rcl,
    spawnCount: context.stage.spawnCount,
    sourceCount: context.stage.sourceCount,
    creepCount: context.stage.creepCount,
    constructionSiteCount: context.stage.constructionSiteCount,
    hostileCount: context.stage.hostileCount,
    spawnCapacity: context.energy.spawnCapacity,
    strategyMode: memory.config.strategy.mode,
    planningCadence: memory.config.strategy.planningCadence,
    allowExpansion: memory.config.strategy.allowExpansion,
    allowRemoteMining: memory.config.strategy.allowRemoteMining,
    allowMarket: memory.config.strategy.allowMarket,
    allowWarfare: memory.config.strategy.allowWarfare,
    allowLargeFortification: memory.config.strategy.allowLargeFortification
  };

  return JSON.stringify(signature);
}

/**
 * cadence 限制常规重算频率，signature 变更则保证关键状态或政策变化不会等到下一轮周期。
 */
export function shouldRefreshStrategyPlan(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number
): StrategyRefreshDecision {
  const existingPlan = memory.colonies[context.roomName]?.strategy;

  if (!existingPlan) {
    return {
      refresh: true,
      trigger: "missing-plan"
    };
  }

  if (tick >= existingPlan.nextRunTick) {
    return {
      refresh: true,
      trigger: "cadence"
    };
  }

  if (createStrategySignature(context, memory) !== existingPlan.signature) {
    return {
      refresh: true,
      trigger: "state-change"
    };
  }

  return {
    refresh: false,
    trigger: null
  };
}

/**
 * 纯策略规划只把当前事实压缩成可持久化摘要；后续阶段消费 intent 时才会排队或执行动作。
 */
export function buildStrategyPlan(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number,
  trigger: StrategyTrigger
): StrategyPlanMemory {
  const reasons: string[] = [];
  const priorities: string[] = [];
  const intents: StrategyIntentMemory[] = [];
  const deferrals: StrategyIntentMemory[] = [];

  const stage = deriveStrategyStage(context);

  addWorkerCoverageIntent(context, intents, priorities, reasons);
  addUpgradeIntent(context, intents, priorities, reasons);
  addConstructionIntent(context, intents, priorities, reasons);
  addRepairIntent(context, intents, priorities, reasons);
  addDefenseIntent(context, intents, priorities, reasons);
  addHighRiskDeferrals(memory, deferrals, reasons);

  return {
    version: 1,
    roomName: context.roomName,
    stage,
    status: "fresh",
    lastRunTick: tick,
    nextRunTick: tick + memory.config.strategy.planningCadence,
    lastTrigger: trigger,
    signature: createStrategySignature(context, memory),
    priorities,
    intents,
    deferrals,
    reasons
  };
}

function deriveStrategyStage(context: ColonyContext): string {
  if (context.readiness === "degraded") {
    return "degraded";
  }

  if (!context.stage.rcl || context.stage.rcl <= 1) {
    return "rcl1";
  }

  return `rcl${context.stage.rcl}`;
}

function addWorkerCoverageIntent(
  context: ColonyContext,
  intents: StrategyIntentMemory[],
  priorities: string[],
  reasons: string[]
): void {
  priorities.push("worker coverage");
  reasons.push(`worker coverage: ${context.stage.creepCount} creeps available for ${context.stage.sourceCount} sources`);
  intents.push(createIntent(StrategyIntentType.maintainWorkerCoverage, 100, "allowed", "maintain worker coverage"));
}

function addUpgradeIntent(
  context: ColonyContext,
  intents: StrategyIntentMemory[],
  priorities: string[],
  reasons: string[]
): void {
  priorities.push("upgrade");

  if (context.stage.hasController && context.stage.rcl !== null) {
    reasons.push(`upgrade: controller RCL ${context.stage.rcl} can progress`);
  } else {
    reasons.push("upgrade: blocked until controller is visible");
  }

  intents.push(createIntent(StrategyIntentType.prioritizeUpgrade, 90, "allowed", "prioritize controller upgrade"));
}

function addConstructionIntent(
  context: ColonyContext,
  intents: StrategyIntentMemory[],
  priorities: string[],
  reasons: string[]
): void {
  priorities.push("construction");
  reasons.push(`construction: ${context.stage.constructionSiteCount} sites visible`);

  if (context.stage.constructionSiteCount > 0) {
    intents.push(createIntent(StrategyIntentType.allowBasicConstruction, 70, "allowed", "allow basic construction"));
  }
}

function addRepairIntent(
  context: ColonyContext,
  intents: StrategyIntentMemory[],
  priorities: string[],
  reasons: string[]
): void {
  priorities.push("repair");

  if (context.readiness === "degraded") {
    reasons.push(`repair: degraded colony ${context.missingReasons.join(", ") || "needs recovery"}`);
  } else {
    reasons.push("repair: monitor critical structure hits before assigning repair work");
  }

  intents.push(createIntent(StrategyIntentType.repairCriticalStructures, 60, "allowed", "repair critical structures"));
}

function addDefenseIntent(
  context: ColonyContext,
  intents: StrategyIntentMemory[],
  priorities: string[],
  reasons: string[]
): void {
  priorities.push("defense");

  if (context.stage.hostileCount > 0) {
    reasons.push(`defense: ${context.stage.hostileCount} hostiles visible`);
  } else {
    reasons.push("defense: no hostiles visible");
  }

  intents.push(createIntent(StrategyIntentType.defenseWatch, 50, "allowed", "watch hostile state"));
}

function addHighRiskDeferrals(
  memory: ProjectMemoryShape,
  deferrals: StrategyIntentMemory[],
  reasons: string[]
): void {
  for (const type of HIGH_RISK_DEFERRALS) {
    const allowed = isIntentAllowed(type, memory.config);
    const gate = policyGateForIntent(type) ?? "strategy.unknown";
    const status = allowed ? StrategyIntentStatus.allowed : StrategyIntentStatus.gated;
    const reason = allowed ? `deferral: ${type} allowed by ${gate}` : `deferral: ${type} gated by ${gate}`;

    reasons.push(reason);
    deferrals.push(createIntent(type, 10, status, reason, gate));
  }
}

function createIntent(
  type: StrategyIntentType,
  priority: number,
  status: StrategyIntentStatus,
  reason: string,
  gate: string | null = null
): StrategyIntentMemory {
  return {
    type,
    priority,
    status,
    reason,
    gate
  };
}
