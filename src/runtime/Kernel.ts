import { KERNEL_STAGE_ORDER, LifecycleStage, LifecycleStageName } from "runtime/lifecycle";
import { cleanupDeadCreepMemory } from "cleanup/creepMemory";
import { runMemoryMigrations } from "memory/migrations";

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

  /**
   * 按固定生命周期执行一个 tick；迁移失败会阻断后续阶段，其他阶段失败会记录后继续。
   */
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

        // Memory schema 不可信时不能继续执行后续系统，避免把坏状态扩散到本 tick。
        if (stage.name === "migrate") {
          return result;
        }

        console.log(`Kernel stage ${stage.name} failed: ${result.failures[result.failures.length - 1].message}`);
      }
    }

    return result;
  }

  // 测试可以覆盖任意阶段，生产路径则回落到默认阶段 runner。
  private createLifecycleStages(): LifecycleStage[] {
    return KERNEL_STAGE_ORDER.map(stageName => ({
      name: stageName,
      run: this.stages[stageName] || getDefaultStageRunner(stageName)
    }));
  }
}

// 通过穷尽 switch 绑定阶段名，新增阶段时 TypeScript 会暴露遗漏的默认 runner。
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
  // 迁移失败也要留下 runtime section，方便后续 tick 和控制台诊断失败原因。
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
  // cleanup 阶段只做 tick 末尾的安全收尾，不放置新的策略行为。
  cleanupDeadCreepMemory();
}

function flushStats(): void {
  return;
}
