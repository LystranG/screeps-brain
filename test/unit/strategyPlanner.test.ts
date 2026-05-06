import { assert } from "chai";
import { StrategyIntentType } from "constants/strategy";
import { ColonyContext } from "colony/types";
import { createDefaultProjectMemorySections, ProjectMemoryShape } from "memory/schema";
import { buildStrategyPlan, createStrategySignature } from "strategy/planner";
import { isHighRiskIntent, isIntentAllowed, policyGateForIntent } from "strategy/policy";

describe("strategy planner", () => {
  it("maps high-risk deferrals to exact strategy policy gates", () => {
    assert.equal(policyGateForIntent(StrategyIntentType.deferExpansion), "strategy.allowExpansion");
    assert.equal(policyGateForIntent(StrategyIntentType.deferRemoteMining), "strategy.allowRemoteMining");
    assert.equal(policyGateForIntent(StrategyIntentType.deferMarket), "strategy.allowMarket");
    assert.equal(policyGateForIntent(StrategyIntentType.deferWarfare), "strategy.allowWarfare");
    assert.equal(policyGateForIntent(StrategyIntentType.deferLargeFortification), "strategy.allowLargeFortification");
  });

  it("blocks all high-risk intents with the default strategy config", () => {
    const memory = createDefaultProjectMemorySections();

    assert.isTrue(isHighRiskIntent(StrategyIntentType.deferExpansion));
    assert.isFalse(isIntentAllowed(StrategyIntentType.deferExpansion, memory.config));
    assert.isFalse(isIntentAllowed(StrategyIntentType.deferRemoteMining, memory.config));
    assert.isFalse(isIntentAllowed(StrategyIntentType.deferMarket, memory.config));
    assert.isFalse(isIntentAllowed(StrategyIntentType.deferWarfare, memory.config));
    assert.isFalse(isIntentAllowed(StrategyIntentType.deferLargeFortification, memory.config));
  });

  it("builds an intent-ready fresh plan with low-risk actions and gated high-risk deferrals", () => {
    const memory = createProjectMemory();
    const context = createStrategyContext();

    const plan = buildStrategyPlan(context, memory, 100, "missing-plan");

    assert.equal(plan.version, 1);
    assert.equal(plan.roomName, "W1N1");
    assert.equal(plan.stage, "rcl2");
    assert.equal(plan.status, "fresh");
    assert.equal(plan.lastRunTick, 100);
    assert.equal(plan.nextRunTick, 150);
    assert.equal(plan.lastTrigger, "missing-plan");
    assert.equal(plan.signature, createStrategySignature(context, memory));
    assert.includeMembers(plan.priorities, ["worker coverage", "upgrade", "construction", "repair", "defense"]);
    assert.includeMembers(plan.reasons, ["upgrade: controller RCL 2 can progress", "construction: 2 sites visible"]);
    assert.isAtLeast(plan.reasons.filter((reason: string) => reason.indexOf("deferral:") === 0).length, 5);

    assertIntent(plan.intents, StrategyIntentType.maintainWorkerCoverage, "allowed", null);
    assertIntent(plan.intents, StrategyIntentType.prioritizeUpgrade, "allowed", null);
    assertIntent(plan.intents, StrategyIntentType.allowBasicConstruction, "allowed", null);
    assertIntent(plan.intents, StrategyIntentType.repairCriticalStructures, "allowed", null);
    assertIntent(plan.intents, StrategyIntentType.defenseWatch, "allowed", null);

    assertIntent(plan.deferrals, StrategyIntentType.deferExpansion, "gated", "strategy.allowExpansion");
    assertIntent(plan.deferrals, StrategyIntentType.deferRemoteMining, "gated", "strategy.allowRemoteMining");
    assertIntent(plan.deferrals, StrategyIntentType.deferMarket, "gated", "strategy.allowMarket");
    assertIntent(plan.deferrals, StrategyIntentType.deferWarfare, "gated", "strategy.allowWarfare");
    assertIntent(plan.deferrals, StrategyIntentType.deferLargeFortification, "gated", "strategy.allowLargeFortification");
  });

  it("uses degraded stage and defense reasons when context readiness is degraded", () => {
    const memory = createProjectMemory();
    const context = createStrategyContext({
      readiness: "degraded",
      missingReasons: ["missing spawn"],
      rcl: null,
      spawnCount: 0,
      sourceCount: 1,
      hostileCount: 1,
      defense: "hostiles"
    });

    const plan = buildStrategyPlan(context, memory, 200, "manual");

    assert.equal(plan.stage, "degraded");
    assert.equal(plan.status, "fresh");
    assert.include(plan.reasons, "defense: 1 hostiles visible");
    assert.include(plan.reasons, "upgrade: blocked until controller is visible");
    assert.include(plan.reasons, "repair: degraded colony missing spawn");
    assertIntent(plan.intents, StrategyIntentType.defenseWatch, "allowed", null);
  });
});

