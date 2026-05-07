import { assert } from "chai";
import { ProcessName } from "constants/processes";
import { assertCommandIncludes, assertProcessRan, assertReadyBootstrapMemory } from "./assertions";
import { IntegrationTestHelper } from "./helper";
import { createOwnedRoomScenario } from "./scenarios";

describe("integration harness smoke", function () {
  this.timeout(60000);

  let helper: IntegrationTestHelper | null = null;

  afterEach(async function () {
    if (helper !== null) {
      await helper.close();
      helper = null;
    }
  });

  it("ticks the built bundle and exposes project Memory plus global cmd output", async function () {
    helper = await createOwnedRoomScenario();

    const initialTick = await helper.server.world.gameTime;
    await helper.tick();
    const nextTick = await helper.server.world.gameTime;
    const memory = await helper.readMemory();
    const help = await helper.runCommand("cmd.help()");

    assert.isAbove(nextTick, initialTick);
    assertReadyBootstrapMemory(memory, helper.roomName);
    assertProcessRan(memory, ProcessName.colonyIntel);
    assertCommandIncludes(help, [
      "cmd.env.help()",
      "cmd.sim.help()",
      "cmd.colony.help()",
      "cmd.spawn.help()",
      "cmd.strategy.help()",
      "cmd.debug.help()"
    ]);
  });
});
