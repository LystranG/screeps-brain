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
    const activeHelper = helper;

    const initialTick = await activeHelper.server.world.gameTime;
    await activeHelper.tick();
    const nextTick = await activeHelper.server.world.gameTime;
    const help = await activeHelper.runCommand("cmd.help()");
    await activeHelper.tickUntil(async () => (await activeHelper.readMemory()).runtime !== undefined, 5, "project Memory migration");
    const memory = await activeHelper.readMemory();

    assert.isAbove(nextTick, initialTick);
    assertReadyBootstrapMemory(memory, activeHelper.roomName);
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
