import { CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect } from "constants/commands";

const OUTPUT_SEPARATOR = "----------------------------------------";

export function formatCommandResult(result: CommandResult): string {
  return renderCommandBlock([result.status, ...splitMessageLines(result.message)]);
}

export function renderRootHelp(namespaces: readonly CommandNamespaceDefinition[]): string {
  const lines = [
    "cmd.help()",
    ...namespaces.map(namespace => `cmd.${namespace.name}.help() [${namespace.effect}] ${namespace.summary}`)
  ];

  return renderCommandBlock(lines);
}

export function renderNamespaceHelp(namespace: CommandNamespaceDefinition): string {
  const lines = [`cmd.${namespace.name}.help() [${namespace.effect}] ${namespace.summary}`];

  for (const command of namespace.commands) {
    // Help 只读取定义元数据，避免公开命令树和文档说明发生漂移。
    lines.push(`${command.signature} [${command.effect}] ${command.description}`);
  }

  if (namespace.effect === CommandEffect.futureBlocked && namespace.commands.length === 0) {
    lines.push(`cmd.${namespace.name}.help() [future/blocked] Future namespace has no active commands.`);
  }

  return renderCommandBlock(lines);
}

function renderCommandBlock(lines: readonly string[]): string {
  return [OUTPUT_SEPARATOR, ...lines.filter(line => line.length > 0), OUTPUT_SEPARATOR].join("\n");
}

function splitMessageLines(message: string): string[] {
  const explicitLines = message.split("\n");
  const lines: string[] = [];

  if (explicitLines.length > 1) {
    return explicitLines;
  }

  for (const line of explicitLines) {
    lines.push(...splitCompactFields(line));
  }

  return lines;
}

function splitCompactFields(line: string): string[] {
  return splitRecordSegment(line, true);
}

function splitRecordSegment(line: string, allowCompactFieldSplit: boolean): string[] {
  const segments = line.trim().split(/\s+/);
  const titleSplitIndex = findReadableTitleSplitIndex(line);

  if (segments.length <= 1) {
    return [line];
  }

  if (titleSplitIndex > 0) {
    return [line.slice(0, titleSplitIndex + 1), ...splitRecordSegment(line.slice(titleSplitIndex + 2), allowCompactFieldSplit)];
  }

  const firstFieldIndex = segments.findIndex(segment => isCompactField(segment));

  if (firstFieldIndex === 0 && allowCompactFieldSplit) {
    return segments;
  }

  if (firstFieldIndex < 0 || !allowCompactFieldSplit) {
    return [line];
  }

  // 命令消息常用 "label: key=value key=value" 压缩展示；控制台里拆成多行更适合人工检验。
  return [segments.slice(0, firstFieldIndex).join(" "), ...segments.slice(firstFieldIndex)];
}

function isCompactField(segment: string): boolean {
  return /^[A-Za-z0-9_.:-]+=[^=]+$/.test(segment);
}

function findReadableTitleSplitIndex(line: string): number {
  const splitIndex = line.indexOf(": ");

  if (splitIndex <= 0) {
    return -1;
  }

  const prefix = line.slice(0, splitIndex);
  const suffix = line.slice(splitIndex + 2);

  const prefixWords = prefix.trim().split(/\s+/).filter(Boolean);
  const hasStructuredSuffix = suffix.charAt(0) === "{" || suffix.charAt(0) === "[" || suffix.indexOf("=") >= 0;

  if (prefixWords.length >= 2 && hasStructuredSuffix) {
    return splitIndex;
  }

  return -1;
}
