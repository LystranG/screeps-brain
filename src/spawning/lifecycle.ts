import { RuntimeLifecycleContext } from "runtime/lifecycle";
import { buildColonyContexts } from "colony/context";
import { runSpawnLifecycle } from "spawning/runner";

/**
 * 执行 spawn queue 生命周期；上下文重建和错误日志都由 spawning 模块入口封装。
 */
export function runSpawningStage(context: RuntimeLifecycleContext): void {
  const services = context.requireServices();
  const result = buildColonyContexts(context.memory, context.game, context.tick);
  const spawnResult = runSpawnLifecycle(result.contexts, context.memory, context.game, context.tick);

  if (spawnResult.status === "error") {
    services.logger.error("kernel:spawning", `${spawnResult.requestId ?? "unknown"}: ${spawnResult.reason}`);
  }
}
