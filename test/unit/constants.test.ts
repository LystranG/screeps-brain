import { assert } from "chai";
import { CommandPath } from "constants/commands";
import { MemoryKey } from "constants/memory";
import { ProcessName } from "constants/processes";
import { RoleName } from "constants/roles";
import { RuntimeEnvironment, ShardName } from "constants/runtime";
import { StrategyMode } from "constants/strategy";
import { validateRoomName } from "validation/roomName";

describe("constants|validation", () => {
  it("exposes stable runtime constants", () => {
    assert.equal(ShardName.sim, "sim");
    assert.equal(RuntimeEnvironment.sim, "sim");
    assert.equal(RuntimeEnvironment.world, "world");
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
});
