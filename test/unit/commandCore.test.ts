import { assert } from "chai";
import { CommandEffect } from "constants/commands";
import { formatCommandResult, renderNamespaceHelp, renderRootHelp } from "commands/formatter";
import { createCommandRegistry } from "commands/registry";
import { CommandNamespaceDefinition } from "commands/types";

describe("command core|formatter|help", () => {
  const simNamespace: CommandNamespaceDefinition = {
    name: "sim",
    summary: "Simulation bootstrap inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.sim.status()",
        description: "Show existing sim bootstrap state.",
        effect: CommandEffect.readOnly,
        run: () => ({ ok: true, status: "OK", message: "sim status: ready=true", effect: CommandEffect.readOnly })
      }
    ]
  };

  const namespaces: CommandNamespaceDefinition[] = [simNamespace];

  it("formats structured command results with stable prefixes", () => {
    assert.equal(
      formatCommandResult({
        ok: true,
        status: "OK",
        message: "sim status: ready=true",
        effect: CommandEffect.readOnly
      }),
      ["----------------------------------------", "OK", "sim status:", "ready=true", "----------------------------------------"].join("\n")
    );
  });

  it("wraps help output in the same readable block", () => {
    const help = renderRootHelp(namespaces);

    assert.equal(help.split("\n")[0], "----------------------------------------");
    assert.equal(help.split("\n")[help.split("\n").length - 1], "----------------------------------------");
    assert.include(help, "\ncmd.help()\n");
    assert.include(help, "\ncmd.sim.help() [read-only] Simulation bootstrap inspection commands\n");
  });

  it("renders namespace help with signatures and side effects", () => {
    const help = renderNamespaceHelp(simNamespace);

    assert.include(help, "cmd.sim.status()");
    assert.include(help, "read-only");
  });
});

describe("command core|registry", () => {
  const simNamespace: CommandNamespaceDefinition = {
    name: "sim",
    summary: "Simulation bootstrap inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.sim.status()",
        description: "Show existing sim bootstrap state.",
        effect: CommandEffect.readOnly,
        run: () => ({ ok: true, status: "OK", message: "sim ready", effect: CommandEffect.readOnly })
      }
    ]
  };

  it("executes a known command and returns the result", () => {
    const registry = createCommandRegistry([simNamespace]);
    const context = { game: {} as Game, memory: {} as Memory };

    const result = registry.execute(["sim", "status"], [], context);

    assert.isTrue(result.ok);
    assert.equal(result.message, "sim ready");
  });

  it("returns structured errors for unknown namespaces and commands", () => {
    const registry = createCommandRegistry([simNamespace]);
    const context = { game: {} as Game, memory: {} as Memory };

    assert.deepEqual(registry.execute(["missing"], [], context), {
      ok: false,
      status: "ERR",
      message: "Unknown command namespace: missing",
      effect: CommandEffect.readOnly
    });
    assert.deepEqual(registry.execute(["sim", "missing"], [], context), {
      ok: false,
      status: "ERR",
      message: "Unknown command: sim.missing",
      effect: CommandEffect.readOnly
    });
  });
});
