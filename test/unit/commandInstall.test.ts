import { assert } from "chai";
import { renderRootHelp } from "commands/formatter";
import { installConsoleCommands } from "commands/installer";
import { createDefaultCommandRegistry } from "commands/registry";
import { CommandNamespaceDefinition } from "commands/types";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("command install|registry assembly", () => {
  it("assembles the sim command namespace", () => {
    const registry = createDefaultCommandRegistry();
    const namespaces = registry.listNamespaces().map((namespace: CommandNamespaceDefinition) => namespace.name);

    assert.deepEqual(namespaces, ["sim"]);
  });

  it("renders root help with sim namespace", () => {
    const registry = createDefaultCommandRegistry();
    const help = renderRootHelp(registry.listNamespaces());

    assert.include(help, "cmd.sim.help()");
    assert.include(help, "Simulation bootstrap inspection commands");
  });
});

describe("command install|global cmd", () => {
  interface TestCommandGlobalState {
    cmd?: {
      help(): string;
      sim: {
        help(): string;
        guidance(): string;
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
    delete (global as unknown as TestCommandGlobalState).cmd;
    delete (global as unknown as TestCommandGlobalState).__cmdApiVersion;
  });

  it("installs string-returning public command methods", () => {
    installConsoleCommands();
    const cmd = installedCmd();

    assert.isString(cmd.help());
    assert.isString(cmd.sim.status());
    assert.isString(cmd.sim.guidance());
    assert.include(cmd.help(), "cmd.sim.help()");
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
});
