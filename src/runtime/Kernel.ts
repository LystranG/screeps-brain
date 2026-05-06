import { KERNEL_STAGE_ORDER, LifecycleStage, LifecycleStageName } from "runtime/lifecycle";
import { RuntimeServices, createRuntimeServices } from "runtime/services";
import { createDefaultProcessDefinitions, runProcessDefinitions } from "processes/runner";
import { detectRuntimeEnvironment, updateRuntimeEnvironmentSummary } from "environment/detection";
import { buildColonyContexts } from "colony/context";
import { cleanupDeadCreepMemory } from "cleanup/creepMemory";
import { flushRuntimeStats } from "stats/Stats";
import { installConsoleCommands } from "commands/installer";
import { runMemoryMigrations } from "memory/migrations";
import { runSimBootstrap } from "environment/simBootstrap";
import { runSpawnLifecycle } from "spawning/runner";

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

        stage.run();

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
    return KERNEL_STAGE_ORDER.map(stageName => ({
      name: stageName,
      run: this.stages[stageName] || this.getDefaultStageRunner(stageName)
    }));
  }

  private shouldProfileStage(stageName: LifecycleStageName): boolean {
    return this.services !== null && stageName !== "migrate" && stageName !== "flushStats";
  }

  // 通过穷尽 switch 绑定阶段名，新增阶段时 TypeScript 会暴露遗漏的默认 runner。
  private getDefaultStageRunner(stageName: LifecycleStageName): () => void {
    switch (stageName) {
      case "migrate":
        return () => this.migrate();
      case "refreshServices":
        return () => this.refreshServices();
      case "installCommands":
        return () => this.installCommands();
      case "detectEnvironmentBootstrap":
        return () => this.detectEnvironmentBootstrap();
      case "runColoniesAndProcesses":
        return () => this.runColoniesAndProcesses();
      case "runSpawning":
        return () => this.runSpawning();
      case "cleanup":
        return () => this.cleanup();
      case "flushStats":
        return () => this.flushStats();
    }
  }

  private migrate(): void {
    const migrationResult = runMemoryMigrations(Memory);

    if (!migrationResult.ok) {
      this.recordMigrationError(migrationResult.reason);
      throw new Error(migrationResult.reason);
    }
  }

  private recordMigrationError(reason: string): void {
    // 迁移失败也要留下 runtime section，方便后续 tick 和控制台诊断失败原因。
    Memory.runtime = Memory.runtime || {
      bootstrapped: false,
      lastMigration: typeof Memory.version === "number" ? Memory.version : 0,
      migrationError: null
    };
    Memory.runtime.bootstrapped = false;
    Memory.runtime.migrationError = reason;
  }

  private refreshServices(): void {
    this.services = createRuntimeServices(Memory, Game);
  }

  private installCommands(): void {
    installConsoleCommands();
  }

  private detectEnvironmentBootstrap(): void {
    const services = this.requireServices();
    const environment = detectRuntimeEnvironment(Game);

    services.environment = environment;
    services.cpuAvailable = environment.cpuAvailable;
    updateRuntimeEnvironmentSummary(Memory, environment, Game.time);
    runSimBootstrap(Memory, Game, services.logger, Game.time);
  }

  private runColoniesAndProcesses(): void {
    const services = this.requireServices();
    const result = buildColonyContexts(Memory, Game, Game.time);

    for (const error of result.errors) {
      services.logger.error("kernel:colonies", error);
    }

    for (const context of result.contexts) {
      if (context.readiness === "error") {
        services.logger.error("kernel:colonies", `${context.roomName}: ${context.missingReasons.join(",")}`);
      }
    }

    const processResults = runProcessDefinitions(
      result.contexts,
      services,
      Memory,
      Game,
      Game.time,
      createDefaultProcessDefinitions()
    );

    for (const processResult of processResults) {
      if (processResult.status === "error") {
        services.logger.error("kernel:processes", `${processResult.processId}: ${processResult.message}`);
      }
    }
  }

  private runSpawning(): void {
    const services = this.requireServices();
    const result = buildColonyContexts(Memory, Game, Game.time);
    const spawnResult = runSpawnLifecycle(result.contexts, Memory, Game, Game.time);

    if (spawnResult.status === "error") {
      services.logger.error("kernel:spawning", `${spawnResult.requestId ?? "unknown"}: ${spawnResult.reason}`);
    }
  }

  private cleanup(): void {
    // cleanup 阶段只做 tick 末尾的安全收尾，不放置新的策略行为。
    cleanupDeadCreepMemory();
  }

  private flushStats(): void {
    const services = this.requireServices();

    flushRuntimeStats(Memory, services.profiler.getSamples(), services.cpuAvailable, Game.time);
    services.profiler.reset();
  }

  private requireServices(): RuntimeServices {
    if (this.services === null) {
      throw new Error("Runtime services are not initialized");
    }

    return this.services;
  }
}
