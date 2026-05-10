import "memory/schema";
import { LoggerNamespace, RuntimeEnvironment } from "shared/constants/runtime";
import { Logger } from "logging/Logger";
import { detectRuntimeEnvironment } from "environment/detection";

export const SIM_BOOTSTRAP_VERSION = 1;

export interface SimBootstrapResult {
  ran: boolean;
  ready: boolean;
  guidanceCodes?: string[];
  loggedCodes?: string[];
}

interface SimGuidanceEntryState {
  message?: string;
  lastSeenTick?: number;
  lastLoggedTick?: number;
  flagName?: string;
  flagResult?: string;
  active?: boolean;
}

interface SourceDetectionResult {
  available: boolean;
  count: number;
}

interface SourceAwareRoom {
  find?: (type: FIND_SOURCES) => Source[];
  sources?: Source[];
  controller?: StructureController | null;
}

interface FlagGuidanceRoom {
  controller?: {
    pos?: {
      createFlag?: (name?: string) => ERR_NAME_EXISTS | ERR_INVALID_ARGS | string;
    };
  };
}

interface RemovableFlag {
  remove?: () => ScreepsReturnCode;
}

const FIND_SOURCES_CONSTANT = 105 as FIND_SOURCES;
const ERR_NAME_EXISTS_CODE = -3 as ERR_NAME_EXISTS;

const GuidanceMessage = {
  missingController:
    "Sim setup needs a visible controller; runtime code cannot create sources, spawns, or initial creeps.",
  missingSource:
    "Sim setup needs at least one visible source; runtime code cannot create sources, spawns, or initial creeps.",
  missingSpawn:
    "Sim setup needs at least one owned spawn; runtime code cannot create sources, spawns, or initial creeps.",
  missingCreep:
    "Sim setup has no creeps yet; runtime code cannot create sources, spawns, or initial creeps."
} as const;

const GuidanceFlagName: { [code: string]: string } = {
  "missing-controller": "lystran-sim-controller-needed",
  "missing-source": "lystran-sim-source-needed",
  "missing-spawn": "lystran-sim-spawn-needed",
  "missing-creep": "lystran-sim-creep-needed"
};

/**
 * 初始化 sim 专用 Memory 与缺失对象 guidance；不会创建 creep/source/spawn 等世界对象。
 */
export function runSimBootstrap(memory: Memory, game: Game, logger: Logger, tick: number): SimBootstrapResult {
  const metadata = detectRuntimeEnvironment(game);

  if (metadata.type !== RuntimeEnvironment.sim) {
    return { ran: false, ready: false };
  }

  const sourceDetection = detectVisibleSources(game.rooms);
  const hasController = detectVisibleController(game.rooms);
  const guidanceMessages = buildGuidanceMessages(
    hasController,
    sourceDetection,
    metadata.spawnCount,
    Object.keys(game.creeps).length
  );
  const loggedCodes = updateGuidance(memory, logger, guidanceMessages, tick);
  updateFlagGuidance(memory, game, Object.keys(guidanceMessages));
  const ready = hasController && metadata.spawnCount > 0 && sourceDetection.available && sourceDetection.count > 0;

  memory.runtime.sim.bootstrap.version = SIM_BOOTSTRAP_VERSION;
  memory.runtime.sim.bootstrap.completed = true;
  memory.runtime.sim.bootstrap.lastRunTick = tick;
  memory.runtime.sim.bootstrap.ready = ready;

  return {
    ran: true,
    ready,
    guidanceCodes: Object.keys(guidanceMessages),
    loggedCodes
  };
}

function detectVisibleController(rooms: Game["rooms"]): boolean {
  return Object.keys(rooms).some(roomName => {
    const room = rooms[roomName] as unknown as SourceAwareRoom;

    return room.controller !== undefined && room.controller !== null;
  });
}

function detectVisibleSources(rooms: Game["rooms"]): SourceDetectionResult {
  let available = false;
  let count = 0;

  Object.keys(rooms).forEach(roomName => {
    const room = rooms[roomName] as unknown as SourceAwareRoom;

    if (typeof room.find === "function") {
      available = true;
      count += room.find(FIND_SOURCES_CONSTANT).length;

      return;
    }

    if (Array.isArray(room.sources)) {
      available = true;
      count += room.sources.length;
    }
  });

  return { available, count };
}

