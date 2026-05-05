import { assert } from "chai";
import { CommandEffect } from "constants/commands";
import {
  validateBooleanArgument,
  validateConfirmToken,
  validateDumpPath,
  validateSamplingRate
} from "commands/arguments";
import { formatCommandResult, renderNamespaceHelp, renderRootHelp } from "commands/formatter";
import { recordCommandHistory } from "commands/history";
import { createCommandRegistry } from "commands/registry";
import { CommandNamespaceDefinition } from "commands/types";
import { createDefaultProjectMemorySections } from "memory/schema";
import { createMockGame } from "./mock";

describe("command core|formatter|help", () => {
  const configNamespace: CommandNamespaceDefinition = {
    name: "config",
    summary: "Inspect and update safe runtime configuration.",
    effect: CommandEffect.writesMemory,
    commands: [
      {
        name: "logLevel",
        signature: "cmd.config.logLevel(level)",
        description: "Update Memory.config.observability.logLevel.",
        effect: CommandEffect.writesMemory,
        run: () => ({ ok: true, status: "OK", message: "logLevel: info -> debug", effect: CommandEffect.writesMemory })
      },
      {
        name: "deepProfiler",
        signature: "cmd.config.deepProfiler(enabled, token)",
        description: "Toggle the deep profiler after explicit confirmation.",
        effect: CommandEffect.requiresConfirm,
        run: () => ({
          ok: false,
          status: "CONFIRM",
          message: "Pass CONFIRM to toggle deep profiler.",
          effect: CommandEffect.requiresConfirm
        })
      }
    ]
  };

  const namespaces: CommandNamespaceDefinition[] = [
    {
      name: "env",
      summary: "Inspect the current Screeps runtime environment.",
      effect: CommandEffect.readOnly,
      commands: [
        {
          name: "status",
          signature: "cmd.env.status()",
          description: "Show current shard and environment status.",
          effect: CommandEffect.readOnly,
          run: () => ({ ok: true, status: "OK", message: "environment: sim", effect: CommandEffect.readOnly })
        }
      ]
    },
    configNamespace,
    {
      name: "spawn",
      summary: "Future spawn queue commands.",
      effect: CommandEffect.futureBlocked,
      commands: [
        {
          name: "help",
          signature: "cmd.spawn.help()",
          description: "Spawn commands require the spawn queue phase.",
          effect: CommandEffect.futureBlocked,
          run: () => ({
            ok: false,
            status: "FUTURE",
            message: "spawn requires spawn queue phase.",
            effect: CommandEffect.futureBlocked
          })
        }
      ]
    }
  ];

  it("formats structured command results with stable prefixes", () => {
    assert.equal(
      formatCommandResult({
        ok: true,
        status: "OK",
        message: "logLevel: info -> debug",
        effect: CommandEffect.writesMemory
      }),
      "OK logLevel: info -> debug"
    );
    assert.equal(
      formatCommandResult({
        ok: false,
        status: "ERR",
        message: "Log level must be one of: debug, info, warn, error",
        effect: CommandEffect.readOnly
      }),
      "ERR Log level must be one of: debug, info, warn, error"
    );
  });

  it("renders root help from namespace metadata", () => {
    const help = renderRootHelp(namespaces);

    assert.include(help, "cmd.help()");
    assert.include(help, "cmd.env.help()");
    assert.include(help, "cmd.config.help()");
    assert.include(help, "read-only");
    assert.include(help, "writes-memory");
    assert.include(help, "future/blocked");
  });

  it("renders namespace help with signatures and side effects", () => {
    const help = renderNamespaceHelp(configNamespace);

    assert.include(help, "cmd.config.logLevel(level)");
    assert.include(help, "cmd.config.deepProfiler(enabled, token)");
    assert.include(help, "writes-memory");
    assert.include(help, "requires-confirm");
  });
});

