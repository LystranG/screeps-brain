import { detectRuntimeEnvironment, updateRuntimeEnvironmentSummary } from "environment/detection";
import { RuntimeLifecycleContext } from "runtime/lifecycle";
import { runSimBootstrap } from "environment/simBootstrap";

/**
 * 刷新当前 tick 环境事实，并把 sim 引导逻辑限制在环境模块入口内。
 */
export function runEnvironmentBootstrapStage(context: RuntimeLifecycleContext): void {
  const services = context.requireServices();
  const environment = detectRuntimeEnvironment(context.game);

  services.environment = environment;
  services.cpuAvailable = environment.cpuAvailable;
  updateRuntimeEnvironmentSummary(context.memory, environment, context.tick);
  runSimBootstrap(context.memory, context.game, services.logger, context.tick);
}
