import { assert } from "chai";
import { CommandPath } from "constants/commands";
import { MemoryKey } from "constants/memory";
import { ProcessName } from "constants/processes";
import { RoleName } from "constants/roles";
import { CpuAvailability, LogLevel, LoggerNamespace, RuntimeEnvironment, ShardName } from "constants/runtime";
import { StrategyMode } from "constants/strategy";
import { validateRoomName } from "validation/roomName";
import { validateLogLevel, validateRuntimeEnvironment, validateShardName } from "validation/runtime";
import { createMockGame } from "./mock";

describe("constants|validation", () => {
  it("exposes stable runtime constants", () => {
    assert.equal(ShardName.sim, "sim");
    assert.equal(RuntimeEnvironment.sim, "sim");
    assert.equal(RuntimeEnvironment.world, "world");
    assert.equal(LogLevel.info, "info");
    assert.equal(LoggerNamespace.kernelEnvironment, "kernel:environment");
    assert.equal(LoggerNamespace.simBootstrap, "sim:bootstrap");
    assert.equal(CpuAvailability.available, "available");
    assert.equal(RoleName.worker, "worker");
    assert.equal(ProcessName.kernel, "kernel");
    assert.equal(ProcessName.lifecycle, "lifecycle");
    assert.equal(MemoryKey.version, "version");
    assert.equal(MemoryKey.creeps, "creeps");
    assert.equal(CommandPath.help, "help");
    assert.equal(CommandPath.debug, "debug");
    assert.equal(StrategyMode.manual, "manual");
    assert.equal(StrategyMode.automatic, "automatic");
  });
  it("accepts any non-empty room name string in Phase 1", () => {
    assert.isTrue(validateRoomName("not-a-real-room").ok);
    assert.deepEqual(validateRoomName(" W1N1 "), { ok: true, value: "W1N1" });
  });

  it("rejects empty room name strings with a reason", () => {
    assert.isFalse(validateRoomName("").ok);
    assert.deepEqual(validateRoomName("   "), {
      ok: false,
      reason: "Room name must be a non-empty string"
    });
  });

  it("accepts known shard and environment values", () => {
    assert.deepEqual(validateShardName(" sim "), { ok: true, value: ShardName.sim });
    assert.deepEqual(validateRuntimeEnvironment("sim"), { ok: true, value: RuntimeEnvironment.sim });
  });

  it("validates log levels", () => {
    assert.deepEqual(validateLogLevel("info"), { ok: true, value: LogLevel.info });
    assert.deepEqual(validateLogLevel("verbose"), {
      ok: false,
      reason: "Log level must be one of: debug, info, warn, error"
    });
  });

  it("creates mutable Screeps runtime mocks for environment tests", () => {
    const game = createMockGame();

    game.shard.name = "sim";
    assert.equal(game.shard.name, "sim");
    assert.equal(game.cpu.getUsed(), 0);
    assert.deepEqual(game.rooms, {});
    assert.deepEqual(game.spawns, {});
    assert.deepEqual(game.flags, {});
  });

  it("rejects unknown shard and environment values with reasons", () => {
    assert.deepEqual(validateShardName("not-a-shard"), {
      ok: false,
      reason: "Shard name must be one of: sim, shard0, shard1, shard2, shard3, private, unknown"
    });
    assert.deepEqual(validateRuntimeEnvironment("staging"), {
      ok: false,
      reason: "Runtime environment must be one of: sim, world, private, unknown"
    });
  });
});