describe("command core|arguments", () => {
  it("validates the exact confirmation token", () => {
    assert.deepEqual(validateConfirmToken(undefined), {
      ok: false,
      reason: "Confirmation token must be CONFIRM"
    });
    assert.deepEqual(validateConfirmToken("CONFIRM"), { ok: true, value: "CONFIRM" });
  });

  it("strictly whitelists debug dump paths", () => {
    assert.deepEqual(validateDumpPath("Memory.config"), { ok: true, value: "Memory.config" });
    assert.isFalse(validateDumpPath("screeps.json").ok);
  });

  it("accepts only finite integer sampling rates in range", () => {
    assert.deepEqual(validateSamplingRate(10), { ok: true, value: 10 });
    assert.isFalse(validateSamplingRate(0).ok);
    assert.isFalse(validateSamplingRate(Number.NaN).ok);
    assert.isFalse(validateSamplingRate(Infinity).ok);
    assert.isFalse(validateSamplingRate("10").ok);
  });

  it("accepts only booleans and exact boolean strings", () => {
    assert.deepEqual(validateBooleanArgument(true), { ok: true, value: true });
    assert.deepEqual(validateBooleanArgument(false), { ok: true, value: false });
    assert.deepEqual(validateBooleanArgument("true"), { ok: true, value: true });
    assert.deepEqual(validateBooleanArgument("false"), { ok: true, value: false });
    assert.isFalse(validateBooleanArgument(" TRUE ").ok);
    assert.isFalse(validateBooleanArgument(1).ok);
  });
});

describe("command core|registry|history", () => {
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

  const configNamespace: CommandNamespaceDefinition = {
    name: "config",
    summary: "Inspect and update safe runtime configuration.",
    effect: CommandEffect.writesMemory,
    commands: [
      {
        name: "logLevel",
        signature: "cmd.config.logLevel(level)",
        description: "Update Memory.config.observability.logLevel.",
        effect: CommandEffect.writesMemory,
        run: args => ({
          ok: true,
          status: "OK",
          message: `logLevel: info -> ${String(args[0])}`,
          effect: CommandEffect.writesMemory
        })
      },
      {
        name: "status",
        signature: "cmd.config.status()",
        description: "Show runtime configuration.",
        effect: CommandEffect.readOnly,
        run: () => ({ ok: true, status: "OK", message: "config: ready", effect: CommandEffect.readOnly })
      }
    ]
  };

  it("records compact history for mutating command results", () => {
    const memory = createCommandMemory();
    const registry = createCommandRegistry([configNamespace]);

    const result = registry.execute(["config", "logLevel"], ["debug"], createContext(memory));

    assert.equal(result.status, "OK");
    assert.deepEqual(memory.commands.history, [
      {
        tick: 12345,
        path: "config.logLevel",
        args: ["debug"],
        status: "OK"
      }
    ]);
  });

  it("does not record read-only commands unless recordReadOnly is enabled", () => {
    const memory = createCommandMemory();
    const registry = createCommandRegistry([configNamespace]);

    registry.execute(["config", "status"], [], createContext(memory));
    assert.deepEqual(memory.commands.history, []);

    (memory.commands as { recordReadOnly?: boolean }).recordReadOnly = true;
    registry.execute(["config", "status"], [], createContext(memory));

    assert.deepEqual(memory.commands.history, [
      {
        tick: 12345,
        path: "config.status",
        args: [],
        status: "OK"
      }
    ]);
  });

  it("caps command history at the configured limit", () => {
    const memory = createCommandMemory();

    for (let tick = 1; tick <= 55; tick += 1) {
      recordCommandHistory(
        memory,
        tick,
        ["config", "logLevel"],
        [tick],
        { ok: true, status: "OK", message: "updated", effect: CommandEffect.writesMemory }
      );
    }

    assert.lengthOf(memory.commands.history, 50);
    assert.equal(memory.commands.history[0].tick, 6);
  });

  it("returns structured errors for unknown namespaces and commands", () => {
    const memory = createCommandMemory();
    const registry = createCommandRegistry([configNamespace]);

    assert.deepEqual(registry.execute(["missing"], [], createContext(memory)), {
      ok: false,
      status: "ERR",
      message: "Unknown command namespace: missing",
      effect: CommandEffect.readOnly
    });
    assert.deepEqual(registry.execute(["config", "missing"], [], createContext(memory)), {
      ok: false,
      status: "ERR",
      message: "Unknown command: config.missing",
      effect: CommandEffect.readOnly
    });
  });
});
