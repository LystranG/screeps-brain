import { RuntimeEnvironment, ShardName } from "constants/runtime";
import { ValidationResult } from "validation/results";

const shardNames = Object.values(ShardName) as string[];
const runtimeEnvironments = Object.values(RuntimeEnvironment) as string[];

export function validateShardName(value: string): ValidationResult<ShardName> {
  const shardName = value.trim();

  if (shardNames.includes(shardName)) {
    return { ok: true, value: shardName as ShardName };
  }

  return { ok: false, reason: `Shard name must be one of: ${shardNames.join(", ")}` };
}

export function validateRuntimeEnvironment(value: string): ValidationResult<RuntimeEnvironment> {
  const environment = value.trim();

  if (runtimeEnvironments.includes(environment)) {
    return { ok: true, value: environment as RuntimeEnvironment };
  }

  return { ok: false, reason: `Runtime environment must be one of: ${runtimeEnvironments.join(", ")}` };
}
