type ClassConstructor = new (...args: never[]) => object;
type RegistrableFunction = (...args: never[]) => unknown;

interface ScreepsProfilerModule {
  enable: () => void;
  wrap: <T extends (...args: never[]) => unknown>(fn: T) => T;
  registerClass: (constructor: ClassConstructor, label: string) => void;
  registerObject: (object: object, label: string) => void;
  registerFN: (fn: RegistrableFunction) => void;
}

export interface DeepProfilerAdapter {
  readonly enabled: boolean;
  wrapLoop<T extends (...args: never[]) => unknown>(fn: T): T;
  registerClass(constructor: ClassConstructor, label: string): void;
  registerObject(object: object, label: string): void;
  registerFN(fn: RegistrableFunction): void;
}

export class ScreepsProfilerAdapter implements DeepProfilerAdapter {
  private didEnable = false;
  private loadedProfiler: ScreepsProfilerModule | null = null;
  public readonly enabled: boolean;

  public constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  public wrapLoop<T extends (...args: never[]) => unknown>(fn: T): T {
    if (!this.enabled) {
      return fn;
    }

    this.enableOnce();

    const profiler = this.loadProfiler();

    return profiler.wrap(fn);
  }

  public registerClass(constructor: ClassConstructor, label: string): void {
    if (this.enabled) {
      this.loadProfiler().registerClass(constructor, label);
    }
  }

  public registerObject(object: object, label: string): void {
    if (this.enabled) {
      this.loadProfiler().registerObject(object, label);
    }
  }

  public registerFN(fn: RegistrableFunction): void {
    if (this.enabled) {
      this.loadProfiler().registerFN(fn);
    }
  }

  private enableOnce(): void {
    if (this.didEnable) {
      return;
    }

    const profiler = this.loadProfiler();

    profiler.enable();
    this.didEnable = true;
  }

  private loadProfiler(): ScreepsProfilerModule {
    if (this.loadedProfiler === null) {
      // screeps-profiler 读取 Screeps 原型；只有启用深度 profiler 时才加载，保证单元测试和普通运行路径不需要 live API。
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.loadedProfiler = require("screeps-profiler") as ScreepsProfilerModule;
    }

    return this.loadedProfiler;
  }
}

export function createScreepsProfilerAdapter(enabled: boolean): DeepProfilerAdapter {
  return new ScreepsProfilerAdapter(enabled);
}
