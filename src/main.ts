import { ErrorMapper } from "utils/ErrorMapper";
import { Kernel } from "runtime/Kernel";
import { createScreepsProfilerAdapter } from "profiling/ScreepsProfilerAdapter";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const kernel = new Kernel();

export const loop = ErrorMapper.wrapLoop(() => {
  const deepProfiler = createScreepsProfilerAdapter(Memory.config?.observability?.deepProfiler?.enabled === true);

  // 入口只负责触发内核，深度 profiler 也必须留在 ErrorMapper 边界内。
  deepProfiler.wrapLoop(() => kernel.run())();
});
