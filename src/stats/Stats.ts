import { ProfileSample } from "profiling/Profiler";

/**
 * 将当前 tick 的 profile 样本压缩进滚动摘要，避免 Memory 持续增长。
 */
export function flushRuntimeStats(memory: Memory, samples: ProfileSample[], cpuAvailable: boolean, tick: number): void {
  memory.stats.ticks = tick;
  memory.stats.cpu.available = cpuAvailable;

  for (const profileSample of samples) {
    const previousSummary = memory.stats.cpu.stages[profileSample.stage];
    const nextSamples = (previousSummary?.samples ?? 0) + 1;
    const previousAverage = previousSummary?.average ?? 0;
    const sample = profileSample.duration;
    const nextAverage = previousAverage + (sample - previousAverage) / nextSamples;

    memory.stats.cpu.stages[profileSample.stage] = {
      last: sample,
      average: nextAverage,
      max: Math.max(previousSummary?.max ?? 0, sample),
      samples: nextSamples
    };
  }
}
