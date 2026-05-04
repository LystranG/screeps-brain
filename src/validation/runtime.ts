import { RuntimeEnvironment, ShardName } from "constants/runtime";
import { ValidationResult } from "validation/results";

const shardNames = Object.values(ShardName) as string[];
const runtimeEnvironments = Object.values(RuntimeEnvironment) as string[];

/**
 * 校验 shard 名称来自集中常量，避免后续环境判断散落硬编码字符串。
 */
export function validateShardName(value: string): ValidationResult<ShardName> {
  const shardName = value.trim();

  if (shardNames.includes(shardName)) {
    return { ok: true, value: shardName as ShardName };
  }

  return { ok: false, reason: `Shard name must be one of: ${shardNames.join(", ")}` };
}

/**
 * 校验运行环境枚举，供 sim/world/private 等环境检测结果复用。
 */
export function validateRuntimeEnvironment(value: string): ValidationResult<RuntimeEnvironment> {
  const environment = value.trim();

  if (runtimeEnvironments.includes(environment)) {
    return { ok: true, value: environment as RuntimeEnvironment };
  }

  return { ok: false, reason: `Runtime environment must be one of: ${runtimeEnvironments.join(", ")}` };
}
