export interface CpuProvider {
  getUsed: () => number;
}

export interface ProfileSample {
  stage: string;
  duration: number;
}

/**
 * 轻量生命周期 profiler，只记录阶段 CPU delta，避免保存每 tick 历史。
 */
export class Profiler {
  private readonly cpuProvider: CpuProvider;
  private readonly activeStages: { [stageName: string]: number } = {};
  private readonly samples: ProfileSample[] = [];

  public constructor(cpuProvider: CpuProvider) {
    this.cpuProvider = cpuProvider;
  }

  public startStage(stageName: string): void {
    this.activeStages[stageName] = this.cpuProvider.getUsed();
  }

  public endStage(stageName: string): ProfileSample {
    const start = this.activeStages[stageName];
    const end = this.cpuProvider.getUsed();
    const duration = Math.max(0, end - (start === undefined ? end : start));
    const sample = { stage: stageName, duration };

    this.samples.push(sample);
    delete this.activeStages[stageName];

    return sample;
  }

  public getSamples(): ProfileSample[] {
    return [...this.samples];
  }

  public reset(): void {
    this.samples.length = 0;

    for (const stageName of Object.keys(this.activeStages)) {
      delete this.activeStages[stageName];
    }
  }
}
