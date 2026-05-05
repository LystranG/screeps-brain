import { assert } from "chai";
import * as sinon from "sinon";
import { renderRootHelp } from "commands/formatter";
import { installConsoleCommands } from "commands/installer";
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

describe("command install|global cmd", () => {
  interface TestCommandGlobalState {
    cmd?: {
      help(): string;
      env: {
        help(): string;
        status(): string;
      };
      sim: {
        help(): string;
        guidance(): string;
        status(): string;
      };
      config: {
        help(): string;
        logLevel(level: string): string;
      };
      debug: {
        help(): string;
        dump(path: string, maxLength?: number): string;
      };
      spawn: {
        help(): string;
        status(): string;
      };
    };
    __cmdApiVersion?: number;
  }

  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = createMockGame();
    // @ts-ignore : allow adding Memory to global
    global.Memory = {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;
    delete (global as unknown as TestCommandGlobalState).cmd;
    delete (global as unknown as TestCommandGlobalState).__cmdApiVersion;
  });

  afterEach(() => {
    if (consoleLog) {
      consoleLog.restore();
      consoleLog = null;
    }

    delete (global as unknown as TestCommandGlobalState).cmd;
    delete (global as unknown as TestCommandGlobalState).__cmdApiVersion;
  });

  it("installs string-returning public command methods", () => {
    installConsoleCommands();
    const cmd = (global as unknown as TestCommandGlobalState).cmd;

    assert.exists(cmd);
    assert.isString(cmd?.help());
    assert.isString(cmd?.env.status());
    assert.isString(cmd?.sim.guidance());
    assert.isString(cmd?.config.logLevel("debug"));
    assert.isString(cmd?.debug.dump("Memory.config", 200));
    assert.include(cmd?.help() ?? "", "cmd.env.help()");
    assert.include(cmd?.env.status() ?? "", "OK env status:");
    assert.include(cmd?.config.logLevel("debug") ?? "", "OK logLevel: debug -> debug");
    assert.include(cmd?.debug.dump("Memory.config", 200) ?? "", "OK debug dump Memory.config:");
    assert.include(cmd?.spawn.status() ?? "", "FUTURE spawn commands require spawn queue phase");
  });

  it("reuses same-version cmd and rebuilds stale version bindings", () => {
    installConsoleCommands();
    const globalState = global as unknown as TestCommandGlobalState;
    const firstCmd = globalState.cmd;

    installConsoleCommands();
    assert.strictEqual(globalState.cmd, firstCmd);

    globalState.__cmdApiVersion = 0;
    installConsoleCommands();

    assert.notStrictEqual(globalState.cmd, firstCmd);
    assert.equal(globalState.__cmdApiVersion, 1);
  });

  it("does not console.log from ordinary public wrappers", () => {
    consoleLog = sinon.stub(console, "log");

    installConsoleCommands();
    const cmd = (global as unknown as TestCommandGlobalState).cmd;

    cmd?.env.status();
    cmd?.config.logLevel("debug");
    cmd?.debug.dump("Memory.config", 200);

    assert.isFalse(consoleLog.called);
  });
});
