// Screeps 运行时入口：ErrorMapper 提供源码映射，Kernel 驱动 tick 生命周期。
import { ErrorMapper } from "utils/ErrorMapper";
import { Kernel } from "runtime/Kernel";
import { createScreepsProfilerAdapter } from "profiling/ScreepsProfilerAdapter";

const kernel = new Kernel();

export const loop = ErrorMapper.wrapLoop(() => {
  // 深度 profiler 按 Memory 配置懒加载，默认关闭不影响正常 CPU 开销。
  const deepProfiler = createScreepsProfilerAdapter(Memory.config?.observability?.deepProfiler?.enabled === true);

  deepProfiler.wrapLoop(() => kernel.run())();
});
