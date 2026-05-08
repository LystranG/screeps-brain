import {
  KERNEL_LIFECYCLE_STAGES,
  LifecycleStage,
  LifecycleStageName,
  RuntimeLifecycleContext
} from "runtime/lifecycle";
import { RuntimeServices } from "runtime/services";

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
  private services: RuntimeServices | null = null;

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
        const shouldProfile = this.shouldProfileStage(stage.name);

        if (shouldProfile) {
          this.services?.profiler.startStage(stage.name);
        }

        const context = this.createLifecycleContext();

        stage.run(context);
        this.services = context.services;

        if (shouldProfile) {
          this.services?.profiler.endStage(stage.name);
        }
      } catch (error) {
        if (this.shouldProfileStage(stage.name)) {
          this.services?.profiler.endStage(stage.name);
        }

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
    return KERNEL_LIFECYCLE_STAGES.map(stage => ({
      name: stage.name,
      run: this.stages[stage.name] || stage.run
    }));
  }

  private shouldProfileStage(stageName: LifecycleStageName): boolean {
    return this.services !== null && stageName !== "migrate" && stageName !== "flushStats";
  }

  private createLifecycleContext(): RuntimeLifecycleContext {
    return {
      memory: Memory,
      game: Game,
      tick: Game.time,
      services: this.services,
      requireServices: () => this.requireServices()
    };
  }

  private requireServices(): RuntimeServices {
    if (this.services === null) {
      throw new Error("Runtime services are not initialized");
    }

    return this.services;
  }
}
