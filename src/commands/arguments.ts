import { ValidationResult } from "validation/results";

export const CONFIRM_TOKEN = "CONFIRM";

export type CommandDumpPath =
  | "Memory.runtime"
  | "Memory.config"
  | "Memory.stats"
  | "Memory.commands";

const dumpPaths: readonly CommandDumpPath[] = [
  "Memory.runtime",
  "Memory.config",
  "Memory.stats",
  "Memory.commands"
];

export function validateConfirmToken(value: unknown): ValidationResult<typeof CONFIRM_TOKEN> {
  if (value === CONFIRM_TOKEN) {
    return { ok: true, value: CONFIRM_TOKEN };
  }

  return { ok: false, reason: "Confirmation token must be CONFIRM" };
}

export function validateDumpPath(value: unknown): ValidationResult<CommandDumpPath> {
  if (typeof value === "string" && dumpPaths.includes(value as CommandDumpPath)) {
    return { ok: true, value: value as CommandDumpPath };
  }

  return { ok: false, reason: `Dump path must be one of: ${dumpPaths.join(", ")}` };
}

export function validateSamplingRate(value: unknown): ValidationResult<number> {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 1 && value <= 1000) {
    return { ok: true, value };
  }

  return { ok: false, reason: "Sampling rate must be an integer from 1 through 1000" };
}

export function validateBooleanArgument(value: unknown): ValidationResult<boolean> {
  if (typeof value === "boolean") {
    return { ok: true, value };
  }

  if (value === "true") {
    return { ok: true, value: true };
  }

  if (value === "false") {
    return { ok: true, value: false };
  }

  return { ok: false, reason: "Boolean value must be true, false, \"true\", or \"false\"" };
}

export function stringifyArgument(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
    return String(value);
  }

  return Object.prototype.toString.call(value);
}
