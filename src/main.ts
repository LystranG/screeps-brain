import { ErrorMapper } from "utils/ErrorMapper";
import { Kernel } from "runtime/Kernel";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const kernel = new Kernel();

export const loop = ErrorMapper.wrapLoop(() => {
  // 入口只负责触发内核，具体 tick 行为由生命周期阶段承载。
  kernel.run();
});
