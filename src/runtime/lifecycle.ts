import { RuntimeServices, createRuntimeServices } from "runtime/services";
import { runCleanupStage } from "cleanup/lifecycle";
import { runCommandInstallStage } from "commands/lifecycle";
import { runEnvironmentBootstrapStage } from "environment/lifecycle";

// 当前精简后的生命周期阶段：服务初始化 → 命令安装 → 环境检测 → 清理。
// 后续重构阶段（build / refresh / init / run / postRun）将在此扩展。
export type LifecycleStageName =
  | "refreshServices"
  | "installCommands"
  | "detectEnvironmentBootstrap"
  | "cleanup";

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

// 生命周期阶段列表是内核的稳定契约；顺序决定依赖关系和 profiler 采样范围。
export const KERNEL_LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    // 基于 Memory 配置创建本 tick 的 logger / profiler / 环境服务。
    name: "refreshServices",
    run(context: RuntimeLifecycleContext): void {
      context.services = createRuntimeServices(context.memory, context.game);
    }
  },
  {
    // 安装或复用版本化的 Screeps 控制台命令入口 global.cmd。
    name: "installCommands",
    run: runCommandInstallStage
  },
  {
    // 检测运行环境（sim/world/private）并执行 sim 引导 guidance。
    name: "detectEnvironmentBootstrap",
    run: runEnvironmentBootstrapStage
  },
  {
    // tick 末尾清理死亡 creep 的残留 Memory。
    name: "cleanup",
    run: runCleanupStage
  }
];

export const KERNEL_STAGE_ORDER: LifecycleStageName[] = KERNEL_LIFECYCLE_STAGES.map(stage => stage.name);
