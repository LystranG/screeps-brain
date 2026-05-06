import { assert } from "chai";
import { StrategyIntentType } from "constants/strategy";
import { createDefaultProjectMemorySections } from "memory/schema";
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
});
