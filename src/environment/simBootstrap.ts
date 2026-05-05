import { Logger } from "logging/Logger";
import { LoggerNamespace, RuntimeEnvironment } from "constants/runtime";
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
  active?: boolean;
}

interface SourceDetectionResult {
  available: boolean;
  count: number;
}

interface SourceAwareRoom {
  find?: (type: FIND_SOURCES) => Source[];
  sources?: Source[];
}

const FIND_SOURCES_CONSTANT = 105 as FIND_SOURCES;

const GuidanceMessage = {
  missingSource: "Sim setup needs at least one visible source; normal bot runtime cannot create sources.",
  missingSpawn: "Sim setup needs at least one owned spawn; normal bot runtime cannot create spawn structures.",
  missingCreep: "Sim setup has no creeps yet; create an initial worker or let a prepared sim seed provide one."
} as const;

/**
 * 初始化 sim 专用 Memory 与缺失对象 guidance；不会创建 creep/source/spawn 等世界对象。
 */
export function runSimBootstrap(memory: Memory, game: Game, logger: Logger, tick: number): SimBootstrapResult {
  const metadata = detectRuntimeEnvironment(game);

  if (metadata.type !== RuntimeEnvironment.sim) {
    return { ran: false, ready: false };
  }

  const sourceDetection = detectVisibleSources(game.rooms);
  const guidanceMessages = buildGuidanceMessages(sourceDetection, metadata.spawnCount, Object.keys(game.creeps).length);
  const loggedCodes = updateGuidance(memory, logger, guidanceMessages, tick);
  const ready = metadata.spawnCount > 0 && sourceDetection.available && sourceDetection.count > 0;

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
  sourceDetection: SourceDetectionResult,
  spawnCount: number,
  creepCount: number
): { [code: string]: string } {
  const messages: { [code: string]: string } = {};

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
    if (activeMessages[code] !== undefined || guidance[code].active !== true) {
      return;
    }

    guidance[code].active = false;
    guidance[code].lastSeenTick = tick;
    guidance[code].lastLoggedTick = tick;
    logger.info(LoggerNamespace.simBootstrap, `Resolved sim guidance: ${code}`);
    loggedCodes.push(code);
  });

  return loggedCodes;
}
