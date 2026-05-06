import { CommandContext, CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect, CommandPath } from "constants/commands";
import { StrategyIntentMemory, StrategyPlanMemory } from "memory/schema";

const HighRiskGateLabels = {
  expansion: "allowExpansion",
  remoteMining: "allowRemoteMining",
  market: "allowMarket",
  warfare: "allowWarfare",
  largeFortification: "allowLargeFortification"
} as const;

export function createStrategyNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.strategy,
    summary: "Read-only strategy planning inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.strategy.status()",
        description: "Show strategy plan counts and high-risk policy gate settings.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const plans = listStrategyPlans(context.memory);
          const fresh = plans.filter(plan => plan.status === "fresh").length;
          const stale = plans.filter(plan => plan.status === "stale").length;
          const blocked = plans.filter(plan => plan.status === "blocked").length;

          return okResult(
            [
              "strategy status:",
              `plans=${plans.length}`,
              `fresh=${fresh}`,
              `stale=${stale}`,
              `blocked=${blocked}`,
              `gates=${formatGateSettings(context.memory)}`
            ].join(" ")
          );
        }
      },
      {
        name: "plan",
        signature: "cmd.strategy.plan(room?)",
        description: "Show compact persisted strategy plan state for one colony room.",
        effect: CommandEffect.readOnly,
        run: (args, context): CommandResult => {
          const planResult = selectStrategyPlan(context.memory, args[0]);

          if (!planResult.ok) {
            return errorResult(planResult.error);
          }

          return okResult(`strategy plan ${planResult.plan.roomName}: ${formatPlan(planResult.plan)}`);
        }
      },
      {
        name: "explain",
        signature: "cmd.strategy.explain(room?)",
        description: "Show persisted strategy reasons, deferrals, and gated intents for one colony room.",
        effect: CommandEffect.readOnly,
        run: (args, context): CommandResult => {
          const planResult = selectStrategyPlan(context.memory, args[0]);

          if (!planResult.ok) {
            return errorResult(planResult.error);
          }

          return okResult(`strategy explain ${planResult.plan.roomName}: ${formatExplanation(planResult.plan)}`);
        }
      }
    ]
  };
}

function okResult(message: string): CommandResult {
  return {
    ok: true,
    status: "OK",
    message,
    effect: CommandEffect.readOnly
  };
}

function errorResult(message: string): CommandResult {
  return {
    ok: false,
    status: "ERR",
    message,
    effect: CommandEffect.readOnly
  };
}

function listStrategyPlans(memory: Memory): StrategyPlanMemory[] {
  return Object.keys(memory.colonies)
    .sort()
    .map(roomName => memory.colonies[roomName].strategy);
}

function selectStrategyPlan(
  memory: Memory,
  input: unknown
): { ok: true; plan: StrategyPlanMemory } | { ok: false; error: string } {
  const roomResult = resolveRoomName(memory, input);

  if (!roomResult.ok) {
    return {
      ok: false,
      error: roomResult.error
    };
  }

  const plan = memory.colonies[roomResult.roomName]?.strategy;

  if (plan === undefined) {
    return {
      ok: false,
      error: `strategy plan not found for room ${roomResult.roomName}`
    };
  }

  return {
    ok: true,
    plan
  };
}

function resolveRoomName(memory: Memory, input: unknown): { ok: true; roomName: string } | { ok: false; error: string } {
  if (input !== undefined) {
    if (typeof input !== "string" || input.trim().length === 0) {
      return {
        ok: false,
        error: "room must be a non-empty string"
      };
    }

    return {
      ok: true,
      roomName: input.trim()
    };
  }

  // 缺省房间优先沿用操作者配置；未配置时用排序后的 colony key 保持控制台输出稳定。
  const configuredPrimary = memory.config.colony.primaryRoomName;

  if (configuredPrimary !== null && memory.colonies[configuredPrimary] !== undefined) {
    return {
      ok: true,
      roomName: configuredPrimary
    };
  }

  const firstRoomName = Object.keys(memory.colonies).sort()[0];

  if (firstRoomName === undefined) {
    return {
      ok: false,
      error: "strategy plan not found for room none"
    };
  }

  return {
    ok: true,
    roomName: firstRoomName
  };
}

function formatGateSettings(memory: Memory): string {
  const gates = memory.config.strategy;

  return Object.keys(HighRiskGateLabels)
    .map(label => {
      const gateKey = HighRiskGateLabels[label as keyof typeof HighRiskGateLabels];

      return `${label}=${String(gates[gateKey])}`;
    })
    .join(",");
}

function formatPlan(plan: StrategyPlanMemory): string {
  return [
    `stage=${plan.stage}`,
    `status=${plan.status}`,
    `lastRunTick=${plan.lastRunTick}`,
    `nextRunTick=${plan.nextRunTick}`,
    `priorities=${formatStringList(plan.priorities)}`,
    `intents=${plan.intents.length}`,
    `deferrals=${plan.deferrals.length}`
  ].join(" ");
}

function formatExplanation(plan: StrategyPlanMemory): string {
  return [
    `reasons=${formatStringList(plan.reasons)}`,
    `deferrals=${formatIntentList(plan.deferrals)}`,
    `gated=${formatIntentList(plan.deferrals.filter(intent => intent.status === "gated"))}`
  ].join(" ");
}

function formatStringList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(",");
}

function formatIntentList(intents: readonly StrategyIntentMemory[]): string {
  if (intents.length === 0) {
    return "none";
  }

  return intents.map(formatIntent).join(",");
}

function formatIntent(intent: StrategyIntentMemory): string {
  return `${intent.type}:${intent.status}@${intent.gate ?? "none"}#${intent.priority}(${intent.reason})`;
}
