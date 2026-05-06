import { BodyIntent, buildBody } from "spawning/bodyBuilder";
import { TaskType, TaskTypeName } from "tasks/model";
import { ColonyContext } from "colony/types";
import { ProjectMemoryShape } from "memory/schema";
import { RoleName } from "constants/roles";

export type BootstrapSlotKind = "workerFallback" | "source" | "upgrade";
export type BootstrapDemandKind = TaskTypeName | "pickup" | "transfer" | "refill";

export interface BootstrapSpawnDemand {
  kind: "spawn";
  id: string;
  role: RoleName;
  priority: number;
  body: BodyPartConstant[];
  bodyIntent: BodyIntent;
  reason: string;
}

export interface BootstrapTaskDemand {
  kind: TaskTypeName;
  targetId: string;
  priority: number;
  reason: string;
}

export interface BootstrapLogisticsDemand {
  kind: "pickup" | "transfer" | "refill";
  targetId: string | null;
  priority: number;
  reason: string;
}

export interface BootstrapSlot {
  id: string;
  kind: BootstrapSlotKind;
  roomName: string;
  priority: number;
  role: RoleName;
  spawn: BootstrapSpawnDemand | null;
  task: BootstrapTaskDemand | null;
  logistics: BootstrapLogisticsDemand[];
  blocked: string[];
}

export interface BootstrapSlotBuildResult {
  roomName: string;
  targetPopulation: number;
  slots: BootstrapSlot[];
  blocked: string[];
}

interface CreateSlotParams {
  id: string;
  kind: BootstrapSlotKind;
  roomName: string;
  priority: number;
  role: RoleName;
  spawn: BootstrapSpawnDemand | null;
  task: BootstrapTaskDemand | null;
  logistics?: BootstrapLogisticsDemand[];
  blocked?: string[];
}

/**
 * 将当前房间事实转换为稳定 bootstrap 槽位；这里保持纯计算，实际 Memory 写入由后续 demand adapter 负责。
 */
export function buildBootstrapSlots(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number
): BootstrapSlotBuildResult {
  const targetPopulation =
    context.stage.hasSpawn && context.stage.hasSource && context.stage.hasController
      ? Math.min(4, Math.max(2, context.stage.sourceCount + 1))
      : 0;
  const slots: BootstrapSlot[] = [];
  const blocked: string[] = [];

  for (let index = 0; index < Math.min(2, targetPopulation); index += 1) {
    slots.push(createWorkerFallbackSlot(context, memory, tick, index));
  }

  for (const source of [...context.sources].sort((left, right) => left.id.localeCompare(right.id))) {
    slots.push(createSourceSlot(context, memory, tick, source));
  }

  if (context.controller) {
    slots.push(createUpgradeSlot(context, memory, tick, context.controller));
  } else {
    blocked.push("missing controller: upgrade demand omitted");
  }

  if (!context.stage.hasSpawn) {
    blocked.push("missing spawn: spawn demand omitted");
  }

  if (!context.stage.hasSource) {
    blocked.push("missing source: harvest demand omitted");
  }

  slots.sort((left, right) => left.id.localeCompare(right.id));

  return {
    roomName: context.roomName,
    targetPopulation,
    slots,
    blocked
  };
}

function createWorkerFallbackSlot(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number,
  index: number
): BootstrapSlot {
  const role = RoleName.worker;
  const id = `workerFallback:${context.roomName}:${index}`;

  return createSlot({
    id,
    kind: "workerFallback",
    roomName: context.roomName,
    priority: 100 + index,
    role,
    spawn: createSpawnDemand(context, memory, tick, id, role, "balanced", 100 + index, "bootstrap worker fallback"),
    task: null
  });
}

function createSourceSlot(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number,
  source: Source
): BootstrapSlot {
  const sourceIndex = sortedSourceIds(context).indexOf(source.id);
  const role = context.stage.creepCount + sourceIndex < 2 ? RoleName.worker : RoleName.harvester;
  const id = `source:${source.id}:0`;

  return createSlot({
    id,
    kind: "source",
    roomName: context.roomName,
    priority: 20 + sourceIndex,
    role,
    spawn: createSpawnDemand(context, memory, tick, id, role, "harvest", 20 + sourceIndex, `harvest source ${source.id}`),
    task: {
      kind: TaskType.harvest,
      targetId: source.id,
      priority: 20 + sourceIndex,
      reason: `harvest source ${source.id}`
    },
    logistics: [
      {
        kind: "pickup",
        targetId: source.id,
        priority: 120 + sourceIndex,
        reason: `future pickup near ${source.id}`
      }
    ]
  });
}

function createUpgradeSlot(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number,
  controller: StructureController
): BootstrapSlot {
  const id = `upgrade:${controller.id}:0`;
  const role = context.stage.creepCount < 2 ? RoleName.worker : RoleName.upgrader;

  return createSlot({
    id,
    kind: "upgrade",
    roomName: context.roomName,
    priority: 40,
    role,
    spawn: createSpawnDemand(context, memory, tick, id, role, "upgrade", 40, `upgrade controller ${controller.id}`),
    task: {
      kind: TaskType.upgrade,
      targetId: controller.id,
      priority: 40,
      reason: `upgrade controller ${controller.id}`
    },
    logistics: [
      {
        kind: "transfer",
        targetId: controller.id,
        priority: 130,
        reason: `future transfer near ${controller.id}`
      },
      {
        kind: "refill",
        targetId: context.spawns[0]?.id ?? null,
        priority: 140,
        reason: "future spawn refill"
      }
    ]
  });
}

function createSpawnDemand(
  context: ColonyContext,
  memory: ProjectMemoryShape,
  tick: number,
  slotId: string,
  role: RoleName,
  bodyIntent: BodyIntent,
  priority: number,
  reason: string
): BootstrapSpawnDemand | null {
  void memory;
  void tick;

  // 缺少 spawn 只阻断生成新 creep，已有 creep 的 harvest/upgrade 槽位仍然可以继续执行。
  if (!context.stage.hasSpawn) {
    return null;
  }

  const body = buildBody({
    role,
    intent: bodyIntent,
    energyBudget: context.energy.spawnCapacity
  });

  if (!body.ok) {
    return null;
  }

  return {
    kind: "spawn",
    id: slotId,
    role,
    priority,
    body: body.body,
    bodyIntent,
    reason
  };
}

function createSlot(params: CreateSlotParams): BootstrapSlot {
  const blocked = params.blocked ? [...params.blocked] : [];

  if (params.spawn === null) {
    blocked.push("spawn demand unavailable");
  }

  if (params.task === null && params.kind !== "workerFallback") {
    blocked.push("task demand unavailable");
  }

  return {
    id: params.id,
    kind: params.kind,
    roomName: params.roomName,
    priority: params.priority,
    role: params.role,
    spawn: params.spawn,
    task: params.task,
    logistics: params.logistics ?? [],
    blocked
  };
}

function sortedSourceIds(context: ColonyContext): string[] {
  return context.sources.map(source => source.id).sort((left, right) => left.localeCompare(right));
}
