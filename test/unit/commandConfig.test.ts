import { assert } from "chai";
import { createConfigNamespace } from "commands/namespaces/config";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("command config|observability config", () => {
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

  it("updates Memory.config.observability.logLevel with old and new values", () => {
    const memory = createCommandMemory();
    const namespace = createConfigNamespace();
    const command = namespace.commands.find(candidate => candidate.name === "logLevel");

    assert.exists(command);
    const result = command?.run(["debug"], createContext(memory));

    assert.deepEqual(result, {
      ok: true,
      status: "OK",
      message: "logLevel: info -> debug",
      effect: "writes-memory"
    });
    assert.equal(memory.config.observability.logLevel, "debug");
  });

  it("rejects invalid log levels without mutating Memory.config.observability", () => {
    const memory = createCommandMemory();
    const namespace = createConfigNamespace();
    const command = namespace.commands.find(candidate => candidate.name === "logLevel");

    const result = command?.run(["verbose"], createContext(memory));

    assert.deepEqual(result, {
      ok: false,
      status: "ERR",
      message: "Log level must be one of: debug, info, warn, error",
      effect: "writes-memory"
    });
    assert.equal(memory.config.observability.logLevel, "info");
  });

  it("updates profiler, namespace sampling, and namespace enabled config explicitly", () => {
    const memory = createCommandMemory();
    const namespace = createConfigNamespace();
    const profiler = namespace.commands.find(candidate => candidate.name === "profiler");
    const namespaceSampling = namespace.commands.find(candidate => candidate.name === "namespaceSampling");
    const namespaceEnabled = namespace.commands.find(candidate => candidate.name === "namespaceEnabled");

    assert.equal(profiler?.run([false], createContext(memory)).message, "profiler: true -> false");
    assert.equal(
      namespaceSampling?.run(["stats", 10], createContext(memory)).message,
      "namespaceSampling.stats: unset -> 10"
    );
    assert.equal(
      namespaceEnabled?.run(["stats", false], createContext(memory)).message,
      "namespaceEnabled.stats: unset -> false"
    );

    assert.equal(memory.config.observability.profiler.enabled, false);
    assert.equal(memory.config.observability.namespaceSampling.stats, 10);
    assert.deepEqual(memory.config.observability.enabledNamespaces.stats, { enabled: false });
  });

  it("does not expose a generic set command", () => {
    const namespace = createConfigNamespace();

    assert.isUndefined(namespace.commands.find(candidate => candidate.name === "set"));
  });
});

describe("command config|confirm|policy", () => {
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

  it("updates existing manual construction and defense policy toggles", () => {
    const memory = createCommandMemory();
    memory.config.construction.enabled = true;
    memory.config.defense.enabled = true;
    const namespace = createConfigNamespace();
    const construction = namespace.commands.find(candidate => candidate.name === "construction");
    const defense = namespace.commands.find(candidate => candidate.name === "defense");

    assert.equal(construction?.run([false], createContext(memory)).message, "construction: true -> false");
    assert.equal(defense?.run([false], createContext(memory)).message, "defense: true -> false");
    assert.equal(memory.config.construction.enabled, false);
    assert.equal(memory.config.defense.enabled, false);
  });

  it("requires CONFIRM before mutating deep profiler config", () => {
    const memory = createCommandMemory();
    const namespace = createConfigNamespace();
    const command = namespace.commands.find(candidate => candidate.name === "deepProfiler");

    assert.deepEqual(command?.run([true], createContext(memory)), {
      ok: false,
      status: "CONFIRM",
      message: "deepProfiler requires CONFIRM",
      effect: "requires-confirm"
    });
    assert.equal(memory.config.observability.deepProfiler.enabled, false);

    assert.equal(command?.run([true, "CONFIRM"], createContext(memory)).message, "deepProfiler: false -> true");
    assert.equal(memory.config.observability.deepProfiler.enabled, true);
  });

  it("requires CONFIRM before mutating expansion and remote mining policy flags", () => {
    const memory = createCommandMemory();
    const namespace = createConfigNamespace();
    const allowExpansion = namespace.commands.find(candidate => candidate.name === "allowExpansion");
    const allowRemoteMining = namespace.commands.find(candidate => candidate.name === "allowRemoteMining");

    assert.deepEqual(allowExpansion?.run([true], createContext(memory)), {
      ok: false,
      status: "CONFIRM",
      message: "allowExpansion requires CONFIRM",
      effect: "requires-confirm"
    });
    assert.deepEqual(allowRemoteMining?.run([true, "confirm"], createContext(memory)), {
      ok: false,
      status: "CONFIRM",
      message: "allowRemoteMining requires CONFIRM",
      effect: "requires-confirm"
    });
    assert.equal(memory.config.strategy.allowExpansion, false);
    assert.equal(memory.config.strategy.allowRemoteMining, false);

    assert.equal(allowExpansion?.run([true, "CONFIRM"], createContext(memory)).message, "allowExpansion: false -> true");
    assert.equal(
      allowRemoteMining?.run([true, "CONFIRM"], createContext(memory)).message,
      "allowRemoteMining: false -> true"
    );
    assert.equal(memory.config.strategy.allowExpansion, true);
    assert.equal(memory.config.strategy.allowRemoteMining, true);
  });
});
