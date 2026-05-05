import { assert } from "chai";
import { CommandEffect } from "constants/commands";
import { formatCommandResult, renderNamespaceHelp } from "commands/formatter";
import { CommandContext } from "commands/types";
import { createEnvNamespace } from "commands/namespaces/env";
import { createSimNamespace } from "commands/namespaces/sim";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("command inspection|env|sim", () => {
  function createInspectionMemory(): Memory {
    return {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;
  }

  function createContext(memory: Memory, game?: ReturnType<typeof createMockGame>): CommandContext {
    return {
      game: (game ?? createMockGame()) as unknown as Game,
      memory
    };
  }

  it("defines cmd.env.status() as read-only environment inspection", () => {
    const game = createMockGame();
    game.shard.name = "shard1";
    game.rooms = {
      W1N1: { controller: { my: true } },
      W1N2: { controller: { my: false } }
    };
    game.spawns = { Spawn1: {} };
    const namespace = createEnvNamespace();

    const help = renderNamespaceHelp(namespace);
    const result = namespace.commands[0].run([], createContext(createInspectionMemory(), game));

    assert.equal(namespace.effect, CommandEffect.readOnly);
    assert.include(help, "cmd.env.status()");
    assert.include(help, "read-only");
    assert.include(formatCommandResult(result), "OK env status:");
    assert.include(result.message, "type=world");
    assert.include(result.message, "shard=shard1");
    assert.include(result.message, "visibleRooms=2");
    assert.include(result.message, "ownedRooms=1");
    assert.include(result.message, "spawns=1");
    assert.include(result.message, "cpuAvailable=true");
    assert.include(result.message, "reason=official world shard shard1");
  });

  it("defines cmd.sim.status() and cmd.sim.guidance() without mutating commands", () => {
    const memory = createInspectionMemory();
    memory.runtime.sim.bootstrap = {
      version: 1,
      completed: true,
      ready: false,
      lastRunTick: 123
    };
    memory.runtime.sim.guidance = {
      "missing-spawn": {
        message: "Sim setup needs at least one owned spawn.",
        lastSeenTick: 120,
        lastLoggedTick: 121,
        flagName: "lystran-sim-spawn-needed"
      }
    };
    const namespace = createSimNamespace();

    const commandNames = namespace.commands.map(command => command.name);
    const help = renderNamespaceHelp(namespace);
    const status = namespace.commands[0].run([], createContext(memory));
    const guidance = namespace.commands[1].run([], createContext(memory));

    assert.deepEqual(commandNames, ["status", "guidance"]);
    assert.notInclude(commandNames, "retry");
    assert.notInclude(commandNames, "bootstrap");
    assert.notInclude(commandNames, "enqueue");
    assert.notInclude(commandNames, "spawn");
    assert.notInclude(commandNames, "run");
    assert.include(help, "cmd.sim.status()");
    assert.include(help, "cmd.sim.guidance()");
    assert.include(help, "read-only");
    assert.include(status.message, "version=1");
    assert.include(status.message, "completed=true");
    assert.include(status.message, "ready=false");
    assert.include(status.message, "lastRunTick=123");
    assert.include(guidance.message, "missing-spawn");
    assert.include(guidance.message, "message=Sim setup needs at least one owned spawn.");
    assert.include(guidance.message, "lastSeenTick=120");
    assert.include(guidance.message, "lastLoggedTick=121");
    assert.include(guidance.message, "flagName=lystran-sim-spawn-needed");
  });

  it("reports no sim guidance when guidance memory is empty", () => {
    const namespace = createSimNamespace();
    const result = namespace.commands[1].run([], createContext(createInspectionMemory()));

    assert.deepEqual(result, {
      ok: true,
      status: "OK",
      message: "sim guidance: none",
      effect: CommandEffect.readOnly
    });
  });
});
