import { runMemoryMigrations } from "memory/migrations";
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

      try {
        stage.run();
      } catch (error) {
        result.ok = false;
        result.failures.push({
          stage: stage.name,
          message: error instanceof Error ? error.message : "Unknown kernel stage failure"
        });

        if (stage.name === "migrate") {
          return result;
        }

        console.log(`Kernel stage ${stage.name} failed: ${result.failures[result.failures.length - 1].message}`);
      }
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
  const migrationResult = runMemoryMigrations(Memory);

  if (!migrationResult.ok) {
    recordMigrationError(migrationResult.reason);
    throw new Error(migrationResult.reason);
  }
}

function recordMigrationError(reason: string): void {
  Memory.runtime = Memory.runtime || {
    bootstrapped: false,
    lastMigration: typeof Memory.version === "number" ? Memory.version : 0,
    migrationError: null
  };
  Memory.runtime.bootstrapped = false;
  Memory.runtime.migrationError = reason;
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
