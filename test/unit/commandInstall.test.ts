import { assert } from "chai";
import { renderRootHelp } from "commands/formatter";
import { createDefaultCommandRegistry } from "commands/registry";
import { CommandNamespaceDefinition } from "commands/types";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("command install|registry assembly", () => {
  const expectedNamespaces = [
    "env",
    "sim",
    "config",
    "debug",
    "colony",
    "strategy",
    "spawn"
  ];

  function createCommandMemory(): Memory {
    return {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;
  }

  function createContext(memory: Memory) {
    return {
      game: createMockGame() as unknown as Game,
      memory
    };
  }

  it("assembles every real and future command namespace", () => {
    const registry = createDefaultCommandRegistry();
    const namespaces = registry.listNamespaces().map((namespace: CommandNamespaceDefinition) => namespace.name);

    assert.deepEqual(namespaces, expectedNamespaces);
  });

  it("renders root help with future namespace dependency notes", () => {
    const registry = createDefaultCommandRegistry();
    const help = renderRootHelp(registry.listNamespaces());

    assert.include(help, "cmd.env.help()");
    assert.include(help, "cmd.sim.help()");
    assert.include(help, "cmd.config.help()");
    assert.include(help, "cmd.debug.help()");
    assert.include(help, "cmd.colony.help()");
    assert.include(help, "cmd.strategy.help()");
    assert.include(help, "cmd.spawn.help()");
    assert.include(help, "requires colony context phase");
    assert.include(help, "requires strategy planning phase");
    assert.include(help, "requires spawn queue phase");
  });

  it("executes representative handlers from implemented and future namespaces", () => {
    const memory = createCommandMemory();
    const registry = createDefaultCommandRegistry();
    const context = createContext(memory);

    assert.equal(registry.execute(["env", "status"], [], context).status, "OK");
    assert.equal(registry.execute(["config", "logLevel"], ["debug"], context).status, "OK");
    assert.equal(registry.execute(["spawn", "status"], [], context).status, "FUTURE");
    assert.equal(memory.config.observability.logLevel, "debug");
  });
});
