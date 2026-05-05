import { COMMAND_HISTORY_LIMIT, CommandEffect } from "constants/commands";
import { CommandResult, CommandStatus } from "commands/types";
import { stringifyArgument } from "commands/arguments";

interface CommandHistoryRecord extends Record<string, unknown> {
  tick: number;
  path: string;
  args: string[];
  status: CommandStatus;
}

export function recordCommandHistory(
  memory: Memory,
  tick: number,
  path: readonly string[],
  args: readonly unknown[],
  result: CommandResult
): void {
  const shouldRecord =
    result.effect === CommandEffect.writesMemory ||
    result.effect === CommandEffect.requiresConfirm ||
    ((memory.commands as { recordReadOnly?: boolean }).recordReadOnly === true &&
      result.effect === CommandEffect.readOnly);

  if (!shouldRecord) {
    return;
  }

  const record: CommandHistoryRecord = {
    tick,
    path: path.join("."),
    args: args.map(stringifyArgument),
    status: result.status
  };

  memory.commands.history.push(record);

  while (memory.commands.history.length > COMMAND_HISTORY_LIMIT) {
    memory.commands.history.shift();
  }
}
