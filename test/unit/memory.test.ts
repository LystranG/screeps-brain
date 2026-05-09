import { assert } from "chai";
import { CURRENT_MEMORY_VERSION, createDefaultProjectMemorySections } from "memory/schema";
import { runMemoryMigrations } from "../../src/memory/migrations";

describe("memory migrations", () => {
  it("initializes empty Memory to the current skeleton", () => {
    const memory = {} as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
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

  it("resets legacy Memory instead of preserving old schema values", () => {
    const memory = {
      version: 1,
      runtime: {
        bootstrapped: true,
        lastMigration: 1,
        migrationError: null
      },
      config: {
        automation: {
          enabled: true,
          mode: "manual"
        }
      },
      colonies: {
        W1N1: {
          roomName: "W1N1"
        }
      },
      creeps: {
        worker1: {
          role: "worker"
        }
      }
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.isFalse(memory.runtime.bootstrapped);
    assert.isFalse(memory.config.automation.enabled);
    assert.deepEqual(memory.colonies, {});
    assert.deepEqual(memory.creeps, {});
  });

  it("does not fail future Memory versions during pre-live development", () => {
    const memory = {
      version: CURRENT_MEMORY_VERSION + 1,
      creeps: {
        worker1: {
          role: "worker"
        }
      }
    } as unknown as Memory;

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(memory.version, CURRENT_MEMORY_VERSION);
    assert.deepEqual(memory.creeps, {});
  });

  it("is idempotent when run repeatedly", () => {
    const memory = {} as Memory;

    runMemoryMigrations(memory);
    const firstMigration = JSON.stringify(memory);
    runMemoryMigrations(memory);

    assert.equal(JSON.stringify(memory), firstMigration);
  });

  it("leaves current skeleton Memory untouched across ticks", () => {
    const memory = {
      ...createDefaultProjectMemorySections(),
      colonies: {
        W1N1: {
          roomName: "W1N1"
        }
      },
      creeps: {
        worker1: {
          role: "worker"
        }
      }
    } as unknown as Memory;

    const beforeMigration = JSON.stringify(memory);

    const result = runMemoryMigrations(memory);

    assert.deepEqual(result, { ok: true, version: CURRENT_MEMORY_VERSION });
    assert.equal(JSON.stringify(memory), beforeMigration);
  });
});
