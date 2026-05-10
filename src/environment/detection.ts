import "memory/schema";
import { RuntimeEnvironment, ShardName } from "shared/constants/runtime";

export interface RuntimeEnvironmentMetadata {
  type: RuntimeEnvironment;
  shardName: string;
  cpuAvailable: boolean;
  visibleRoomCount: number;
  ownedRoomCount: number;
  spawnCount: number;
  reason: string;
}

/**
 * 读取当前 tick 的 Screeps 全局状态，返回不持久化 live object 的环境事实。
 */
export function detectRuntimeEnvironment(game: Game): RuntimeEnvironmentMetadata {
  const shardName = game.shard.name || ShardName.unknown;
  const type = classifyRuntimeEnvironment(shardName);

  return {
    type,
    shardName,
    cpuAvailable: type !== RuntimeEnvironment.sim,
    visibleRoomCount: Object.keys(game.rooms).length,
    ownedRoomCount: countOwnedRooms(game.rooms),
    spawnCount: Object.keys(game.spawns).length,
    reason: environmentReason(type, shardName)
  };
}

/**
 * Memory 只保留 compact summary；详细房间/CPU 事实必须每 tick 重新检测。
 */
export function updateRuntimeEnvironmentSummary(
  memory: Memory,
  metadata: RuntimeEnvironmentMetadata,
  tick: number
): void {
  const current = memory.runtime.environment;
  const changed = current.type !== metadata.type || current.shard !== metadata.shardName;

  current.type = metadata.type;
  current.shard = metadata.shardName;
  current.lastSeenTick = tick;

  if (changed) {
    current.lastChangedTick = tick;
  }
}

function classifyRuntimeEnvironment(shardName: string): RuntimeEnvironment {
  if (shardName === ShardName.sim) {
    return RuntimeEnvironment.sim;
  }

  if (
    shardName === ShardName.shard0 ||
    shardName === ShardName.shard1 ||
    shardName === ShardName.shard2 ||
    shardName === ShardName.shard3
  ) {
    return RuntimeEnvironment.world;
  }

  if (shardName === ShardName.private) {
    return RuntimeEnvironment.private;
  }

  return RuntimeEnvironment.unknown;
}

function countOwnedRooms(rooms: Game["rooms"]): number {
  return Object.keys(rooms).filter(roomName => rooms[roomName].controller?.my === true).length;
}

function environmentReason(type: RuntimeEnvironment, shardName: string): string {
  switch (type) {
    case RuntimeEnvironment.sim:
      return 'Game.shard.name === "sim"';
    case RuntimeEnvironment.world:
      return `official world shard ${shardName}`;
    case RuntimeEnvironment.private:
      return "private shard";
    case RuntimeEnvironment.unknown:
      return `unrecognized shard ${shardName}`;
    default:
      return "unknown runtime environment";
  }
}
