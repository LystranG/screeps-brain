import { CommandEffect, CommandPath } from "constants/commands";
import { CommandNamespaceDefinition, CommandResult } from "commands/types";

export function createSimNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.sim,
    summary: "Simulation bootstrap inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.sim.status()",
        description: "Show existing sim bootstrap state.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const bootstrap = context.memory.runtime.sim.bootstrap;

          return {
            ok: true,
            status: "OK",
            message:
              `sim status: version=${bootstrap.version} completed=${String(bootstrap.completed)} ` +
              `ready=${String(bootstrap.ready)} lastRunTick=${bootstrap.lastRunTick}`,
            effect: CommandEffect.readOnly
          };
        }
      },
      {
        name: "guidance",
        signature: "cmd.sim.guidance()",
        description: "Show active sim setup guidance messages and flags.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          const guidance = context.memory.runtime.sim.guidance;
          const codes = Object.keys(guidance);

          if (codes.length === 0) {
            return {
              ok: true,
              status: "OK",
              message: "sim guidance: none",
              effect: CommandEffect.readOnly
            };
          }

          const entries = codes.map(code => {
            const entry = guidance[code];
            const fields = [
              code,
              `message=${entry.message ?? ""}`,
              `lastSeenTick=${entry.lastSeenTick ?? ""}`,
              `lastLoggedTick=${entry.lastLoggedTick ?? ""}`
            ];

            if (entry.flagName !== undefined) {
              fields.push(`flagName=${entry.flagName}`);
            }

            return fields.join(" ");
          });

          return {
            ok: true,
            status: "OK",
            message: `sim guidance:\n${entries.join("\n")}`,
            effect: CommandEffect.readOnly
          };
        }
      }
    ]
  };
}
