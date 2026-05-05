import { assert } from "chai";
import { createDefaultCommandRegistry } from "commands/registry";
import { CommandNamespaceDefinition } from "commands/types";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("command install|registry assembly", () => {
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

    assert.deepEqual(namespaces, ["env", "sim", "config", "debug", "colony", "strategy", "spawn"]);
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
