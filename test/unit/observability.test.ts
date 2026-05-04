import { assert } from "chai";
import * as sinon from "sinon";
import { Logger } from "logging/Logger";

describe("logger|observability logger", () => {
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

    logger.info("kernel:migrate", "migration ok");
    logger.warn("kernel:cleanup", "cleanup slow");
    logger.error("stats", "flush failed");

    assert.isTrue(consoleLog.calledWith("[info] kernel:migrate: migration ok"));
    assert.isTrue(consoleLog.calledWith("[warn] kernel:cleanup: cleanup slow"));
    assert.isTrue(consoleLog.calledWith("[error] stats: flush failed"));
  });

  it("filters debug output at the default info level", () => {
    consoleLog = sinon.stub(console, "log");
    const logger = new Logger({}, () => 10);

    logger.debug("kernel:migrate", "debug details");

    assert.isFalse(consoleLog.called);
  });

  it("suppresses disabled namespaces", () => {
    consoleLog = sinon.stub(console, "log");
    const logger = new Logger({ enabledNamespaces: { "kernel:cleanup": false } }, () => 10);

    logger.warn("kernel:cleanup", "cleanup warning");
    logger.error("kernel:cleanup", "cleanup error");
    logger.info("kernel:migrate", "migration ok");

    assert.isFalse(consoleLog.calledWithMatch("kernel:cleanup"));
    assert.isTrue(consoleLog.calledOnceWith("[info] kernel:migrate: migration ok"));
  });

  it("applies namespace sampling to info logs at ticks 10 and 11", () => {
    consoleLog = sinon.stub(console, "log");
    const loggerAtSampledTick = new Logger({ namespaceSampling: { stats: 5 } }, () => 10);
    const loggerAtSkippedTick = new Logger({ namespaceSampling: { stats: 5 } }, () => 11);

    loggerAtSampledTick.info("stats", "rolling summary");
    loggerAtSkippedTick.info("stats", "rolling summary");
    loggerAtSampledTick.warn("stats", "warning bypasses namespace sampling");

    assert.isTrue(consoleLog.calledWith("[info] stats: rolling summary"));
    assert.isTrue(consoleLog.calledWith("[warn] stats: warning bypasses namespace sampling"));
    assert.equal(consoleLog.withArgs("[info] stats: rolling summary").callCount, 1);
  });
});