function createProjectMemory(): ProjectMemoryShape {
  return {
    ...createDefaultProjectMemorySections(),
    creeps: {}
  };
}

function createStrategyContext(overrides: Partial<StrategyContextOverrides> = {}): ColonyContext {
  const rcl = overrides.rcl === undefined ? 2 : overrides.rcl;
  const spawnCount = overrides.spawnCount === undefined ? 1 : overrides.spawnCount;
  const sourceCount = overrides.sourceCount === undefined ? 2 : overrides.sourceCount;
  const creepCount = overrides.creepCount === undefined ? 1 : overrides.creepCount;
  const constructionSiteCount = overrides.constructionSiteCount === undefined ? 2 : overrides.constructionSiteCount;
  const hostileCount = overrides.hostileCount === undefined ? 0 : overrides.hostileCount;
  const defense = overrides.defense || "clear";

  return {
    roomName: "W1N1",
    primary: true,
    readiness: overrides.readiness || "ready",
    missingReasons: overrides.missingReasons || [],
    room: {} as Room,
    controller: rcl === null ? null : ({ level: rcl } as StructureController),
    spawns: createObjectList<StructureSpawn>(spawnCount),
    sources: createObjectList<Source>(sourceCount),
    creeps: createObjectList<Creep>(creepCount),
    constructionSites: createObjectList<ConstructionSite>(constructionSiteCount),
    hostiles: createObjectList<Creep>(hostileCount),
    energy: {
      available: overrides.energyAvailable === undefined ? 200 : overrides.energyAvailable,
      capacity: overrides.energyCapacity === undefined ? 300 : overrides.energyCapacity,
      spawnCapacity: overrides.spawnCapacity === undefined ? 300 : overrides.spawnCapacity
    },
    stage: {
      rcl,
      spawnCount,
      sourceCount,
      creepCount,
      constructionSiteCount,
      hostileCount,
      hasSpawn: spawnCount > 0,
      hasSource: sourceCount > 0,
      hasController: rcl !== null,
      defense
    },
    intel: {
      roomName: "W1N1",
      spawns: createObjectList<StructureSpawn>(spawnCount),
      sources: createObjectList<Source>(sourceCount),
      creeps: createObjectList<Creep>(creepCount),
      constructionSites: createObjectList<ConstructionSite>(constructionSiteCount),
      hostiles: createObjectList<Creep>(hostileCount),
      controller: rcl === null ? null : ({ level: rcl } as StructureController),
      energy: {
        available: overrides.energyAvailable === undefined ? 200 : overrides.energyAvailable,
        capacity: overrides.energyCapacity === undefined ? 300 : overrides.energyCapacity,
        spawnCapacity: overrides.spawnCapacity === undefined ? 300 : overrides.spawnCapacity
      },
      scannedTick: 100
    }
  };
}

interface StrategyContextOverrides {
  readiness: "ready" | "degraded";
  missingReasons: string[];
  rcl: number | null;
  spawnCount: number;
  sourceCount: number;
  creepCount: number;
  constructionSiteCount: number;
  hostileCount: number;
  defense: "clear" | "hostiles";
  energyAvailable: number;
  energyCapacity: number;
  spawnCapacity: number;
}

function createObjectList<T>(count: number): T[] {
  return Array.from({ length: count }, () => ({} as T));
}

function assertIntent(
  intents: Array<{ type: string; status: string; gate: string | null }>,
  type: string,
  status: string,
  gate: string | null
): void {
  const intent = intents.find(candidate => candidate.type === type);

  assert.isDefined(intent, `expected intent ${type}`);
  assert.equal(intent?.status, status);
  assert.equal(intent?.gate, gate);
}
