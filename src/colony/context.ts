import { buildVolatileRoomIntel, persistColonyIntel } from "colony/intel";
import {
  BuildColonyContextResult,
  ColonyContext,
  ColonyReadiness,
  ColonyStageSummary,
  VolatileRoomIntel
} from "colony/types";
import { ColonyIntelMemory } from "memory/schema";

export interface BuildColonyContextsOptions {
  persistPrimary?: boolean;
  persistIntel?: boolean;
}

const DEFAULT_BUILD_OPTIONS: Required<BuildColonyContextsOptions> = {
  persistPrimary: true,
  persistIntel: true
};

export function buildColonyContexts(
  memory: Memory,
  game: Game,
  tick: number,
  options: BuildColonyContextsOptions = DEFAULT_BUILD_OPTIONS
): BuildColonyContextResult {
  const resolvedOptions = {
    ...DEFAULT_BUILD_OPTIONS,
    ...options
  };
  const candidateRooms = discoverCandidateRooms(game);
  const primaryRoomName = selectPrimaryRoomName(memory, candidateRooms);
  const errors: string[] = [];

  if (memory.config.colony.primaryRoomName === null && primaryRoomName !== null && resolvedOptions.persistPrimary) {
    memory.config.colony.primaryRoomName = primaryRoomName;
  }

  const contexts = candidateRooms
    .map(room => buildSingleColonyContext(memory, game, room, tick, room.name === primaryRoomName, resolvedOptions, errors))
    .sort(compareContexts);

  return {
    contexts,
    primaryRoomName,
    errors
  };
}

function discoverCandidateRooms(game: Game): Room[] {
  const visibleRooms = Object.keys(game.rooms)
    .sort()
    .map(roomName => game.rooms[roomName]);
  const ownedRooms = visibleRooms.filter(room => room.controller?.my === true);

  if (game.shard.name === "sim") {
    return visibleRooms;
  }

  return ownedRooms;
}

function selectPrimaryRoomName(memory: Memory, candidateRooms: Room[]): string | null {
  const candidateRoomNames = candidateRooms.map(room => room.name).sort();
  const configuredPrimary = memory.config.colony.primaryRoomName;

  if (configuredPrimary !== null && candidateRoomNames.indexOf(configuredPrimary) >= 0) {
    return configuredPrimary;
  }

  return candidateRoomNames[0] ?? null;
}

function buildSingleColonyContext(
  memory: Memory,
  game: Game,
  room: Room,
  tick: number,
  primary: boolean,
  options: Required<BuildColonyContextsOptions>,
  errors: string[]
): ColonyContext {
  try {
    const intel = buildVolatileRoomIntel(room, game);
    const missingReasons = getMissingReasons(intel);
    const readiness = getReadiness(missingReasons);
    const stage = buildStageSummary(intel);
    const persistentIntel = buildPersistentIntel(intel, primary, readiness, missingReasons, stage, tick);

    if (options.persistIntel) {
      persistColonyIntel(memory, room.name, persistentIntel, tick);
    }

    return {
      roomName: room.name,
      primary,
      readiness,
      missingReasons,
      room,
      controller: intel.controller,
      spawns: intel.spawns,
      sources: intel.sources,
      creeps: intel.creeps,
      constructionSites: intel.constructionSites,
      hostiles: intel.hostiles,
      energy: intel.energy,
      stage,
      intel,
      persistentIntel
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown colony context error";
    const missingReasons = [`context error: ${reason}`];
    errors.push(`${room.name}: ${reason}`);

    return buildErrorContext(room, game, primary, missingReasons);
  }
}

function getMissingReasons(intel: VolatileRoomIntel): string[] {
  const missingReasons: string[] = [];

  if (intel.controller === null) {
    missingReasons.push("missing controller");
  }

  if (intel.spawns.length === 0) {
    missingReasons.push("missing spawn");
  }

  if (intel.sources.length === 0) {
    missingReasons.push("missing source");
  }

  return missingReasons;
}

function getReadiness(missingReasons: string[]): ColonyReadiness {
  return missingReasons.length === 0 ? "ready" : "degraded";
}

function buildStageSummary(intel: VolatileRoomIntel): ColonyStageSummary {
  return {
    rcl: intel.controller?.level ?? null,
    spawnCount: intel.spawns.length,
    sourceCount: intel.sources.length,
    creepCount: intel.creeps.length,
    constructionSiteCount: intel.constructionSites.length,
    hostileCount: intel.hostiles.length,
    hasSpawn: intel.spawns.length > 0,
    hasSource: intel.sources.length > 0,
    hasController: intel.controller !== null,
    defense: intel.hostiles.length > 0 ? "hostiles" : "clear"
  };
}

function buildPersistentIntel(
  intel: VolatileRoomIntel,
  primary: boolean,
  readiness: ColonyReadiness,
  missingReasons: string[],
  stage: ColonyStageSummary,
  tick: number
): ColonyIntelMemory {
  return {
    roomName: intel.roomName,
    lastSeenTick: tick,
    lastRefreshTick: tick,
    status: readiness,
    missingReasons,
    controllerId: intel.controller?.id ?? null,
    rcl: stage.rcl,
    sourceIds: intel.sources.map(source => source.id),
    spawnIds: intel.spawns.map(spawn => spawn.id),
    primary,
    stage: stage.rcl === null ? "unknown" : `rcl${stage.rcl}`
  };
}

function buildErrorContext(room: Room, game: Game, primary: boolean, missingReasons: string[]): ColonyContext {
  const intel: VolatileRoomIntel = {
    roomName: room.name,
    spawns: [],
    sources: [],
    creeps: [],
    constructionSites: [],
    hostiles: [],
    controller: room.controller ?? null,
    energy: {
      available: room.energyAvailable ?? 0,
      capacity: room.energyCapacityAvailable ?? 0,
      spawnCapacity: room.energyCapacityAvailable ?? 0
    },
    scannedTick: game.time
  };

  return {
    roomName: room.name,
    primary,
    readiness: "error",
    missingReasons,
    room,
    controller: intel.controller,
    spawns: [],
    sources: [],
    creeps: [],
    constructionSites: [],
    hostiles: [],
    energy: intel.energy,
    stage: buildStageSummary(intel),
    intel
  };
}

function compareContexts(left: ColonyContext, right: ColonyContext): number {
  if (left.primary !== right.primary) {
    return left.primary ? -1 : 1;
  }

  return left.roomName.localeCompare(right.roomName);
}
