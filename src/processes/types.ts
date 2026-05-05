import { ColonyContext } from "colony/types";
import { RuntimeServices } from "runtime/services";

export type ProcessRunStatus = "ok" | "skipped" | "error";

export interface ProcessRunResult {
  processId: string;
  status: ProcessRunStatus;
  message: string;
}

export interface ProcessDefinitionResult {
  status: Exclude<ProcessRunStatus, "skipped" | "error">;
  message: string;
}

export interface ProcessRunnerContext {
  contexts: readonly ColonyContext[];
  services: RuntimeServices;
  memory: Memory;
  game: Game;
  tick: number;
}

export interface ProcessDefinition {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  cadence: number;
  run(context: ProcessRunnerContext): ProcessDefinitionResult;
}
