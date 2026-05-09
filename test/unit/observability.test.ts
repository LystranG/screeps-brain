import { assert } from "chai";
import * as sinon from "sinon";
import { Logger } from "logging/Logger";
import { Profiler } from "profiling/Profiler";
import { createScreepsProfilerAdapter } from "profiling/ScreepsProfilerAdapter";

describe("observability|logger", () => {
  let consoleLog: sinon.SinonStub | null = null;

  afterEach(() => {
    if (consoleLog) {
      consoleLog.restore();
      consoleLog = null;
    }
  });

  it("emits info, warn, and error through console.log by default", () => {
    consoleLog = sinon.stub(console, "log");
    const logger = new Logger({}, () => 10);

    logger.info("kernel:environment", "env ok");
    logger.warn("kernel:cleanup", "cleanup slow");
    logger.error("sim:bootstrap", "flush failed");

    assert.isTrue(consoleLog.calledWith("[info] kernel:environment: env ok"));
    assert.isTrue(consoleLog.calledWith("[warn] kernel:cleanup: cleanup slow"));
    assert.isTrue(consoleLog.calledWith("[error] sim:bootstrap: flush failed"));
  });

  it("filters debug output at the default info level", () => {
    consoleLog = sinon.stub(console, "log");
    const logger = new Logger({}, () => 10);

    logger.debug("kernel:environment", "debug details");

    assert.isFalse(consoleLog.called);
  });

  it("suppresses disabled namespaces", () => {
    consoleLog = sinon.stub(console, "log");
    const logger = new Logger({ enabledNamespaces: { "kernel:cleanup": false } }, () => 10);

    logger.warn("kernel:cleanup", "cleanup warning");
    logger.error("kernel:cleanup", "cleanup error");
    logger.info("kernel:environment", "env ok");

    assert.isFalse(consoleLog.calledWithMatch("kernel:cleanup"));
    assert.isTrue(consoleLog.calledOnceWith("[info] kernel:environment: env ok"));
  });

  it("applies namespace sampling to info logs", () => {
    consoleLog = sinon.stub(console, "log");
    const loggerAtSampledTick = new Logger({ namespaceSampling: { "sim:bootstrap": 5 } }, () => 10);
    const loggerAtSkippedTick = new Logger({ namespaceSampling: { "sim:bootstrap": 5 } }, () => 11);

    loggerAtSampledTick.info("sim:bootstrap", "rolling summary");
    loggerAtSkippedTick.info("sim:bootstrap", "rolling summary");
    loggerAtSampledTick.warn("sim:bootstrap", "warning bypasses namespace sampling");

    assert.isTrue(consoleLog.calledWith("[info] sim:bootstrap: rolling summary"));
    assert.isTrue(consoleLog.calledWith("[warn] sim:bootstrap: warning bypasses namespace sampling"));
    assert.equal(consoleLog.withArgs("[info] sim:bootstrap: rolling summary").callCount, 1);
  });
});

describe("observability|profiler", () => {
  it("records profiler stage deltas from CPU values", () => {
    const cpuValues = [1, 3, 6];
    const profiler = new Profiler({
      getUsed: () => {
        const nextValue = cpuValues.shift();
        return nextValue === undefined ? 6 : nextValue;
      }
    });

    profiler.startStage("installCommands");
    assert.deepEqual(profiler.endStage("installCommands"), { stage: "installCommands", duration: 2 });
    assert.deepEqual(profiler.endStage("cleanup"), { stage: "cleanup", duration: 0 });
    assert.deepEqual(profiler.getSamples(), [
      { stage: "installCommands", duration: 2 },
      { stage: "cleanup", duration: 0 }
    ]);
  });
});

describe("observability|deep profiler adapter", () => {
  it("returns the same function when deep profiler is disabled", () => {
    const adapter = createScreepsProfilerAdapter(false);
    const loop = () => "ok";

    assert.isFalse(adapter.enabled);
    assert.strictEqual(adapter.wrapLoop(loop), loop);
  });

  it("does not require live Screeps profiler APIs when disabled", () => {
    const adapter = createScreepsProfilerAdapter(false);

    adapter.registerClass(Logger, "Logger");
    adapter.registerObject({ label: "value" }, "object");
    adapter.registerFN(() => "ok");

    assert.isFalse(adapter.enabled);
  });
});
