import { assert } from "chai";
import { buildBody, calculateBodyCost } from "spawning/bodyBuilder";

describe("spawn primitives body builder", () => {
  before(() => {
    (global as unknown as { BODYPART_COST: Record<string, number> }).BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50
    };
  });

  it("builds worker-style bodies from intent templates and derived costs", () => {
    const result = buildBody({
      role: "worker",
      intent: "balanced",
      energyBudget: 300
    });

    assert.isTrue(result.ok);
    assert.deepEqual(result.body, ["work", "carry", "move"]);
    assert.equal(result.cost, calculateBodyCost(result.body));
    assert.include(result.reason, "balanced");
  });

  it("returns a structured failure when energy budget below minimum 200", () => {
    const result = buildBody({
      role: "worker",
      intent: "balanced",
      energyBudget: 199
    });

    assert.isFalse(result.ok);
    assert.deepEqual(result.body, []);
    assert.equal(result.cost, 0);
    assert.equal(result.reason, "energy budget below minimum 200");
  });

  it("falls back from harvester template when budget cannot afford the preferred body", () => {
    const result = buildBody({
      role: "harvester",
      intent: "harvest",
      energyBudget: 250
    });

    assert.isTrue(result.ok);
    assert.deepEqual(result.body, ["work", "carry", "move"]);
    assert.equal(result.cost, 200);
    assert.equal(result.fallbackReason, "harvest template cost exceeds energy budget");
  });
});
