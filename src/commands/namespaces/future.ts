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
    name: CommandPath.colony,
    summary: "Colony commands require colony context phase.",
    signature: "cmd.colony.status()",
    dependencyNote: "requires colony context phase"
  },
  {
    name: CommandPath.strategy,
    summary: "Strategy commands require strategy planning phase.",
    signature: "cmd.strategy.status()",
    dependencyNote: "requires strategy planning phase"
  },
  {
    name: CommandPath.spawn,
    summary: "Spawn commands require spawn queue phase.",
    signature: "cmd.spawn.status()",
    dependencyNote: "requires spawn queue phase"
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
    case CommandPath.colony:
      return "colony commands require colony context phase; no request queued";
    case CommandPath.strategy:
      return "strategy commands require strategy planning phase; no request queued";
    case CommandPath.spawn:
      return "spawn commands require spawn queue phase; no request queued";
    default:
      return "future commands require a later phase; no request queued";
  }
}
