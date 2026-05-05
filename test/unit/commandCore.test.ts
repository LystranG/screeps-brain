import { assert } from "chai";
import { CommandEffect } from "constants/commands";
import { formatCommandResult, renderNamespaceHelp, renderRootHelp } from "commands/formatter";
import { CommandNamespaceDefinition } from "commands/types";

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
