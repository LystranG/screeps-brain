import { assert } from "chai";
import * as sinon from "sinon";
import { loop } from "../../src/main";
import { Game, Memory } from "./mock";

describe("main", () => {
  let consoleLog: sinon.SinonStub | null = null;

  before(() => {
    // runs before all test in this block
  });

  beforeEach(() => {
    // runs before each test in this block
    // @ts-ignore : allow adding Game to global
    global.Game = _.clone(Game);
    // @ts-ignore : allow adding Memory to global
    global.Memory = _.clone(Memory);
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

  it("should return void when called with no context", () => {
    assert.isUndefined(loop());
  });

  it("runs the kernel lifecycle when called", () => {
    consoleLog = sinon.stub(console, "log");
    Memory.creeps.persistValue = "any value";
    Memory.creeps.notPersistValue = "any value";
    Game.creeps.persistValue = "any value";

    loop();

    assert.isDefined(Memory.creeps.persistValue);
    assert.isUndefined(Memory.creeps.notPersistValue);
    assert.isTrue(consoleLog.calledOnceWith("Cleaned up 1 stale creep memory entries"));
  });
});
