import { assert } from "chai";
import { CommandEffect } from "constants/commands";
import { formatCommandResult, renderNamespaceHelp } from "commands/formatter";
import { CommandContext } from "commands/types";
import { createDebugNamespace } from "commands/namespaces/debug";
import { createEnvNamespace } from "commands/namespaces/env";
import { createFutureNamespaces } from "commands/namespaces/future";
import { createColonyNamespace } from "commands/namespaces/colony";
import { createSimNamespace } from "commands/namespaces/sim";
import { createSpawnNamespace } from "commands/namespaces/spawn";
import { createStrategyNamespace } from "commands/namespaces/strategy";
import { createDefaultCommandRegistry } from "commands/registry";
import { createDefaultProjectMemorySections, createDefaultStrategyPlanMemory } from "memory/schema";
import { createMockGame, createMockRoom } from "./mock";

describe("command inspection|env|sim", () => {
  function createInspectionMemory(): Memory {
    return {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;
  }

  function createContext(memory: Memory, game?: ReturnType<typeof createMockGame>): CommandContext {
    return {
      game: (game ?? createMockGame()) as unknown as Game,
      memory
    };
  }

  it("defines cmd.env.status() as read-only environment inspection", () => {
    const game = createMockGame();
    game.shard.name = "shard1";
    game.rooms = {
      W1N1: { controller: { my: true } },
      W1N2: { controller: { my: false } }
    };
    game.spawns = { Spawn1: {} };
    const namespace = createEnvNamespace();

    const help = renderNamespaceHelp(namespace);
    const result = namespace.commands[0].run([], createContext(createInspectionMemory(), game));

    assert.equal(namespace.effect, CommandEffect.readOnly);
    assert.include(help, "cmd.env.status()");
    assert.include(help, "read-only");
    assert.include(formatCommandResult(result), "OK env status:");
    assert.include(result.message, "type=world");
    assert.include(result.message, "shard=shard1");
    assert.include(result.message, "visibleRooms=2");
    assert.include(result.message, "ownedRooms=1");
    assert.include(result.message, "spawns=1");
    assert.include(result.message, "cpuAvailable=true");
    assert.include(result.message, "reason=official world shard shard1");
  });

  it("defines cmd.sim.status() and cmd.sim.guidance() without mutating commands", () => {
    const memory = createInspectionMemory();
    memory.runtime.sim.bootstrap = {
      version: 1,
      completed: true,
      ready: false,
      lastRunTick: 123
    };
    memory.runtime.sim.guidance = {
      "missing-spawn": {
        message: "Sim setup needs at least one owned spawn.",
        lastSeenTick: 120,
        lastLoggedTick: 121,
        flagName: "lystran-sim-spawn-needed"
      }
    };
    const namespace = createSimNamespace();

    const commandNames = namespace.commands.map(command => command.name);
    const help = renderNamespaceHelp(namespace);
    const status = namespace.commands[0].run([], createContext(memory));
    const guidance = namespace.commands[1].run([], createContext(memory));

    assert.deepEqual(commandNames, ["status", "guidance"]);
    assert.notInclude(commandNames, "retry");
    assert.notInclude(commandNames, "bootstrap");
    assert.notInclude(commandNames, "enqueue");
    assert.notInclude(commandNames, "spawn");
    assert.notInclude(commandNames, "run");
    assert.include(help, "cmd.sim.status()");
    assert.include(help, "cmd.sim.guidance()");
    assert.include(help, "read-only");
    assert.include(status.message, "version=1");
    assert.include(status.message, "completed=true");
    assert.include(status.message, "ready=false");
    assert.include(status.message, "lastRunTick=123");
    assert.include(guidance.message, "missing-spawn");
    assert.include(guidance.message, "message=Sim setup needs at least one owned spawn.");
    assert.include(guidance.message, "lastSeenTick=120");
    assert.include(guidance.message, "lastLoggedTick=121");
    assert.include(guidance.message, "flagName=lystran-sim-spawn-needed");
  });

  it("reports no sim guidance when guidance memory is empty", () => {
    const namespace = createSimNamespace();
    const result = namespace.commands[1].run([], createContext(createInspectionMemory()));

    assert.deepEqual(result, {
      ok: true,
      status: "OK",
      message: "sim guidance: none",
      effect: CommandEffect.readOnly
    });
  });
});

describe("command inspection|debug|dump", () => {
  function createInspectionMemory(): Memory {
    return {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;
  }

  function createContext(memory: Memory): CommandContext {
    return {
      game: createMockGame() as unknown as Game,
      memory
    };
  }

  it("defines cmd.debug.stats() and cmd.debug.observability() as read-only summaries", () => {
    const memory = createInspectionMemory();
    memory.stats.ticks = 99;
    memory.stats.cpu.available = true;
    memory.stats.cpu.stages = {
      migrate: {
        last: 1.2,
        average: 1.1,
        max: 1.8,
        samples: 3
      }
    };
    memory.config.observability.logLevel = "debug";
    memory.config.observability.profiler.enabled = true;
    memory.config.observability.deepProfiler.enabled = false;
    memory.config.observability.enabledNamespaces = {
      kernel: { enabled: true },
      sim: { enabled: false }
    };
    memory.config.observability.namespaceSampling = {
      kernel: 10
    };
    const namespace = createDebugNamespace();

    const help = renderNamespaceHelp(namespace);
    const stats = namespace.commands[0].run([], createContext(memory));
    const observability = namespace.commands[1].run([], createContext(memory));

    assert.include(help, "cmd.debug.stats()");
    assert.include(help, "cmd.debug.observability()");
    assert.include(help, "cmd.debug.dump(path, maxLength?)");
    assert.include(help, "Memory.runtime");
    assert.include(help, "Memory.config");
    assert.include(help, "Memory.stats");
    assert.include(help, "Memory.commands");
    assert.include(stats.message, "ticks=99");
    assert.include(stats.message, "cpuAvailable=true");
    assert.include(stats.message, "migrate");
    assert.include(stats.message, "last=1.2");
    assert.include(stats.message, "average=1.1");
    assert.include(stats.message, "max=1.8");
    assert.include(stats.message, "samples=3");
    assert.include(observability.message, "logLevel=debug");
    assert.include(observability.message, "profilerEnabled=true");
    assert.include(observability.message, "deepProfilerEnabled=false");
    assert.include(observability.message, "enabledNamespaces=2");
    assert.include(observability.message, "namespaceSampling=1");
  });

  it("dumps only whitelisted Memory paths with bounded JSON output", () => {
    const memory = createInspectionMemory();
    memory.config.observability.logLevel = "warn";
    memory.commands.history = [{ path: "config.status", status: "OK" }];
    const namespace = createDebugNamespace();
    const dump = namespace.commands[2];

    const configDump = dump.run(["Memory.config", 200], createContext(memory));
    const truncatedDump = dump.run(["Memory.commands", 20], createContext(memory));
    const rejectedPath = dump.run(["screeps.json"], createContext(memory));
    const rejectedLength = dump.run(["Memory.config", 0], createContext(memory));

    assert.include(formatCommandResult(configDump), "OK debug dump Memory.config:");
    assert.isAtMost(configDump.message.length, 230);
    assert.include(truncatedDump.message, "...");
    assert.equal(rejectedPath.status, "ERR");
    assert.include(rejectedPath.message, "Dump path must be one of");
    assert.equal(rejectedLength.status, "ERR");
    assert.include(rejectedLength.message, "maxLength must be an integer from 1 through 2000");
  });
});

describe("command inspection|future", () => {
  it("has no remaining future command namespaces after strategy activation", () => {
    const namespaces = createFutureNamespaces();

    assert.deepEqual(namespaces, []);
  });
});

describe("command inspection|colony", () => {
  function createInspectionMemory(): Memory {
    return {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;
  }

  function createContext(memory: Memory, game: ReturnType<typeof createMockGame>): CommandContext {
    return {
      game: game as unknown as Game,
      memory
    };
  }

  function createColonyGame(): ReturnType<typeof createMockGame> {
    const game = createMockGame();
    const primarySpawn = {
      id: "spawn-primary",
      name: "SpawnPrimary"
    };
    const remoteSpawn = {
      id: "spawn-remote",
      name: "SpawnRemote"
    };

    game.rooms = {
      W1N1: createMockRoom({
        name: "W1N1",
        controller: { id: "controller-primary", my: true, level: 3 },
        spawns: [primarySpawn],
        sources: [{ id: "source-a" }, { id: "source-b" }],
        creeps: [{ name: "Worker1" }],
        constructionSites: [{ id: "site-a" }],
        hostiles: [],
        energyAvailable: 550,
        energyCapacityAvailable: 800
      }),
      W1N2: createMockRoom({
        name: "W1N2",
        controller: { id: "controller-remote", my: true, level: 1 },
        spawns: [remoteSpawn],
        sources: [{ id: "source-c" }],
        creeps: [],
        constructionSites: [],
        hostiles: [{ name: "Invader" }],
        energyAvailable: 300,
        energyCapacityAvailable: 300
      }),
      W1N3: createMockRoom({
        name: "W1N3",
        controller: { id: "controller-degraded", my: true, level: 1 },
        spawns: [],
        sources: [],
        creeps: [],
        constructionSites: [],
        hostiles: [],
        energyAvailable: 0,
        energyCapacityAvailable: 0
      })
    };
    game.spawns = {
      SpawnPrimary: primarySpawn,
      SpawnRemote: remoteSpawn
    };

    return game;
  }

  it("defines active read-only colony status, list, and detail commands", () => {
    const memory = createInspectionMemory();
    const game = createColonyGame();
    memory.config.colony.primaryRoomName = "W1N1";
    memory.processes.colonyIntel = {
      id: "colonyIntel",
      name: "Colony Intel",
      enabled: true,
      priority: 10,
      cadence: 5,
      nextRunTick: 128,
      lastRunTick: 123,
      lastResult: "scanned 3 colonies",
      lastError: null
    };
    const namespace = createColonyNamespace();

    const help = renderNamespaceHelp(namespace);
    const status = namespace.commands[0].run([], createContext(memory, game));
    const list = namespace.commands[1].run([], createContext(memory, game));
    const detail = namespace.commands[2].run(["W1N1"], createContext(memory, game));
    const rejectedDetail = namespace.commands[2].run([""], createContext(memory, game));

    assert.equal(namespace.effect, CommandEffect.readOnly);
    assert.deepEqual(
      namespace.commands.map((command: { name: string }) => command.name),
      ["status", "list", "detail"]
    );
    assert.include(help, "cmd.colony.status()");
    assert.include(help, "cmd.colony.list()");
    assert.include(help, "cmd.colony.detail(room)");
    assert.include(status.message, "primary=W1N1");
    assert.include(status.message, "contexts=3");
    assert.include(status.message, "ready=2");
    assert.include(status.message, "degraded=1");
    assert.include(status.message, "missing=W1N3:missing spawn,missing source");
    assert.include(status.message, "processes=colonyIntel:ok@123->128");
    assert.include(list.message, "W1N1 primary ready rcl=3 energy=550/800 sources=2 spawns=1 creeps=1 sites=1 hostiles=0");
    assert.include(list.message, "W1N2 secondary ready rcl=1 energy=300/300 sources=1 spawns=1 creeps=0 sites=0 hostiles=1");
    assert.include(detail.message, "colony detail W1N1:");
    assert.include(detail.message, "stage=rcl3");
    assert.include(detail.message, "controller=controller-primary");
    assert.include(detail.message, "spawns=SpawnPrimary");
    assert.equal(rejectedDetail.status, "ERR");
    assert.include(rejectedDetail.message, "room must be a non-empty string");
    assert.equal(memory.config.colony.primaryRoomName, "W1N1");
    assert.deepEqual(memory.colonies, {});
  });

  it("registers colony as active namespace instead of future placeholder", () => {
    const registry = createDefaultCommandRegistry();
    const futureNames = createFutureNamespaces().map(namespace => namespace.name);

    assert.isDefined(registry.getNamespace("colony"));
    assert.notInclude(futureNames, "colony");
    assert.include(renderNamespaceHelp(registry.getNamespace("colony")!), "cmd.colony.list()");
  });
});

describe("command inspection|spawn", () => {
  function createInspectionMemory(): Memory {
    const memory = {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;

    memory.config.colony.primaryRoomName = "W1N1";
    memory.colonies.W1N1 = {
      roomName: "W1N1",
      primary: true,
      status: "ready",
      intel: {
        roomName: "W1N1",
        lastSeenTick: 100,
        lastRefreshTick: 100,
        status: "ready",
        missingReasons: [],
        controllerId: "controller-primary",
        rcl: 2,
        sourceIds: ["source-a"],
        spawnIds: ["spawn-primary"],
        primary: true,
        stage: "rcl2"
      },
      spawnQueue: [
        {
          id: "spawn-worker-1",
          roomName: "W1N1",
          role: "worker",
          priority: 2,
          body: ["work", "carry", "move"],
          memory: { role: "worker" } as CreepMemory,
          reason: "bootstrap worker coverage",
          requestedTick: 99,
          status: "queued",
          attempts: 1,
          lastError: "-6",
          lastTriedTick: null,
          spawnName: null,
          creepName: null,
          completedTick: null
        }
      ],
      strategy: createDefaultStrategyPlanMemory("W1N1", "test")
    };
    memory.colonies.W2N2 = {
      roomName: "W2N2",
      primary: false,
      status: "degraded",
      intel: {
        roomName: "W2N2",
        lastSeenTick: 100,
        lastRefreshTick: 100,
        status: "degraded",
        missingReasons: ["missing spawn"],
        controllerId: "controller-remote",
        rcl: 1,
        sourceIds: ["source-b"],
        spawnIds: [],
        primary: false,
        stage: "rcl1"
      },
      spawnQueue: [
        {
          id: "spawn-builder-1",
          roomName: "W2N2",
          role: "builder",
          priority: 5,
          body: ["work", "carry", "move"],
          memory: { role: "builder" } as CreepMemory,
          reason: "remote construction coverage",
          requestedTick: 101,
          status: "blocked",
          attempts: 0,
          lastError: "missing spawn",
          lastTriedTick: null,
          spawnName: null,
          creepName: null,
          completedTick: null
        }
      ],
      strategy: createDefaultStrategyPlanMemory("W2N2", "test")
    };

    return memory;
  }

  function createContext(memory: Memory, game: ReturnType<typeof createMockGame>): CommandContext {
    return {
      game: game as unknown as Game,
      memory
    };
  }

  function createSpawnGame(): ReturnType<typeof createMockGame> {
    const game = createMockGame();
    const primarySpawn = createInspectableSpawn("SpawnPrimary");
    const busySpawn = createInspectableSpawn("SpawnBusy", true);

    game.rooms = {
      W1N1: createMockRoom({
        name: "W1N1",
        controller: { id: "controller-primary", my: true, level: 2 },
        spawns: [primarySpawn, busySpawn],
        sources: [{ id: "source-a" }],
        creeps: [],
        constructionSites: [],
        hostiles: [],
        energyAvailable: 300,
        energyCapacityAvailable: 550
      }),
      W2N2: createMockRoom({
        name: "W2N2",
        controller: { id: "controller-remote", my: true, level: 1 },
        spawns: [],
        sources: [{ id: "source-b" }],
        creeps: [],
        constructionSites: [],
        hostiles: [],
        energyAvailable: 200,
        energyCapacityAvailable: 300
      })
    };
    game.spawns = {
      SpawnPrimary: primarySpawn,
      SpawnBusy: busySpawn
    };

    return game;
  }

  it("defines active read-only spawn status, queue, and dryRun commands", () => {
    const memory = createInspectionMemory();
    const game = createSpawnGame();
    const beforeMemory = JSON.stringify(memory);
    const namespace = createSpawnNamespace();

    const help = renderNamespaceHelp(namespace);
    const status = namespace.commands[0].run([], createContext(memory, game));
    const queue = namespace.commands[1].run([], createContext(memory, game));
    const dryRun = namespace.commands[2].run([], createContext(memory, game));

    assert.equal(namespace.effect, CommandEffect.readOnly);
    assert.deepEqual(
      namespace.commands.map((command: { name: string }) => command.name),
      ["status", "queue", "dryRun"]
    );
    assert.include(help, "cmd.spawn.status()");
    assert.include(help, "cmd.spawn.queue()");
    assert.include(help, "cmd.spawn.dryRun(room?, role?, energy?)");
    assert.include(status.message, "W1N1:queued=1 blocked=0 validated=0 failed=0");
    assert.include(status.message, "W2N2:queued=0 blocked=1 validated=0 failed=0");
    assert.include(status.message, "spawns=idle:1 busy:1");
    assert.include(queue.message, "id=spawn-worker-1");
    assert.include(queue.message, "room=W1N1");
    assert.include(queue.message, "role=worker");
    assert.include(queue.message, "priority=2");
    assert.include(queue.message, "status=queued");
    assert.include(queue.message, "attempts=1");
    assert.include(queue.message, "reason=bootstrap worker coverage");
    assert.include(dryRun.message, "spawn dryRun W1N1 worker:");
    assert.include(dryRun.message, "body=work,carry,move");
    assert.include(dryRun.message, "cost=200");
    assert.include(dryRun.message, "returnCode=0");
    assert.include(dryRun.message, "reason=worker balanced template selected");
    assert.equal(JSON.stringify(memory), beforeMemory);
  });

  it("validates spawn dryRun inputs without enqueueing or mutating Memory", () => {
    const memory = createInspectionMemory();
    const game = createSpawnGame();
    const namespace = createSpawnNamespace();
    const dryRun = namespace.commands[2];

    const rejectedRoom = dryRun.run([""], createContext(memory, game));
    const rejectedRole = dryRun.run(["W1N1", "miner"], createContext(memory, game));
    const rejectedEnergy = dryRun.run(["W1N1", "worker", -1], createContext(memory, game));
    const defaultDryRun = dryRun.run([], createContext(memory, game));
    const explicitDryRun = dryRun.run(["W1N1", "builder", 250], createContext(memory, game));
    const primarySpawn = game.spawns.SpawnPrimary as InspectableSpawn;

    assert.equal(rejectedRoom.status, "ERR");
    assert.include(rejectedRoom.message, "room must be a non-empty string");
    assert.equal(rejectedRole.status, "ERR");
    assert.include(rejectedRole.message, "role must be one of");
    assert.equal(rejectedEnergy.status, "ERR");
    assert.include(rejectedEnergy.message, "energy must be a non-negative integer");
    assert.include(defaultDryRun.message, "spawn dryRun W1N1 worker:");
    assert.include(explicitDryRun.message, "spawn dryRun W1N1 builder:");
    assert.deepEqual(primarySpawn.calls[0].options, {
      memory: { role: "worker" },
      dryRun: true
    });
    assert.deepEqual(primarySpawn.calls[1].options, {
      memory: { role: "builder" },
      dryRun: true
    });
    assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "queued");
  });

  it("registers spawn as active namespace instead of future placeholder", () => {
    const registry = createDefaultCommandRegistry();
    const futureNames = createFutureNamespaces().map(namespace => namespace.name);

    assert.isDefined(registry.getNamespace("spawn"));
    assert.notInclude(futureNames, "spawn");
    assert.include(renderNamespaceHelp(registry.getNamespace("spawn")!), "cmd.spawn.dryRun");
  });
});

describe("command inspection|strategy", () => {
  function createInspectionMemory(): Memory {
    const memory = {
      ...createDefaultProjectMemorySections(),
      creeps: {}
    } as Memory;

    memory.config.colony.primaryRoomName = "W1N1";
    memory.config.strategy.allowExpansion = true;
    memory.colonies.W1N1 = {
      roomName: "W1N1",
      primary: true,
      status: "ready",
      intel: {
        roomName: "W1N1",
        lastSeenTick: 200,
        lastRefreshTick: 200,
        status: "ready",
        missingReasons: [],
        controllerId: "controller-primary",
        rcl: 3,
        sourceIds: ["source-a", "source-b"],
        spawnIds: ["spawn-primary"],
        primary: true,
        stage: "rcl3"
      },
      spawnQueue: [],
      strategy: {
        version: 1,
        roomName: "W1N1",
        stage: "rcl3",
        status: "fresh",
        lastRunTick: 210,
        nextRunTick: 260,
        lastTrigger: "state-change",
        signature: "primary-signature",
        priorities: ["worker coverage", "upgrade", "defense"],
        intents: [
          {
            type: "maintainWorkerCoverage",
            priority: 100,
            status: "allowed",
            reason: "maintain worker coverage",
            gate: null
          },
          {
            type: "prioritizeUpgrade",
            priority: 90,
            status: "allowed",
            reason: "prioritize controller upgrade",
            gate: null
          }
        ],
        deferrals: [
          {
            type: "deferExpansion",
            priority: 10,
            status: "allowed",
            reason: "deferral: deferExpansion allowed by strategy.allowExpansion",
            gate: "strategy.allowExpansion"
          },
          {
            type: "deferRemoteMining",
            priority: 10,
            status: "gated",
            reason: "deferral: deferRemoteMining gated by strategy.allowRemoteMining",
            gate: "strategy.allowRemoteMining"
          }
        ],
        reasons: [
          "worker coverage: 2 creeps available for 2 sources",
          "upgrade: controller RCL 3 can progress",
          "deferral: deferRemoteMining gated by strategy.allowRemoteMining"
        ]
      }
    };
    memory.colonies.W2N2 = {
      roomName: "W2N2",
      primary: false,
      status: "degraded",
      intel: {
        roomName: "W2N2",
        lastSeenTick: 190,
        lastRefreshTick: 190,
        status: "degraded",
        missingReasons: ["missing spawn"],
        controllerId: "controller-remote",
        rcl: 1,
        sourceIds: ["source-c"],
        spawnIds: [],
        primary: false,
        stage: "rcl1"
      },
      spawnQueue: [],
      strategy: {
        ...createDefaultStrategyPlanMemory("W2N2", "cadence"),
        stage: "degraded",
        status: "blocked",
        lastRunTick: 180,
        nextRunTick: 230,
        priorities: ["worker coverage"],
        deferrals: [
          {
            type: "deferWarfare",
            priority: 10,
            status: "gated",
            reason: "deferral: deferWarfare gated by strategy.allowWarfare",
            gate: "strategy.allowWarfare"
          }
        ],
        reasons: ["repair: degraded colony missing spawn", "deferral: deferWarfare gated by strategy.allowWarfare"]
      }
    };

    return memory;
  }

  function createContext(memory: Memory): CommandContext {
    return {
      game: createMockGame() as unknown as Game,
      memory
    };
  }

  it("defines cmd.strategy.status(), cmd.strategy.plan(room?), and cmd.strategy.explain(room?) as read-only inspection", () => {
    const memory = createInspectionMemory();
    const namespace = createStrategyNamespace();

    const help = renderNamespaceHelp(namespace);
    const status = namespace.commands[0].run([], createContext(memory));
    const plan = namespace.commands[1].run([], createContext(memory));
    const explicitPlan = namespace.commands[1].run(["W2N2"], createContext(memory));
    const explain = namespace.commands[2].run([], createContext(memory));
    const missingPlan = namespace.commands[1].run(["W9N9"], createContext(memory));

    assert.equal(namespace.name, "strategy");
    assert.equal(namespace.summary, "Read-only strategy planning inspection commands");
    assert.equal(namespace.effect, CommandEffect.readOnly);
    assert.deepEqual(
      namespace.commands.map((command: { name: string }) => command.name),
      ["status", "plan", "explain"]
    );
    assert.include(help, "cmd.strategy.status()");
    assert.include(help, "cmd.strategy.plan(room?)");
    assert.include(help, "cmd.strategy.explain(room?)");
    assert.include(status.message, "strategy status:");
    assert.include(status.message, "plans=2");
    assert.include(status.message, "fresh=1");
    assert.include(status.message, "stale=0");
    assert.include(status.message, "blocked=1");
    assert.include(status.message, "expansion=true");
    assert.include(status.message, "remoteMining=false");
    assert.include(status.message, "market=false");
    assert.include(status.message, "warfare=false");
    assert.include(status.message, "largeFortification=false");
    assert.include(plan.message, "strategy plan W1N1:");
    assert.include(plan.message, "stage=rcl3");
    assert.include(plan.message, "status=fresh");
    assert.include(plan.message, "lastRunTick=210");
    assert.include(plan.message, "nextRunTick=260");
    assert.include(plan.message, "priorities=worker coverage,upgrade,defense");
    assert.include(plan.message, "intents=2");
    assert.include(plan.message, "deferrals=2");
    assert.include(explicitPlan.message, "strategy plan W2N2:");
    assert.include(explicitPlan.message, "status=blocked");
    assert.include(explain.message, "strategy explain W1N1:");
    assert.include(explain.message, "reasons=worker coverage: 2 creeps available for 2 sources");
    assert.include(explain.message, "deferrals=deferExpansion:allowed@strategy.allowExpansion");
    assert.include(explain.message, "deferRemoteMining:gated@strategy.allowRemoteMining");
    assert.equal(missingPlan.status, "ERR");
    assert.include(missingPlan.message, "strategy plan not found for room W9N9");
  });

  it("registers strategy as an active namespace instead of future placeholder", () => {
    const memory = createInspectionMemory();
    const registry = createDefaultCommandRegistry();
    const futureNames = createFutureNamespaces().map(namespace => namespace.name);
    const context = createContext(memory);

    assert.isDefined(registry.getNamespace("strategy"));
    assert.notInclude(futureNames, "strategy");
    assert.include(renderNamespaceHelp(registry.getNamespace("strategy")!), "cmd.strategy.plan(room?)");
    assert.equal(registry.execute(["strategy", "status"], [], context).status, "OK");
    assert.equal(registry.execute(["strategy", "plan"], [], context).status, "OK");
    assert.equal(registry.execute(["strategy", "explain"], [], context).status, "OK");
  });

  it("does not mutate strategy, config, or queue Memory from direct read-only handlers", () => {
    const memory = createInspectionMemory();
    const context = createContext(memory);
    const namespace = createStrategyNamespace();
    const beforeColonies = JSON.stringify(memory.colonies);
    const beforeConfig = JSON.stringify(memory.config);
    const beforeQueue = JSON.stringify(memory.commands.queue);

    const status = namespace.commands[0].run([], context);
    const plan = namespace.commands[1].run([], context);
    const explain = namespace.commands[2].run([], context);

    assert.equal(JSON.stringify(memory.colonies), beforeColonies);
    assert.equal(JSON.stringify(memory.config), beforeConfig);
    assert.equal(JSON.stringify(memory.commands.queue), beforeQueue);
    assert.include(explain.message, "reasons=worker coverage: 2 creeps available for 2 sources");
    assert.include(plan.message, "priorities=worker coverage,upgrade,defense");
    assert.include(explain.message, "gated=deferRemoteMining:gated@strategy.allowRemoteMining");
    assert.include(explain.message, "deferral: deferRemoteMining gated by strategy.allowRemoteMining");
    assert.include(status.message, "gates=expansion=true");
  });
});

interface InspectableSpawn extends StructureSpawn {
  calls: Array<{
    body: BodyPartConstant[];
    name: string;
    options: SpawnOptions;
  }>;
}

function createInspectableSpawn(name: string, busy = false, returnCode: ScreepsReturnCode = 0): InspectableSpawn {
  const calls: InspectableSpawn["calls"] = [];

  return {
    id: `${name}-id`,
    name,
    spawning: busy ? {} : null,
    calls,
    spawnCreep: (body: BodyPartConstant[], creepName: string, options: SpawnOptions): ScreepsReturnCode => {
      calls.push({
        body,
        name: creepName,
        options
      });

      return returnCode;
    }
  } as InspectableSpawn;
}
