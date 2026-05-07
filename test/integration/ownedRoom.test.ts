import { assert } from "chai";
import { assertCommandIncludes, assertProcessRan, assertReadyBootstrapMemory } from "./assertions";
import { createOwnedRoomScenario } from "./scenarios";

describe("normal owned-room bootstrap", function () {
  this.timeout(30000);

  it("initializes kernel, Memory, colony readiness, processes, and commands", async () => {
    const scenario = await createOwnedRoomScenario({ roomName: "W1N1" });

    try {
      await scenario.tickUntil(async () => {
        const memory = await scenario.readMemory();

        return (
          memory.colonies?.W1N1?.status === "ready" &&
          memory.processes?.bootstrapExecution?.lastRunTick !== null &&
          memory.processes?.bootstrapExecution?.lastRunTick !== undefined
        );
      }, 50, "owned room ready bootstrap memory");

      const memory = await scenario.readMemory();

      assertReadyBootstrapMemory(memory, "W1N1");
      assert.equal(memory.runtime.environment.type, "red-phase-placeholder");
      assert.isString(memory.version);
      assert.isString(memory.colonies.W1N1.intel.controllerId);
      assert.isAtLeast(memory.colonies.W1N1.intel.sourceIds.length, 1);
      assert.isAtLeast(memory.colonies.W1N1.intel.spawnIds.length, 1);
      assertProcessRan(memory, "colonyIntel");
      assertProcessRan(memory, "strategyPlanning");
      assertProcessRan(memory, "bootstrapExecution");
      assertProcessRan(memory, "creepRoles");

      assertCommandIncludes(await scenario.runCommand("cmd.env.status()"), ["type=", "ownedRooms=1"]);
      assertCommandIncludes(await scenario.runCommand("cmd.colony.status()"), ["ready", "W1N1"]);
      assertCommandIncludes(await scenario.runCommand("cmd.spawn.queue()"), ["queued="]);
      assertCommandIncludes(await scenario.runCommand("cmd.strategy.status()"), ["strategy"]);
      assertCommandIncludes(await scenario.runCommand("cmd.debug.stats()"), ["ticks="]);
    } finally {
      await scenario.close();
    }
  });
});
