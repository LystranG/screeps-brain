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

  it("renders root help with active strategy inspection commands", () => {
    const registry = createDefaultCommandRegistry();
    const help = renderRootHelp(registry.listNamespaces());

    assert.include(help, "cmd.env.help()");
    assert.include(help, "cmd.sim.help()");
    assert.include(help, "cmd.config.help()");
    assert.include(help, "cmd.debug.help()");
    assert.include(help, "cmd.colony.help()");
    assert.include(help, "cmd.strategy.help()");
    assert.include(help, "cmd.spawn.help()");
    assert.notInclude(help, "requires strategy planning phase");
    assert.include(help, "Read-only colony context inspection commands");
    assert.include(help, "Read-only strategy planning inspection commands");
    assert.include(help, "Read-only spawn queue and dry-run inspection commands");
  });

  it("executes representative handlers from implemented namespaces", () => {
    const memory = createCommandMemory();
    const registry = createDefaultCommandRegistry();
    const context = createContext(memory);

    assert.equal(registry.execute(["env", "status"], [], context).status, "OK");
    assert.equal(registry.execute(["config", "logLevel"], ["debug"], context).status, "OK");
    assert.equal(registry.execute(["strategy", "status"], [], context).status, "OK");
    assert.equal(registry.execute(["spawn", "status"], [], context).status, "OK");
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
      strategy: {
        explain(room?: string): string;
        help(): string;
        plan(room?: string): string;
        status(): string;
      };
      spawn: {
        help(): string;
        dryRun(room?: string, role?: string, energy?: number): string;
        queue(): string;
        status(): string;
      };
    };
    __cmdApiVersion?: number;
  }

  function installedCmd(): NonNullable<TestCommandGlobalState["cmd"]> {
    const currentCmd = (global as unknown as TestCommandGlobalState).cmd;

    assert.exists(currentCmd);

    return currentCmd as NonNullable<TestCommandGlobalState["cmd"]>;
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
    const cmd = installedCmd();

    assert.isString(cmd.help());
    assert.isString(cmd.env.status());
    assert.isString(cmd.sim.guidance());
    assert.isString(cmd.config.logLevel("debug"));
    assert.isString(cmd.debug.dump("Memory.config", 200));
    assert.isString(cmd.strategy.status());
    assert.isString(cmd.strategy.plan());
    assert.isString(cmd.strategy.explain());
    assert.include(cmd.help(), "cmd.env.help()");
    assert.include(cmd.env.status(), "OK env status:");
    assert.include(cmd.config.logLevel("debug"), "OK logLevel: debug -> debug");
    assert.include(cmd.debug.dump("Memory.config", 200), "OK debug dump Memory.config:");
    assert.include(cmd.strategy.status(), "OK strategy status:");
    assert.include(cmd.spawn.status(), "OK spawn status:");
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
    const cmd = installedCmd();

    cmd.env.status();
    cmd.config.logLevel("debug");
    cmd.debug.dump("Memory.config", 200);

    assert.isFalse(consoleLog.called);
  });
});
