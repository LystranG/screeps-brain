import { RuntimeLifecycleContext } from "runtime/lifecycle";
import { flushRuntimeStats } from "stats/Stats";

/**
 * 将 profiler 样本落入滚动统计，并重置本 tick 的临时采样。
 */
export function runStatsFlushStage(context: RuntimeLifecycleContext): void {
  const services = context.requireServices();

  flushRuntimeStats(context.memory, services.profiler.getSamples(), services.cpuAvailable, context.tick);
  services.profiler.reset();
}
