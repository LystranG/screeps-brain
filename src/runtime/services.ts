import { Logger, LoggerConfig } from "logging/Logger";
import { ObservabilityConfigMemory } from "memory/schema";
import { Profiler } from "profiling/Profiler";
import { RuntimeEnvironmentMetadata } from "environment/detection";
import { ShardName } from "shared/constants/runtime";

// 每 tick 创建的运行时服务包，避免业务模块直接读取 Memory 或 Screeps 全局。
export interface RuntimeServices {
  logger: Logger;
  profiler: Profiler;
  cpuAvailable: boolean;
  environment: RuntimeEnvironmentMetadata | null;
}

/**
 * 从已初始化的 Memory 和当前 Game 构建本 tick 的服务实例。
 * sim 环境下 CPU 标记为不可用（Game.cpu.getUsed() 在 sim 返回 0）。
 */
export function createRuntimeServices(memory: Memory, game: Game): RuntimeServices {
  const observabilityConfig = memory.config?.observability;

  return {
    logger: new Logger(createLoggerConfig(observabilityConfig), () => game.time),
    profiler: new Profiler(game.cpu),
    cpuAvailable: game.shard.name !== ShardName.sim,
    environment: null
  };
}

function createLoggerConfig(config?: ObservabilityConfigMemory): LoggerConfig {
  if (!config) {
    return {};
  }

  const enabledNamespaces: LoggerConfig["enabledNamespaces"] = {};

  Object.keys(config.enabledNamespaces).forEach(namespace => {
    enabledNamespaces[namespace] = config.enabledNamespaces[namespace]?.enabled;
  });

  return {
    logLevel: config.logLevel,
    enabledNamespaces,
    namespaceSampling: config.namespaceSampling
  };
}
