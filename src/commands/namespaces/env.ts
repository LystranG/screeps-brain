import { CommandNamespaceDefinition, CommandResult } from "commands/types";
import { CommandEffect, CommandPath } from "constants/commands";
import { detectRuntimeEnvironment } from "environment/detection";

export function createEnvNamespace(): CommandNamespaceDefinition {
  return {
    name: CommandPath.env,
    summary: "Environment inspection commands",
    effect: CommandEffect.readOnly,
    commands: [
      {
        name: "status",
        signature: "cmd.env.status()",
        description: "Show current runtime environment metadata.",
        effect: CommandEffect.readOnly,
        run: (_args, context): CommandResult => {
          // 环境事实来自当前 tick 的 Game 对象，避免把 live object 写入持久 Memory。
          const metadata = detectRuntimeEnvironment(context.game);
          const fields = [
            `type=${metadata.type}`,
            `shard=${metadata.shardName}`,
            `visibleRooms=${metadata.visibleRoomCount}`,
            `ownedRooms=${metadata.ownedRoomCount}`,
            `spawns=${metadata.spawnCount}`,
            `cpuAvailable=${metadata.cpuAvailable}`,
            `reason=${metadata.reason}`
          ];

          return {
            ok: true,
            status: "OK",
            message: `env status: ${fields.join(" ")}`,
            effect: CommandEffect.readOnly
          };
        }
      }
    ]
  };
}
