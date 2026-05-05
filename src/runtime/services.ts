import { Logger, LoggerConfig } from "logging/Logger";
import { ObservabilityConfigMemory } from "memory/schema";
import { Profiler } from "profiling/Profiler";
import { RuntimeEnvironmentMetadata } from "environment/detection";
import { ShardName } from "constants/runtime";

export interface RuntimeServices {
  logger: Logger;
  profiler: Profiler;
  cpuAvailable: boolean;
  environment: RuntimeEnvironmentMetadata | null;
}

/**
 * 每 tick 创建一次 runtime services，避免普通模块直接读取 Memory 或 Screeps profiler 细节。
 */
export function createRuntimeServices(memory: Memory, game: Game): RuntimeServices {
  const observabilityConfig = memory.config.observability;

  return {
    logger: new Logger(createLoggerConfig(observabilityConfig), () => game.time),
    profiler: new Profiler(game.cpu),
    cpuAvailable: game.shard.name !== ShardName.sim,
    environment: null
  };
}

function createLoggerConfig(config: ObservabilityConfigMemory): LoggerConfig {
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
