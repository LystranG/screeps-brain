import { readFileSync } from "fs";

const { ScreepsServer, stdHooks } = require("screeps-server-mockup");

export const DIST_MAIN_JS = "dist/main.js";

export interface ScenarioDiagnostics {
  label: string;
  gameTime: number | null;
  recentConsole: string[];
  recentServer: string[];
}

export interface IntegrationScenario {
  name: string;
  roomName: string;
  shardName?: string;
  setup(helper: IntegrationTestHelper): Promise<void>;
}

export interface SimShardCapability {
  kind: "sim-shard-supported" | "manual-fallback-required";
  reason?: string;
  diagnostics?: ScenarioDiagnostics;
}

interface ConsoleEntry {
  type: "log" | "result" | "server";
  message: string;
}

interface ServerOptions {
  path?: string;
  logdir?: string;
  port?: number;
}

const DEFAULT_ROOM_NAME = "W0N1";
const RECENT_DIAGNOSTIC_LIMIT = 40;
let stdHooksInstalled = false;

export class IntegrationTestHelper {
  public readonly roomName: string;

  private readonly scenario: IntegrationScenario;
  private readonly serverOptions: ServerOptions;
  private consoleEntries: ConsoleEntry[] = [];
  private _server: any;
  private _player: any;

  public constructor(scenario?: IntegrationScenario, serverOptions: ServerOptions = {}) {
    this.scenario =
      scenario ??
      {
        name: "default-owned-room",
        roomName: DEFAULT_ROOM_NAME,
        async setup(helper: IntegrationTestHelper): Promise<void> {
          await helper.setupOwnedRoom(DEFAULT_ROOM_NAME);
        }
      };
    this.roomName = this.scenario.roomName;
    this.serverOptions = serverOptions;
  }

  public get server(): any {
    return this._server;
  }

  public get player(): any {
    return this._player;
  }

  public async start(): Promise<void> {
    installStdHooksOnce();
    this.consoleEntries = [];
    this._server = new ScreepsServer(this.serverOptions);
    this.captureServerEvents();
    await this._server.world.reset();
    await this.scenario.setup(this);

    if (this.scenario.shardName !== undefined) {
      this.configureShardName(this.scenario.shardName);
    }

    await this._server.start();
  }

  public async close(): Promise<void> {
    if (this._server === undefined) {
      return;
    }

    await Promise.resolve(this._server.stop());
    this._server = undefined;
    this._player = undefined;
  }

