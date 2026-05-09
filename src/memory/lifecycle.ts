import { RuntimeLifecycleContext } from "runtime/lifecycle";
import { runMemoryMigrations } from "memory/migrations";

/**
 * 前期只初始化当前 Memory 骨架；历史 schema 迁移等真实环境稳定后再恢复。
 */
export function runMemoryMigrationStage(context: RuntimeLifecycleContext): void {
  runMemoryMigrations(context.memory);
}
