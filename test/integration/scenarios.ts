import { IntegrationScenario, IntegrationTestHelper, SimShardCapability, probeSimShardCapability as probeHelperSimShardCapability } from "./helper";

export interface OwnedRoomScenarioOptions {
  roomName?: string;
  includeCreep?: boolean;
  port?: number;
}

export type SimDegradedKind = "missingSpawn" | "missingSource" | "missingController" | "missingCreep";

export interface SimDegradedScenarioOptions {
  roomName?: string;
  degradedKind: SimDegradedKind;
  port?: number;
}

const DEFAULT_ROOM_NAME = "W0N1";

export async function createOwnedRoomScenario(options: OwnedRoomScenarioOptions = {}): Promise<IntegrationTestHelper> {
  const roomName = options.roomName ?? DEFAULT_ROOM_NAME;
  const helper = new IntegrationTestHelper(
    {
      name: "owned-room",
      roomName,
      async setup(activeHelper: IntegrationTestHelper): Promise<void> {
        await activeHelper.setupOwnedRoom(roomName, { includeCreep: options.includeCreep === true });
      }
    },
    serverOptions(options.port)
  );

  await helper.start();

  return helper;
}

export async function createSimReadyScenario(options: OwnedRoomScenarioOptions = {}): Promise<IntegrationTestHelper> {
  const roomName = options.roomName ?? DEFAULT_ROOM_NAME;
  const helper = new IntegrationTestHelper(
    {
      name: "sim-ready",
      roomName,
      shardName: "sim",
      async setup(activeHelper: IntegrationTestHelper): Promise<void> {
        await activeHelper.setupOwnedRoom(roomName, { includeCreep: true });
      }
    },
    serverOptions(options.port)
  );

  await helper.start();

  return helper;
}

export async function createSimDegradedScenario(
  options: SimDegradedScenarioOptions
): Promise<IntegrationTestHelper> {
  const roomName = options.roomName ?? DEFAULT_ROOM_NAME;
  const helper = new IntegrationTestHelper(
    {
      name: `sim-degraded-${options.degradedKind}`,
      roomName,
      shardName: "sim",
      async setup(activeHelper: IntegrationTestHelper): Promise<void> {
        await setupDegradedRoom(activeHelper, roomName, options.degradedKind);
      }
    },
    serverOptions(options.port)
  );

  await helper.start();

  return helper;
}

export async function probeSimShardCapability(): Promise<SimShardCapability> {
  const capability = await probeHelperSimShardCapability();

  if (capability.kind === "sim-shard-supported") {
    return capability;
  }

  return {
    kind: "manual-fallback-required",
    reason: capability.reason ?? "mock server did not preserve Game.shard.name === sim",
    diagnostics: capability.diagnostics
  };
}

async function setupDegradedRoom(
  helper: IntegrationTestHelper,
  roomName: string,
  degradedKind: SimDegradedKind
): Promise<void> {
  // addBot 要求 controller 存在并会自动创建 spawn；缺失矩阵在 bot 创建后精确移除对象。
  await helper.setupOwnedRoom(roomName, {
    includeCreep: degradedKind !== "missingCreep",
    includeSource: degradedKind !== "missingSource"
  });

  if (degradedKind === "missingSpawn") {
    await helper.removeRoomObjects(roomName, "spawn");
  }

  if (degradedKind === "missingController") {
    await helper.removeRoomObjects(roomName, "controller");
  }
}

function serverOptions(port?: number): { port?: number } {
  if (port === undefined) {
    return {};
  }

  return { port };
}
