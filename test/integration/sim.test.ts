import { assert } from "chai";
import { assertCommandIncludes, assertReadyBootstrapMemory, assertSpawnQueueProgressed } from "./assertions";
import { IntegrationTestHelper } from "./helper";
import { createOwnedRoomScenario, createSimReadyScenario, probeSimShardCapability } from "./scenarios";

describe("official-sim-style bootstrap", function () {
  this.timeout(30000);

  let helper: IntegrationTestHelper | null = null;

  afterEach(async function () {
    if (helper !== null) {
      await helper.close();
      helper = null;
    }
  });

  it("uses the normal runtime path when sim has required objects", async () => {
    const capability = await probeSimShardCapability();

    if (capability.kind === "sim-shard-supported") {
      helper = await createSimReadyScenario({ roomName: "W1N1" });
      const activeHelper = helper;

      await activeHelper.tickUntil(async () => {
        const memory = await activeHelper.readMemory();

        return memory.runtime.sim.bootstrap.completed === true && memory.colonies.W1N1?.status === "ready";
      }, 10, "sim ready shared runtime path");

      const memory = await activeHelper.readMemory();
      const simStatus = await activeHelper.runCommand("cmd.sim.status()");
      const simGuidance = await activeHelper.runCommand("cmd.sim.guidance()");
      const colonyStatus = await activeHelper.runCommand("cmd.colony.status()");
      const spawnQueue = await activeHelper.runCommand("cmd.spawn.queue()");

      assertReadyBootstrapMemory(memory, "W1N1");
      assertSpawnQueueProgressed(memory, "W1N1");
      assertCommandIncludes(simStatus, ["ready=true"]);
      assert.isTrue(
        simGuidance.indexOf("sim guidance: none") >= 0 ||
          ["missing-spawn", "missing-source", "missing-controller"].every(code => simGuidance.indexOf(code) < 0)
      );
      assertCommandIncludes(colonyStatus, ["colony status:", "ready=1"]);
      assertCommandIncludes(spawnQueue, ["spawn queue:"]);

      return;
    }

    // mock-server difference: local mock servers may not preserve Game.shard.name === "sim"; keep shared-path facts automated.
    helper = await createOwnedRoomScenario({ roomName: "W1N1", includeCreep: true });
    const activeHelper = helper;

    assert.equal(capability.kind, "manual-fallback-required");
    assert.isString(capability.reason);
    await activeHelper.tickUntil(async () => (await activeHelper.readMemory()).colonies.W1N1?.status === "ready", 10, "fallback ready path");

    const memory = await activeHelper.readMemory();
    const colonyStatus = await activeHelper.runCommand("cmd.colony.status()");
    const spawnQueue = await activeHelper.runCommand("cmd.spawn.queue()");

    assertReadyBootstrapMemory(memory, "W1N1");
    assertSpawnQueueProgressed(memory, "W1N1");
    assertCommandIncludes(colonyStatus, ["colony status:", "ready=1"]);
    assertCommandIncludes(spawnQueue, ["spawn queue:"]);
  });
});
