import { ColonyIntelMemory, ColonyMemory, createDefaultStrategyPlanMemory } from "memory/schema";
import { VolatileRoomIntel } from "colony/types";

export function buildVolatileRoomIntel(room: Room, game: Game): VolatileRoomIntel {
  const spawns = room.find(FIND_MY_SPAWNS);
  const sources = room.find(FIND_SOURCES);
  const creeps = room.find(FIND_MY_CREEPS);
  const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  return {
    roomName: room.name,
    spawns,
    sources,
    creeps,
    constructionSites,
    hostiles,
    controller: room.controller ?? null,
    energy: {
      available: room.energyAvailable,
      capacity: room.energyCapacityAvailable,
      spawnCapacity: room.energyCapacityAvailable
    },
    scannedTick: game.time
  };
}

/**
 * 只比较低频事实；lastSeen/lastRefresh 由写入节流控制，不能单独触发 Memory churn。
 */
export function shouldPersistIntel(
  previous: ColonyIntelMemory | undefined,
  next: ColonyIntelMemory,
  tick: number,
  cadence: number
): boolean {
  if (previous === undefined) {
    return true;
  }

  if (tick - previous.lastRefreshTick >= cadence) {
    return true;
  }

  return stableIntelSignature(previous) !== stableIntelSignature(next);
}

export function persistColonyIntel(
  memory: Memory,
  roomName: string,
  next: ColonyIntelMemory,
  tick: number
): boolean {
  const previous = memory.colonies[roomName]?.intel;
  const cadence = memory.config.colony.intelRefreshCadence;

  if (!shouldPersistIntel(previous, next, tick, cadence)) {
    return false;
  }

  const previousColony = memory.colonies[roomName];
  const colony: ColonyMemory = {
    roomName,
    primary: next.primary,
    status: next.status,
    intel: next,
    spawnQueue: previousColony?.spawnQueue ?? [],
    strategy: previousColony?.strategy ?? createDefaultStrategyPlanMemory(roomName, "intel")
  };

  memory.colonies[roomName] = colony;

  return true;
}

function stableIntelSignature(intel: ColonyIntelMemory): string {
  return JSON.stringify({
    roomName: intel.roomName,
    status: intel.status,
    missingReasons: intel.missingReasons,
    controllerId: intel.controllerId,
    rcl: intel.rcl,
    sourceIds: intel.sourceIds,
    spawnIds: intel.spawnIds,
    primary: intel.primary,
    stage: intel.stage
  });
}
