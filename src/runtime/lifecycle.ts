import { RuntimeServices, createRuntimeServices } from "runtime/services";
import { runCleanupStage } from "cleanup/lifecycle";
import { runColonyProcessStage } from "processes/lifecycle";
import { runCommandInstallStage } from "commands/lifecycle";
import { runEnvironmentBootstrapStage } from "environment/lifecycle";
import { runMemoryMigrationStage } from "memory/lifecycle";
import { runSpawningStage } from "spawning/lifecycle";
import { runStatsFlushStage } from "stats/lifecycle";

export type LifecycleStageName =
  | "migrate"
  | "refreshServices"
  | "installCommands"
  | "detectEnvironmentBootstrap"
  | "runColoniesAndProcesses"
  | "runSpawning"
  | "cleanup"
  | "flushStats";

export interface RuntimeLifecycleContext {
  memory: Memory;
  game: Game;
  tick: number;
  services: RuntimeServices | null;
  requireServices(): RuntimeServices;
}

export interface LifecycleStage {
  name: LifecycleStageName;
  run: (context: RuntimeLifecycleContext) => void;
}

// 生命周期对象列表是内核的稳定契约，后续阶段只能在这里显式调整。
// migrate 必须排第一位：后续阶段都默认 Memory 已经迁移到当前 schema。
export const KERNEL_LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    // 修复和升级持久 Memory；失败时 Kernel 会阻断后续阶段，避免坏 schema 扩散。
    name: "migrate",
    run: runMemoryMigrationStage
  },
  {
    // 基于已迁移 Memory 创建本 tick 的 runtime services，后续阶段通过 context 共享。
    name: "refreshServices",
    run(context: RuntimeLifecycleContext): void {
      context.services = createRuntimeServices(context.memory, context.game);
    }
  },
  {
    // 安装或复用 Screeps 控制台命令入口；命令树版本控制留在 commands 模块内。
    name: "installCommands",
    run: runCommandInstallStage
  },
  {
    // 刷新环境事实并处理 sim bootstrap guidance；不把环境细节泄漏进 Kernel。
    name: "detectEnvironmentBootstrap",
    run: runEnvironmentBootstrapStage
  },
  {
    // 构建 colony context 并运行进程定义；策略、任务和角色分发由各模块入口负责。
    name: "runColoniesAndProcesses",
    run: runColonyProcessStage
  },
  {
    // 消费 spawn queue 生命周期；真实 spawn 调用和错误解释保持在 spawning 模块。
    name: "runSpawning",
    run: runSpawningStage
  },
  {
    // tick 末尾安全收尾，目前只清理死亡 creep 的残留 Memory。
    name: "cleanup",
    run: runCleanupStage
  },
  {
    // 最后写入 CPU/stats 汇总并重置 profiler；它是汇总器，不参与本轮 profile。
    name: "flushStats",
    run: runStatsFlushStage
  }
];

export const KERNEL_STAGE_ORDER: LifecycleStageName[] = KERNEL_LIFECYCLE_STAGES.map(stage => stage.name);
