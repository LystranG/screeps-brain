import { RuntimeServices, createRuntimeServices } from "runtime/services";
import { runEnvironmentBootstrapStage } from "environment/lifecycle";

// 当前 v2.0 骨架生命周期：服务初始化 → 环境检测。HighCommand 将在 Phase 9 作为新阶段接入。
export type LifecycleStageName =
  | "refreshServices"
  | "detectEnvironmentBootstrap";

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
    // 检测运行环境（sim/world/private）并执行 sim 引导 guidance。
    name: "detectEnvironmentBootstrap",
    run: runEnvironmentBootstrapStage
  }
];

export const KERNEL_STAGE_ORDER: LifecycleStageName[] = KERNEL_LIFECYCLE_STAGES.map(stage => stage.name);
