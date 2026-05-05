import { RoleName } from "constants/roles";

export type BodyIntent = "balanced" | "harvest" | "upgrade" | "build";

export interface BodyBuildRequest {
  role: RoleName;
  intent: BodyIntent;
  energyBudget: number;
}

export interface BodyBuildResult {
  ok: boolean;
  body: BodyPartConstant[];
  cost: number;
  reason: string;
  fallbackReason?: string;
}

interface BodyTemplate {
  body: BodyPartConstant[];
  fallback?: BodyPartConstant[];
}

const MINIMUM_BODY_COST = 200;

export function calculateBodyCost(body: BodyPartConstant[]): number {
  return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

export function buildBody(request: BodyBuildRequest): BodyBuildResult {
  if (request.energyBudget < MINIMUM_BODY_COST) {
    return {
      ok: false,
      body: [],
      cost: 0,
      reason: "energy budget below minimum 200"
    };
  }

  const template = createTemplatesByIntent()[request.intent];
  const preferredCost = calculateBodyCost(template.body);

  if (preferredCost <= request.energyBudget) {
    return {
      ok: true,
      body: template.body,
      cost: preferredCost,
      reason: `${request.role} ${request.intent} template selected`
    };
  }

  if (template.fallback) {
    const fallbackCost = calculateBodyCost(template.fallback);

    if (fallbackCost <= request.energyBudget) {
      return {
        ok: true,
        body: template.fallback,
        cost: fallbackCost,
        reason: `${request.role} ${request.intent} fallback selected`,
        fallbackReason: `${request.intent} template cost exceeds energy budget`
      };
    }
  }

  return {
    ok: false,
    body: [],
    cost: 0,
    reason: `${request.role} ${request.intent} template cost exceeds energy budget`
  };
}

function createTemplatesByIntent(): Record<BodyIntent, BodyTemplate> {
  return {
    balanced: {
      body: [WORK, CARRY, MOVE]
    },
    harvest: {
      body: [WORK, WORK, CARRY, MOVE],
      fallback: [WORK, CARRY, MOVE]
    },
    upgrade: {
      body: [WORK, CARRY, MOVE]
    },
    build: {
      body: [WORK, CARRY, MOVE]
    }
  };
}
