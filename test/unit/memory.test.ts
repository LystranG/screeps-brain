import { assert } from "chai";
import { CURRENT_MEMORY_VERSION } from "memory/schema";
import { runMemoryMigrations } from "../../src/memory/migrations";

describe("memory migrations", () => {
  it("upgrades empty Memory to the v1 skeleton", () => {
    const memory = {} as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, 1);
    assert.deepEqual(memory.creeps, {});
    assert.isFalse(memory.runtime.bootstrapped);
    assert.isNull(memory.runtime.migrationError);
    assert.isFalse(memory.config.automation.enabled);
    assert.equal(memory.config.strategy.mode, "manual");
    assert.deepEqual(memory.colonies, {});
    assert.deepEqual(memory.processes, {});
    assert.deepEqual(memory.commands.queue, []);
    assert.equal(memory.stats.ticks, 0);
  });

  it("upgrades old memory while preserving existing creep entries", () => {
    const memory = {
      version: 0,
      creeps: {
        worker1: {
          role: "worker",
          room: "W1N1",
          working: false
        }
      }
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.isTrue(result.ok);
    assert.equal(memory.version, 1);
    assert.deepEqual(memory.creeps.worker1, {
      role: "worker",
      room: "W1N1",
      working: false
    });
  });

  it("repairs partial legacy sections while preserving existing values", () => {
    const memory = {
      version: 0,
      runtime: {
        bootstrapped: true
      },
      config: {
        automation: {
          enabled: true
        },
        strategy: {},
        construction: {},
        defense: {}
      },
      commands: {},
      stats: {},
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.isTrue(result.ok);
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.isTrue(memory.runtime.bootstrapped);
    assert.equal(memory.runtime.lastMigration, CURRENT_MEMORY_VERSION);
    assert.isNull(memory.runtime.migrationError);
    assert.isTrue(memory.config.automation.enabled);
    assert.equal(memory.config.automation.mode, "manual");
    assert.equal(memory.config.strategy.mode, "manual");
    assert.isFalse(memory.config.construction.allowExtensions);
    assert.equal(memory.config.defense.safeMode, "manual");
    assert.deepEqual(memory.commands.queue, []);
    assert.deepEqual(memory.commands.history, []);
    assert.equal(memory.stats.ticks, 0);
    assert.deepEqual(memory.stats.cpu, {});
  });

  it("is idempotent when run repeatedly", () => {
    const memory = {} as Memory;

    runMemoryMigrations(memory);
    const firstMigration = JSON.stringify(memory);
    runMemoryMigrations(memory);

    assert.equal(JSON.stringify(memory), firstMigration);
    assert.equal(memory.version, 1);
  });

  it("returns a failure result for future memory versions", () => {
    const memory = {
      version: 2,
      creeps: {}
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.isFalse(result.ok);
    if (!result.ok) {
      assert.include(result.reason, "Unsupported Memory.version");
    }
  });
});
