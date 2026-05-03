import { KERNEL_STAGE_ORDER, LifecycleStage, LifecycleStageName } from "runtime/lifecycle";

export interface KernelStageFailure {
  stage: LifecycleStageName;
  message: string;
}

export interface KernelRunResult {
  ok: boolean;
  executedStages: LifecycleStageName[];
  failures: KernelStageFailure[];
}

export type LifecycleStageOverrides = Partial<Record<LifecycleStageName, () => void>>;

export interface KernelOptions {
  stages?: LifecycleStageOverrides;
}

export class Kernel {
  private readonly stages: LifecycleStageOverrides;

  public constructor(options: KernelOptions = {}) {
    this.stages = options.stages || {};
  }

  public run(): KernelRunResult {
    const result: KernelRunResult = {
      ok: true,
      executedStages: [],
      failures: []
    };

    for (const stage of this.createLifecycleStages()) {
      result.executedStages.push(stage.name);
      stage.run();
    }

    return result;
  }

  private createLifecycleStages(): LifecycleStage[] {
    return KERNEL_STAGE_ORDER.map(stageName => ({
      name: stageName,
      run: this.stages[stageName] || getDefaultStageRunner(stageName)
    }));
  }
}

function getDefaultStageRunner(stageName: LifecycleStageName): () => void {
  switch (stageName) {
    case "migrate":
      return migrate;
    case "refreshServices":
      return refreshServices;
    case "detectEnvironmentBootstrap":
      return detectEnvironmentBootstrap;
    case "runColoniesAndProcesses":
      return runColoniesAndProcesses;
    case "runSpawning":
      return runSpawning;
    case "cleanup":
      return cleanup;
    case "flushStats":
      return flushStats;
  }
}

function migrate(): void {
  return;
}

function refreshServices(): void {
  return;
}

function detectEnvironmentBootstrap(): void {
  return;
}

function runColoniesAndProcesses(): void {
  return;
}

function runSpawning(): void {
  return;
}

function cleanup(): void {
  return;
}

function flushStats(): void {
  return;
}
