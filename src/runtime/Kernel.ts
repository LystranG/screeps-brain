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

/**
 * Tick 内核：按固定生命周期顺序执行各阶段，单阶段失败不阻断后续阶段。
 * 测试可通过 stages override 替换任意阶段 runner。
 */
export class Kernel {
  private readonly stages: LifecycleStageOverrides;
  private services: RuntimeServices | null = null;

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

        console.log(`Kernel stage ${stage.name} failed: ${result.failures[result.failures.length - 1].message}`);
      }
    }

    return result;
  }

  private createLifecycleStages(): LifecycleStage[] {
    return KERNEL_LIFECYCLE_STAGES.map(stage => ({
      name: stage.name,
      run: this.stages[stage.name] || stage.run
    }));
  }

  private shouldProfileStage(stageName: LifecycleStageName): boolean {
    return this.services !== null && stageName !== "refreshServices";
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
