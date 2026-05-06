import { assert } from "chai";
import { CURRENT_MEMORY_VERSION, createDefaultProjectMemorySections, createDefaultStrategyPlanMemory } from "memory/schema";

describe("memory schema defaults", () => {
  it("creates Phase 5 strategy config with conservative policy gates", () => {
    const memory = createDefaultProjectMemorySections();

    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.deepEqual(memory.config.strategy, {
      mode: "manual",
      planningCadence: 50,
      allowExpansion: false,
      allowRemoteMining: false,
      allowMarket: false,
      allowWarfare: false,
      allowLargeFortification: false
    });
  });

  it("creates JSON-only default strategy plan summaries", () => {
    const strategy = createDefaultStrategyPlanMemory("W1N1", "test");

    assert.deepEqual(strategy, {
      version: 1,
      roomName: "W1N1",
      stage: "unknown",
      status: "stale",
      lastRunTick: 0,
      nextRunTick: 0,
      lastTrigger: "test",
      signature: "",
      priorities: [],
      intents: [],
      deferrals: [],
      reasons: ["strategy pending evaluation"]
    });
  });
});
