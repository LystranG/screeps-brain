import { createDefaultProcessDefinitions, runProcessDefinitions } from "processes/runner";
import { RuntimeLifecycleContext } from "runtime/lifecycle";
import { buildColonyContexts } from "colony/context";

/**
 * 构建 colony context 并运行进程定义；Kernel 不关心具体进程和 colony 诊断细节。
 */
export function runColonyProcessStage(context: RuntimeLifecycleContext): void {
  const services = context.requireServices();
  const result = buildColonyContexts(context.memory, context.game, context.tick);

  for (const error of result.errors) {
    services.logger.error("kernel:colonies", error);
  }

  for (const colony of result.contexts) {
    if (colony.readiness === "error") {
      services.logger.error("kernel:colonies", `${colony.roomName}: ${colony.missingReasons.join(",")}`);
    }
  }

  const processResults = runProcessDefinitions(
    result.contexts,
    services,
    context.memory,
    context.game,
    context.tick,
    createDefaultProcessDefinitions()
  );

  for (const processResult of processResults) {
    if (processResult.status === "error") {
      services.logger.error("kernel:processes", `${processResult.processId}: ${processResult.message}`);
    }
  }
}
