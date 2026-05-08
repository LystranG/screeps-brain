import { RuntimeLifecycleContext } from "runtime/lifecycle";
import { runMemoryMigrations } from "memory/migrations";

/**
 * 执行 Memory schema 迁移；失败时留下 runtime 诊断，避免后续阶段读取不可信结构。
 */
export function runMemoryMigrationStage(context: RuntimeLifecycleContext): void {
  const migrationResult = runMemoryMigrations(context.memory);

  if (!migrationResult.ok) {
    recordMigrationError(context.memory, migrationResult.reason);
    throw new Error(migrationResult.reason);
  }
}

function recordMigrationError(memory: Memory, reason: string): void {
  memory.runtime = memory.runtime || {
    bootstrapped: false,
    lastMigration: typeof memory.version === "number" ? memory.version : 0,
    migrationError: null
  };
  memory.runtime.bootstrapped = false;
  memory.runtime.migrationError = reason;
}
