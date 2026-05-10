import { assert } from "chai";
import * as sinon from "sinon";
import { createDefaultProjectMemorySections } from "memory/schema";
import { loop } from "../../src/main";
import { createMockGame, createMockMemory, mockGame, mockMemory } from "./mock";

describe("main", () => {
  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = createMockGame();
    // @ts-ignore : allow adding Memory to global
    global.Memory = createMockMemory();
  });

  afterEach(() => {
    if (consoleLog) {
      consoleLog.restore();
      consoleLog = null;
    }
  });

  it("should export a loop function", () => {
    assert.isTrue(typeof loop === "function");
  });

  it("should return void", () => {
    mockGame().shard.name = "shard0";
    Object.assign(mockMemory(), createDefaultProjectMemorySections());

    assert.isUndefined(loop());
  });

  it("does not emit the starter Current game tick log", () => {
    consoleLog = sinon.stub(console, "log");
    mockGame().shard.name = "shard0";
    Object.assign(mockMemory(), createDefaultProjectMemorySections());

    loop();

    assert.isFalse(consoleLog!.calledWithMatch("Current game tick"));
  });
});