function buildGuidanceMessages(
  hasController: boolean,
  sourceDetection: SourceDetectionResult,
  spawnCount: number,
  creepCount: number
): { [code: string]: string } {
  const messages: { [code: string]: string } = {};

  if (!hasController) {
    messages["missing-controller"] = GuidanceMessage.missingController;
  }

  if (!sourceDetection.available || sourceDetection.count === 0) {
    messages["missing-source"] = GuidanceMessage.missingSource;
  }

  if (spawnCount === 0) {
    messages["missing-spawn"] = GuidanceMessage.missingSpawn;
  }

  if (creepCount === 0) {
    messages["missing-creep"] = GuidanceMessage.missingCreep;
  }

  return messages;
}

function updateGuidance(
  memory: Memory,
  logger: Logger,
  activeMessages: { [code: string]: string },
  tick: number
): string[] {
  const guidance = memory.runtime.sim.guidance as { [code: string]: SimGuidanceEntryState };
  const loggedCodes: string[] = [];

  Object.keys(activeMessages).forEach(code => {
    const entry = guidance[code] || {};
    const shouldLog = entry.active !== true || entry.message !== activeMessages[code];

    entry.message = activeMessages[code];
    entry.lastSeenTick = tick;
    entry.active = true;

    if (shouldLog) {
      entry.lastLoggedTick = tick;
      logger.warn(LoggerNamespace.simBootstrap, activeMessages[code]);
      loggedCodes.push(code);
    }

    guidance[code] = entry;
  });

  Object.keys(guidance).forEach(code => {
    if (activeMessages[code] !== undefined) {
      return; // still active, handled above
    }

    // Always keep lastSeenTick current even for already-inactive entries
    guidance[code].lastSeenTick = tick;

    if (guidance[code].active !== true) {
      return; // already deactivated, no need to re-log
    }

    guidance[code].active = false;
    guidance[code].lastLoggedTick = tick;
    logger.info(LoggerNamespace.simBootstrap, `Resolved sim guidance: ${code}`);
    loggedCodes.push(code);
  });

  return loggedCodes;
}

function updateFlagGuidance(memory: Memory, game: Game, activeCodes: string[]): void {
  const flagPosition = findFlagGuidancePosition(game.rooms);

  Object.keys(memory.runtime.sim.guidance).forEach(code => {
    if (activeCodes.indexOf(code) >= 0) {
      return;
    }

    removeResolvedGuidanceFlag(memory, game, code);
  });

  activeCodes.forEach(code => {
    const flagName = GuidanceFlagName[code];

    if (!flagName) {
      return;
    }

    const entry = (memory.runtime.sim.guidance[code] ?? {}) as SimGuidanceEntryState;
    memory.runtime.sim.guidance[code] = entry; // ensure it is written back
    entry.flagName = flagName;

    if (entry.flagResult && entry.flagResult !== "unavailable") {
      return;
    }

    if (game.flags[flagName]) {
      entry.flagResult = "exists";
      return;
    }

    if (!flagPosition) {
      entry.flagResult = "unavailable";
      return;
    }

    const result = flagPosition.createFlag(flagName);

    if (typeof result === "string" || result === ERR_NAME_EXISTS_CODE) {
      entry.flagResult = "created";
      return;
    }

    entry.flagResult = `error:${result}`;
  });
}

function removeResolvedGuidanceFlag(memory: Memory, game: Game, code: string): void {
  const entry = memory.runtime.sim.guidance[code] as SimGuidanceEntryState;
  const flagName = entry.flagName ?? GuidanceFlagName[code];

  if (!flagName) {
    return;
  }

  const flag = game.flags[flagName] as RemovableFlag | undefined;

  if (!flag || typeof flag.remove !== "function") {
    if (entry.flagResult === "created" || entry.flagResult === "exists") {
      entry.flagResult = "resolved";
    }

    return;
  }

  const result = flag.remove();

  entry.flagName = flagName;
  entry.flagResult = result === OK ? "removed" : `remove-error:${result}`;
}

function findFlagGuidancePosition(
  rooms: Game["rooms"]
): { createFlag: (name?: string) => ERR_NAME_EXISTS | ERR_INVALID_ARGS | string } | null {
  const roomNames = Object.keys(rooms);

  for (const roomName of roomNames) {
    const room = rooms[roomName] as unknown as FlagGuidanceRoom;
    const createFlag = room.controller?.pos?.createFlag;

    if (createFlag) {
      return {
        createFlag: createFlag.bind(room.controller?.pos)
      };
    }
  }

  return null;
}
