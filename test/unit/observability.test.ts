import { assert } from "chai";
import * as sinon from "sinon";
import { Logger } from "logging/Logger";
import { createDefaultProjectMemorySections } from "memory/schema";
import { Profiler } from "profiling/Profiler";
import { flushRuntimeStats } from "stats/Stats";

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

describe("profiler|stats|kernel observability services", () => {
  it("records profiler stage deltas from CPU values", () => {
    const cpuValues = [1, 3, 6];
    const profiler = new Profiler({
      getUsed: () => {
        const nextValue = cpuValues.shift();

        return nextValue === undefined ? 6 : nextValue;
      }
    });

    profiler.startStage("migrate");
    assert.deepEqual(profiler.endStage("migrate"), { stage: "migrate", duration: 2 });
    assert.deepEqual(profiler.endStage("cleanup"), { stage: "cleanup", duration: 0 });
    assert.deepEqual(profiler.getSamples(), [
      { stage: "migrate", duration: 2 },
      { stage: "cleanup", duration: 0 }
    ]);
  });

  it("updates rolling stats summaries", () => {
    const memory = createMemoryWithDefaults();

    flushRuntimeStats(
      memory,
      [
        { stage: "migrate", duration: 2 },
        { stage: "cleanup", duration: 5 }
      ],
      true,
      10
    );
    flushRuntimeStats(memory, [{ stage: "migrate", duration: 4 }], true, 11);

    assert.equal(memory.stats.ticks, 11);
    assert.isTrue(memory.stats.cpu.available);
    assert.deepEqual(memory.stats.cpu.stages.migrate, {
      last: 4,
      average: 3,
      max: 4,
      samples: 2
    });
    assert.deepEqual(memory.stats.cpu.stages.cleanup, {
      last: 5,
      average: 5,
      max: 5,
      samples: 1
    });
  });

  it("keeps sim CPU stats structurally present when available === false", () => {
    const memory = createMemoryWithDefaults();

    flushRuntimeStats(memory, [{ stage: "migrate", duration: 0 }], false, 12);

    assert.equal(memory.stats.ticks, 12);
    assert.isFalse(memory.stats.cpu.available);
    assert.deepEqual(memory.stats.cpu.stages.migrate, {
      last: 0,
      average: 0,
      max: 0,
      samples: 1
    });
  });
});

function createMemoryWithDefaults(): Memory {
  return {
    ...createDefaultProjectMemorySections(),
    creeps: {},
    flags: {},
    powerCreeps: {},
    rooms: {},
    spawns: {}
  };
}
