import { CommandEffect, CommandPath } from "constants/commands";
import { CommandNamespaceDefinition, CommandResult } from "commands/types";

interface FutureNamespaceSpec {
  name: CommandPath;
  summary: string;
  signature: string;
  dependencyNote: string;
}

const FutureNamespaceSpecs: readonly FutureNamespaceSpec[] = [
  {
    name: CommandPath.strategy,
    summary: "Strategy commands require strategy planning phase.",
    signature: "cmd.strategy.status()",
    dependencyNote: "requires strategy planning phase"
  }
];

export function createFutureNamespaces(): CommandNamespaceDefinition[] {
  return FutureNamespaceSpecs.map(spec => ({
    name: spec.name,
    summary: `${spec.summary} ${spec.dependencyNote}; no request queued.`,
    effect: CommandEffect.futureBlocked,
    commands: [
      {
        name: "status",
        signature: spec.signature,
        description: `${spec.dependencyNote}; no request queued.`,
        effect: CommandEffect.futureBlocked,
        run: (): CommandResult => ({
          ok: false,
          status: "FUTURE",
          message: futureMessage(spec.name),
          effect: CommandEffect.futureBlocked
        })
      }
    ]
  }));
}

function futureMessage(name: CommandPath): string {
  switch (name) {
    case CommandPath.strategy:
      return "strategy commands require strategy planning phase; no request queued";
    default:
      return "future commands require a later phase; no request queued";
  }
}