  public async tick(count = 1): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await this._server.tick();
    }
  }

  public async tickUntil(predicate: () => Promise<boolean> | boolean, maxTicks: number, label: string): Promise<void> {
    for (let index = 0; index < maxTicks; index += 1) {
      if (await predicate()) {
        return;
      }

      await this.tick();
    }

    throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(await this.diagnostics(label))}`);
  }

  public async readMemory(): Promise<Memory> {
    const memory = await this._player.memory;

    return JSON.parse(memory) as Memory;
  }

  public async runCommand(command: string): Promise<string> {
    const beforeCount = this.consoleEntries.length;
    await this._player.console(command);
    await this.tick();

    return this.consoleEntries
      .slice(beforeCount)
      .filter(entry => entry.type !== "server")
      .map(entry => entry.message)
      .join("\n");
  }

  public async diagnostics(label: string): Promise<ScenarioDiagnostics> {
    return {
      label,
      gameTime: await this.readGameTime(),
      recentConsole: this.consoleEntries
        .filter(entry => entry.type !== "server")
        .slice(-RECENT_DIAGNOSTIC_LIMIT)
        .map(entry => `[${entry.type}] ${entry.message}`),
      recentServer: this.consoleEntries
        .filter(entry => entry.type === "server")
        .slice(-RECENT_DIAGNOSTIC_LIMIT)
        .map(entry => entry.message)
    };
  }

  public async probeSimShardCapability(): Promise<SimShardCapability> {
    try {
      const output = await this.runCommand("cmd.env.status()");
      const memory = await this.readMemory();

      if (output.indexOf("shard=sim") >= 0 || memory.runtime.environment.shard === "sim") {
        return { kind: "sim-shard-supported", diagnostics: await this.diagnostics("sim shard probe") };
      }

      return {
        kind: "manual-fallback-required",
        reason: `mock server reported ${output || memory.runtime.environment.shard}`,
        diagnostics: await this.diagnostics("sim shard probe")
      };
    } catch (error) {
      return {
        kind: "manual-fallback-required",
        reason: error instanceof Error ? error.message : "unknown sim shard probe failure",
        diagnostics: await this.diagnostics("sim shard probe failure")
      };
    }
  }

  public async setupOwnedRoom(
    roomName: string,
    options: {
      includeController?: boolean;
      includeSource?: boolean;
      includeSpawn?: boolean;
      includeCreep?: boolean;
      spawnName?: string;
    } = {}
  ): Promise<void> {
    const includeController = options.includeController !== false;
    const includeSource = options.includeSource !== false;
    const includeSpawn = options.includeSpawn !== false;
    const includeCreep = options.includeCreep === true;

    await this.addBaseRoom(roomName, includeController, includeSource);
    this._player = await this._server.world.addBot({
      username: "player",
      room: roomName,
      x: 15,
      y: 15,
      spawnName: options.spawnName ?? "SpawnPrimary",
      modules: this.loadModules()
    });
    this.capturePlayerConsole();

    // addBot 总会创建一个 spawn；degraded 场景需要在 DB 层显式移除，才能验证真实缺失对象。
    if (!includeSpawn) {
      await this.removeRoomObjects(roomName, "spawn");
    }

    if (includeCreep) {
      await this.addWorkerCreep(roomName);
    }
  }

  public async addBaseRoom(roomName: string, includeController: boolean, includeSource: boolean): Promise<void> {
    await this._server.world.addRoom(roomName);
    await this._server.world.setTerrain(roomName);

    if (includeController) {
      await this._server.world.addRoomObject(roomName, "controller", 10, 10, { level: 0 });
    }

    if (includeSource) {
      await this._server.world.addRoomObject(roomName, "source", 10, 40, {
        energy: 1000,
        energyCapacity: 1000,
        ticksToRegeneration: 300
      });
    }
  }

  public async removeRoomObjects(roomName: string, type: string): Promise<void> {
    const { db } = await this._server.world.load();
    await db["rooms.objects"].removeWhere({ room: roomName, type });
  }

  public configureShardName(shardName: string): void {
    const engineConfig = this._server.driver.config;
    const marker = `__lystranShardName_${this.scenario.name.replace(/[^A-Za-z0-9_]/g, "_")}`;

    engineConfig.on("playerSandbox", (sandbox: { run(code: string): void }) => {
      sandbox.run(`global.${marker} = "${shardName}"; Game.shard.name = global.${marker};`);
    });
  }

  private loadModules(): { main: string } {
    return {
      main: readFileSync(DIST_MAIN_JS).toString()
    };
  }

  private captureServerEvents(): void {
    this._server.on("info", (message: string) => this.capture("server", message));
    this._server.on("error", (message: string) => this.capture("server", message));
  }

  private capturePlayerConsole(): void {
    this._player.on("console", (log: string[], results: string[]) => {
      log.forEach(message => this.capture("log", message));
      results.forEach(message => this.capture("result", message));
    });
  }

  private capture(type: ConsoleEntry["type"], message: string): void {
    this.consoleEntries.push({ type, message });
    this.consoleEntries = this.consoleEntries.slice(-RECENT_DIAGNOSTIC_LIMIT * 3);
  }

  private async addWorkerCreep(roomName: string): Promise<void> {
    const { C, db } = await this._server.world.load();
    await db["rooms.objects"].insert({
      room: roomName,
      type: "creep",
      x: 16,
      y: 15,
      user: this._player.id,
      name: "WorkerPrimary",
      body: [
        { type: C.WORK, hits: 100 },
        { type: C.CARRY, hits: 100 },
        { type: C.MOVE, hits: 100 }
      ],
      hits: 300,
      hitsMax: 300,
      store: { energy: 0 },
      storeCapacityResource: { energy: 50 },
      fatigue: 0,
      spawning: false,
      ageTime: 1500,
      notifyWhenAttacked: true
    });
  }

  private async readGameTime(): Promise<number | null> {
    if (this._server === undefined) {
      return null;
    }

    return this._server.world.gameTime;
  }
}

export async function probeSimShardCapability(): Promise<SimShardCapability> {
  const helper = new IntegrationTestHelper({
    name: "sim-shard-probe",
    roomName: DEFAULT_ROOM_NAME,
    shardName: "sim",
    async setup(activeHelper: IntegrationTestHelper): Promise<void> {
      await activeHelper.setupOwnedRoom(DEFAULT_ROOM_NAME, { includeCreep: true });
    }
  });

  await helper.start();

  try {
    await helper.tick();

    return await helper.probeSimShardCapability();
  } finally {
    await helper.close();
  }
}

export const helper = new IntegrationTestHelper();

function installStdHooksOnce(): void {
  if (stdHooksInstalled) {
    return;
  }

  stdHooks.hookWrite();
  stdHooksInstalled = true;
}
