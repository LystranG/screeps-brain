import { ColonyIntelMemory } from "memory/schema";

export type ColonyReadiness = "ready" | "degraded" | "error";

export interface ColonyEnergyState {
  available: number;
  capacity: number;
  spawnCapacity: number;
}

export interface ColonyStageSummary {
  rcl: number | null;
  spawnCount: number;
  sourceCount: number;
  creepCount: number;
  constructionSiteCount: number;
  hostileCount: number;
  hasSpawn: boolean;
  hasSource: boolean;
  hasController: boolean;
  defense: "clear" | "hostiles";
}

export interface VolatileRoomIntel {
  roomName: string;
  spawns: StructureSpawn[];
  sources: Source[];
  creeps: Creep[];
  constructionSites: ConstructionSite[];
  hostiles: Creep[];
  controller: StructureController | null;
  energy: ColonyEnergyState;
  scannedTick: number;
}

export interface ColonyContext {
  roomName: string;
  primary: boolean;
  readiness: ColonyReadiness;
  missingReasons: string[];
  room: Room;
  controller: StructureController | null;
  spawns: StructureSpawn[];
  sources: Source[];
  creeps: Creep[];
  constructionSites: ConstructionSite[];
  hostiles: Creep[];
  energy: ColonyEnergyState;
  stage: ColonyStageSummary;
  intel: VolatileRoomIntel;
  persistentIntel?: ColonyIntelMemory;
}

export interface BuildColonyContextResult {
  contexts: ColonyContext[];
  primaryRoomName: string | null;
  errors: string[];
}
