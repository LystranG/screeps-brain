<!-- refreshed: 2026-05-07 -->
# Architecture

**Analysis Date:** 2026-05-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                  Screeps Tick Entry                         │
│                 `src/main.ts`                               │
└───────────────┬─────────────────────────────────────────────┘
                │ wraps with ErrorMapper + optional deep profiler
                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Kernel Lifecycle                        │
│                  `src/runtime/Kernel.ts`                    │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ migrate      │ services     │ commands     │ env/bootstrap  │
│ `src/memory` │ `src/runtime`│ `src/commands`│ `src/environment`│
├──────────────┴──────────────┴──────────────┴────────────────┤
│ colonies + processes → spawning → cleanup → stats            │
│ `src/colony`, `src/processes`, `src/spawning`, `src/stats`    │
└───────────────┬─────────────────────────────────────────────┘
                │ process runner dispatches bounded domain work
                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Domain Execution Modules                    │
├─────────────────┬───────────────────┬───────────────────────┤
│ strategy plans  │ bootstrap demands │ creep role/task work   │
│ `src/strategy`  │ `src/bootstrap`   │ `src/roles`, `src/tasks`│
└───────────────┬─┴───────────────────┴───────────────────────┘
                │ writes JSON-only state
                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Screeps Memory                         │
│                  `src/memory/schema.ts`                     │
│ colonies, processes, commands, runtime, config, stats, creeps│
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Tick entry | Export the Screeps `loop`, create the optional `screeps-profiler` adapter, and keep the loop inside `ErrorMapper.wrapLoop`. | `src/main.ts` |
| Kernel | Execute the stable per-tick lifecycle and isolate stage failures. | `src/runtime/Kernel.ts` |
| Lifecycle contract | Define the ordered stage list used by the kernel. | `src/runtime/lifecycle.ts` |
| Runtime services | Build per-tick logger, profiler, CPU availability, and environment service state. | `src/runtime/services.ts` |
| Memory schema | Define persistent JSON Memory shape, defaults, global type augmentation, and `CURRENT_MEMORY_VERSION`. | `src/memory/schema.ts` |
| Memory migrations | Repair partial or legacy Memory into the current schema before game behavior runs. | `src/memory/migrations.ts` |
| Colony context | Convert visible Screeps room objects into sorted `ColonyContext` records and persist compact intel. | `src/colony/context.ts`, `src/colony/intel.ts`, `src/colony/types.ts` |
| Environment detection | Classify `sim`, official world, private, and unknown shards and update compact runtime summaries. | `src/environment/detection.ts` |
| Sim bootstrap | Record sim readiness guidance without attempting to create forbidden world objects. | `src/environment/simBootstrap.ts` |
| Process runner | Run prioritized, cadenced process definitions and persist process state. | `src/processes/runner.ts`, `src/processes/types.ts` |
| Strategy planning | Produce persistent plan summaries and gated intents from colony context and policy. | `src/strategy/planner.ts`, `src/strategy/runner.ts`, `src/strategy/policy.ts`, `src/strategy/types.ts` |
| Bootstrap execution | Translate colony facts into bootstrap slots, spawn queue requests, and creep task assignments. | `src/bootstrap/runner.ts`, `src/bootstrap/slots.ts`, `src/bootstrap/spawnDemand.ts`, `src/bootstrap/taskAssignment.ts` |
| Spawning lifecycle | Select spawn requests, dry-run validate them, call real `spawnCreep`, and mark completion/failure. | `src/spawning/queue.ts`, `src/spawning/runner.ts`, `src/spawning/bodyBuilder.ts` |
| Role registry | Dispatch role behavior to task execution or intentionally deferred role handlers. | `src/roles/registry.ts` |
| Task execution | Execute JSON task memory against live Screeps objects and update task state. | `src/tasks/model.ts`, `src/tasks/executor.ts` |
| Console commands | Install `global.cmd`, route command namespaces, validate args, and record command history. | `src/commands/installer.ts`, `src/commands/registry.ts`, `src/commands/types.ts` |
| Observability | Log by namespace/level, collect lifecycle CPU samples, and flush rolling stats. | `src/logging/Logger.ts`, `src/profiling/Profiler.ts`, `src/stats/Stats.ts` |
| Error mapping | Map bundled stack traces back to TypeScript source and protect the top-level loop. | `src/utils/ErrorMapper.ts` |
| Validation | Provide shared `ValidationResult` and value validators for command/runtime inputs. | `src/validation/results.ts`, `src/validation/runtime.ts`, `src/validation/roomName.ts` |
| Constants | Centralize stable strings for commands, memory keys, process names, roles, runtime, and strategy. | `src/constants/*.ts` |

## Pattern Overview

**Overall:** Layered per-tick kernel with JSON-only persistent state and domain-specific adapters.

**Key Characteristics:**
- Keep `src/main.ts` thin: it constructs `Kernel` once and delegates each tick through `ErrorMapper.wrapLoop`.
- Keep lifecycle order centralized in `src/runtime/lifecycle.ts`; add or reorder stages only through `KERNEL_STAGE_ORDER`.
- Run `src/memory/migrations.ts` before all other stages so downstream modules can assume `Memory` matches `src/memory/schema.ts`.
- Rebuild live `ColonyContext` objects from `Game` each tick; persist only compact JSON summaries in `Memory.colonies`.
- Use process definitions in `src/processes/runner.ts` for cadenced game behavior instead of embedding strategy or role work in the kernel.
- Keep strategy planning pure: `src/strategy/planner.ts` writes plan summaries and intents, not spawn requests or creep actions.
- Use bootstrap adapters in `src/bootstrap/` to convert plans/facts into spawn queue requests and task memory.
- Run actual spawn API calls only in `src/spawning/runner.ts` after dry-run validation.
- Route human controls through `global.cmd` namespaces in `src/commands/`, with command history persisted in `Memory.commands.history`.

## Layers

**Entry Layer:**
- Purpose: Provide the one Screeps runtime export and outer error/profiler boundary.
- Location: `src/main.ts`
- Contains: Module-level `Kernel` singleton, exported `loop`, `ErrorMapper.wrapLoop`, `createScreepsProfilerAdapter`.
- Depends on: `src/runtime/Kernel.ts`, `src/utils/ErrorMapper.ts`, `src/profiling/ScreepsProfilerAdapter.ts`, Screeps globals.
- Used by: Screeps runtime bundle.

**Kernel Layer:**
- Purpose: Coordinate deterministic per-tick stages and failure handling.
- Location: `src/runtime/Kernel.ts`, `src/runtime/lifecycle.ts`, `src/runtime/services.ts`
- Contains: Stage ordering, default stage runners, per-tick services, stage profiling boundaries.
- Depends on: `src/memory/`, `src/environment/`, `src/commands/`, `src/colony/`, `src/processes/`, `src/spawning/`, `src/cleanup/`, `src/stats/`.
- Used by: `src/main.ts`.

**Persistent Memory Layer:**
- Purpose: Define and repair all JSON state kept across Screeps ticks.
- Location: `src/memory/schema.ts`, `src/memory/migrations.ts`
- Contains: `ProjectMemoryShape`, `RuntimeMemory`, `ColonyMemory`, `ProcessMemory`, `SpawnRequestMemory`, `TaskMemory`, defaults, migrations.
- Depends on: `src/constants/roles.ts`, `src/constants/strategy.ts`.
- Used by: Most runtime modules that read or write `Memory`.

**Live Context Layer:**
- Purpose: Adapt live Screeps objects into typed, sorted, non-persistent context records.
- Location: `src/colony/context.ts`, `src/colony/intel.ts`, `src/colony/types.ts`
- Contains: Room discovery, primary room selection, readiness computation, stage summary, intel persistence throttling.
- Depends on: Screeps `Game` and room APIs, `src/memory/schema.ts`.
- Used by: `src/runtime/Kernel.ts`, `src/processes/runner.ts`, command inspection modules, `src/spawning/queue.ts`.

**Process Layer:**
- Purpose: Run independent, cadenced systems over colony contexts.
- Location: `src/processes/runner.ts`, `src/processes/types.ts`
- Contains: Default processes for colony intel, strategy planning, bootstrap execution, and creep roles.
- Depends on: `src/strategy/runner.ts`, `src/bootstrap/runner.ts`, `src/roles/registry.ts`.
- Used by: `src/runtime/Kernel.ts`.

**Planning Layer:**
- Purpose: Compress colony state and policy into persistent strategic intent.
- Location: `src/strategy/`
- Contains: Signature comparison, refresh decisions, strategy plan building, policy gates, strategy trigger types.
- Depends on: `src/colony/types.ts`, `src/memory/schema.ts`, `src/constants/strategy.ts`.
- Used by: `src/processes/runner.ts`, `src/commands/namespaces/strategy.ts`.

**Execution Planning Layer:**
- Purpose: Convert colony facts into actionable but still JSON-backed spawn/task demand.
- Location: `src/bootstrap/`
- Contains: Stable bootstrap slots, spawn demand adapters, task assignment.
- Depends on: `src/colony/types.ts`, `src/spawning/bodyBuilder.ts`, `src/spawning/queue.ts`, `src/tasks/model.ts`.
- Used by: `src/processes/runner.ts`.

**Action Layer:**
- Purpose: Invoke Screeps APIs for spawning and creep work.
- Location: `src/spawning/`, `src/roles/`, `src/tasks/`
- Contains: Spawn queues, body templates, spawn lifecycle, role registry, task state machine.
- Depends on: Live `ColonyContext`, persistent request/task memory, Screeps creep/spawn APIs.
- Used by: `src/runtime/Kernel.ts` for spawning and `src/processes/runner.ts` for creep roles.

**Command Layer:**
- Purpose: Expose read-only and controlled write operations to the Screeps console.
- Location: `src/commands/`
- Contains: `global.cmd` installer, registry, formatter, history, argument validators, namespace modules.
- Depends on: `src/constants/commands.ts`, `src/validation/`, `src/colony/context.ts`, `src/spawning/bodyBuilder.ts`, `src/memory/schema.ts`.
- Used by: `src/runtime/Kernel.ts`.

**Observability Layer:**
- Purpose: Make CPU and runtime state visible without unbounded Memory growth.
- Location: `src/logging/`, `src/profiling/`, `src/stats/`, `src/utils/ErrorMapper.ts`
- Contains: Namespace logger, stage profiler, deep profiler adapter, rolling stats flush, source-map error mapper.
- Depends on: `Memory.config.observability`, `Game.cpu`, Screeps console.
- Used by: `src/runtime/Kernel.ts`, `src/main.ts`, `src/environment/simBootstrap.ts`.

**Constants and Validation Layer:**
- Purpose: Centralize stable values and shared validation results.
- Location: `src/constants/`, `src/validation/`
- Contains: command paths/status/effects, process names, role names, runtime values, strategy values, validators.
- Depends on: No domain runtime modules.
- Used by: All higher-level modules.

## Data Flow

### Primary Tick Path

1. Screeps calls exported `loop` from `src/main.ts`.
2. `ErrorMapper.wrapLoop` catches top-level errors and maps stack traces in `src/utils/ErrorMapper.ts`.
3. `createScreepsProfilerAdapter` optionally wraps the kernel call when `Memory.config.observability.deepProfiler.enabled` is true in `src/main.ts`.
4. `Kernel.run()` iterates `KERNEL_STAGE_ORDER` from `src/runtime/lifecycle.ts`.
5. `migrate` runs `runMemoryMigrations(Memory)` from `src/memory/migrations.ts`; failure records `Memory.runtime.migrationError` and stops the tick.
6. `refreshServices` creates `RuntimeServices` from `src/runtime/services.ts`.
7. `installCommands` installs or reuses `global.cmd` via `src/commands/installer.ts`.
8. `detectEnvironmentBootstrap` classifies the shard using `src/environment/detection.ts`, updates `Memory.runtime.environment`, and runs sim guidance in `src/environment/simBootstrap.ts`.
9. `runColoniesAndProcesses` builds contexts through `src/colony/context.ts` and runs default process definitions from `src/processes/runner.ts`.
10. `runSpawning` rebuilds contexts and runs `runSpawnLifecycle` from `src/spawning/runner.ts`.
11. `cleanup` removes dead creep memory using `src/cleanup/creepMemory.ts`.
12. `flushStats` writes rolling CPU summaries through `src/stats/Stats.ts`.

### Colony Context Flow

1. `buildColonyContexts(Memory, Game, Game.time)` in `src/colony/context.ts` discovers visible rooms, or owned rooms outside sim.
2. `selectPrimaryRoomName` uses `Memory.config.colony.primaryRoomName` when valid, otherwise the first sorted candidate room.
3. `buildVolatileRoomIntel` in `src/colony/intel.ts` scans spawns, sources, creeps, construction sites, hostiles, controller, and energy.
4. `buildSingleColonyContext` computes readiness, missing reasons, and stage summary in `src/colony/context.ts`.
5. `persistColonyIntel` writes throttled compact intel into `Memory.colonies[roomName]` while preserving `spawnQueue` and `strategy`.

### Process Flow

1. `Kernel.runColoniesAndProcesses` calls `runProcessDefinitions` in `src/processes/runner.ts`.
2. `runProcessDefinitions` sorts process definitions by priority and calls `runSingleProcess`.
3. `ensureProcessMemory` creates or reuses `Memory.processes[processId]`.
4. Disabled processes or processes whose `nextRunTick` is in the future return `skipped`.
5. Active processes update `lastRunTick`, `lastStatus`, `lastResult`, `lastError`, and `nextRunTick`.
6. Default processes dispatch to colony intel summary, `runStrategyPlanning`, `runBootstrapExecution`, and role dispatch.

### Strategy Flow

1. `runStrategyPlanning` in `src/strategy/runner.ts` iterates colony contexts.
2. `shouldRefreshStrategyPlan` in `src/strategy/planner.ts` refreshes on missing plan, cadence, or signature change.
3. `buildStrategyPlan` derives stage, status, priorities, allowed intents, and gated deferrals.
4. Policy gates come from `src/strategy/policy.ts` and `Memory.config.strategy`.
5. The final `StrategyPlanMemory` is assigned to `Memory.colonies[roomName].strategy`.

### Bootstrap and Task Flow

1. `runBootstrapExecution` in `src/bootstrap/runner.ts` iterates colony contexts.
2. `buildBootstrapSlots` in `src/bootstrap/slots.ts` creates worker fallback, source, and upgrade slots from colony facts.
3. `applyBootstrapSpawnDemand` in `src/bootstrap/spawnDemand.ts` converts spawn-capable slots into deduplicated `SpawnRequestMemory` entries.
4. `assignBootstrapTasks` in `src/bootstrap/taskAssignment.ts` preserves valid creep tasks or assigns new task memory from demands.
5. `createTaskMemory` in `src/tasks/model.ts` creates JSON task state stored under `CreepMemory.task`.

### Spawn Lifecycle Flow

1. `runSpawnLifecycle` in `src/spawning/runner.ts` first completes visible creeps for `spawning` requests.
2. It then attempts real spawning for one `validated` request.
3. If none is ready, it validates one `queued` request with `spawn.spawnCreep(..., { dryRun: true })`.
4. Queue selection in `src/spawning/queue.ts` sorts by primary room, priority, readiness, requested tick, and id.
5. Recoverable codes keep requests waiting/queued; fatal codes move requests toward `failed`.

### Command Flow

1. `installConsoleCommands` in `src/commands/installer.ts` installs `global.cmd` only when the API version is absent or stale.
2. Namespace functions call `CommandRegistry.execute` from `src/commands/registry.ts`.
3. `execute` resolves namespace and command, runs the command, then records history with `src/commands/history.ts`.
4. Read-only namespaces inspect environment, sim guidance, colony state, strategy, spawn queue, and debug stats.
5. Config commands mutate whitelisted `Memory.config` paths after validation; high-risk toggles require the `CONFIRM` token.

**State Management:**
- Persistent state lives in Screeps `Memory` and must match interfaces in `src/memory/schema.ts`.
- Live Screeps objects stay inside `ColonyContext` and are not persisted.
- `Kernel.services` is module-instance runtime state refreshed every tick in `src/runtime/Kernel.ts`.
- `global.cmd` and `global.__cmdApiVersion` are VM globals managed by `src/commands/installer.ts`.
- `ErrorMapper.consumer` and `ErrorMapper.cache` are static caches in `src/utils/ErrorMapper.ts`.

## Key Abstractions

**Kernel:**
- Purpose: The orchestrator for one tick.
- Examples: `src/runtime/Kernel.ts`, `src/runtime/lifecycle.ts`.
- Pattern: Class with stable lifecycle stages and injectable stage overrides for tests.

**RuntimeServices:**
- Purpose: Pass logger, profiler, CPU availability, and environment metadata without making every module read globals directly.
- Examples: `src/runtime/services.ts`, `src/processes/types.ts`, `src/roles/registry.ts`.
- Pattern: Per-tick service object created after Memory migration.

**ProjectMemoryShape:**
- Purpose: Compile-time contract for persistent JSON state.
- Examples: `src/memory/schema.ts`, `src/memory/migrations.ts`.
- Pattern: Interfaces plus default factory and global `Memory` augmentation.

**ColonyContext:**
- Purpose: Stable runtime view of one candidate room with live objects and derived readiness/stage facts.
- Examples: `src/colony/types.ts`, `src/colony/context.ts`.
- Pattern: Live adapter object rebuilt from `Game` each tick.

**ProcessDefinition:**
- Purpose: Define priority, cadence, enabled state, and work function for domain systems.
- Examples: `src/processes/types.ts`, `src/processes/runner.ts`.
- Pattern: Data-driven process list persisted under `Memory.processes`.

**StrategyPlanMemory:**
- Purpose: Persist explainable strategic intent without executing actions directly.
- Examples: `src/strategy/planner.ts`, `src/memory/schema.ts`.
- Pattern: JSON-only plan with signature, priorities, intents, deferrals, and reasons.

**BootstrapSlot:**
- Purpose: Represent stable early-room needs before adapting them into spawn requests or creep tasks.
- Examples: `src/bootstrap/slots.ts`, `src/bootstrap/runner.ts`.
- Pattern: Pure computation result consumed by demand adapters.

**SpawnRequestMemory:**
- Purpose: Model the spawn queue lifecycle from `queued` through validation, spawning, completion, and failure.
- Examples: `src/spawning/queue.ts`, `src/spawning/runner.ts`, `src/memory/schema.ts`.
- Pattern: Persistent queue item with status transitions through explicit marker functions.

**TaskMemory:**
- Purpose: Persist a creep's assigned work across ticks.
- Examples: `src/tasks/model.ts`, `src/tasks/executor.ts`, `src/bootstrap/taskAssignment.ts`.
- Pattern: JSON task state interpreted by role/task executor.

**CommandRegistry:**
- Purpose: Resolve console command paths into namespace command handlers.
- Examples: `src/commands/types.ts`, `src/commands/registry.ts`, `src/commands/installer.ts`.
- Pattern: Namespace definitions plus `global.cmd` adapter functions.

## Entry Points

**Screeps loop:**
- Location: `src/main.ts`
- Triggers: Screeps runtime calls exported `loop` every tick.
- Responsibilities: Keep profiler and error mapping boundaries around `Kernel.run()`.

**Kernel stages:**
- Location: `src/runtime/Kernel.ts`
- Triggers: `Kernel.run()` from `src/main.ts`.
- Responsibilities: Run migration, service refresh, command install, environment bootstrap, process dispatch, spawn lifecycle, cleanup, and stats.

**Memory migrations:**
- Location: `src/memory/migrations.ts`
- Triggers: Kernel `migrate` stage every tick.
- Responsibilities: Bring `Memory` up to `CURRENT_MEMORY_VERSION` and repair partial sections.

**Console command tree:**
- Location: `src/commands/installer.ts`
- Triggers: Kernel `installCommands` stage, then human calls to `cmd.*` in Screeps console.
- Responsibilities: Expose command namespaces and format command results.

**Process definitions:**
- Location: `src/processes/runner.ts`
- Triggers: Kernel `runColoniesAndProcesses` stage.
- Responsibilities: Run strategy, bootstrap, and role systems according to persisted cadence.

**Spawn lifecycle:**
- Location: `src/spawning/runner.ts`
- Triggers: Kernel `runSpawning` stage.
- Responsibilities: Complete spawned requests, perform validated spawns, or dry-run queued requests.

**Deep profiler adapter:**
- Location: `src/profiling/ScreepsProfilerAdapter.ts`
- Triggers: `src/main.ts` when `Memory.config.observability.deepProfiler.enabled === true`.
- Responsibilities: Lazy-load `screeps-profiler`, enable once, and wrap the loop.

## Architectural Constraints

- **Threading:** Screeps runtime is a single-threaded per-tick loop; keep stage work synchronous and bounded.
- **CPU visibility:** Stage profiling in `src/runtime/Kernel.ts` and `src/profiling/Profiler.ts` excludes `migrate` and `flushStats`; add new long-running work as a named lifecycle stage or process so it can be measured.
- **Memory first:** `runMemoryMigrations` in `src/memory/migrations.ts` must run before all code that assumes `Memory.config`, `Memory.runtime`, `Memory.colonies`, `Memory.processes`, `Memory.commands`, or `Memory.stats`.
- **JSON persistence:** Do not store live Screeps objects in Memory. Persist ids, strings, numbers, booleans, arrays, and plain objects as modeled in `src/memory/schema.ts`.
- **Globals:** Runtime modules intentionally read Screeps globals at boundaries: `src/main.ts`, `src/runtime/Kernel.ts`, `src/commands/installer.ts`, `src/cleanup/creepMemory.ts`, and `src/utils/ErrorMapper.ts`.
- **Command global state:** `global.cmd` is versioned by `COMMAND_API_VERSION` in `src/constants/commands.ts`; update the version when changing the public command tree shape.
- **Sim limitations:** `src/environment/simBootstrap.ts` records guidance and optional flags only; runtime code must not try to create sources, spawns, or initial creeps.
- **Module resolution:** Imports use `tsconfig` baseUrl paths such as `runtime/Kernel`, `memory/schema`, and `commands/registry`; new source imports should follow this pattern.
- **Circular imports:** The observed `src/` imports form layer-style dependencies; avoid reverse imports from constants/validation into domain modules and from memory schema into runtime modules beyond type/value constants.
- **Source map dependency:** `src/utils/ErrorMapper.ts` requires bundled `main.js.map`; keep the Rollup output contract intact when editing runtime bundling.

## Anti-Patterns

### Adding Gameplay Logic to `src/main.ts`

**What happens:** New per-tick behavior is placed next to `kernel.run()` in `src/main.ts`.
**Why it's wrong:** It bypasses lifecycle ordering, profiling, migration safety, and process cadence.
**Do this instead:** Add a kernel stage in `src/runtime/lifecycle.ts` only for cross-cutting lifecycle work, or add a `ProcessDefinition` in `src/processes/runner.ts` for gameplay work.

### Persisting Live Screeps Objects

**What happens:** A module writes `Room`, `Creep`, `Source`, `StructureSpawn`, or `StructureController` objects into `Memory`.
**Why it's wrong:** Screeps `Memory` is JSON state and live objects become invalid or unserializable across ticks.
**Do this instead:** Store ids and compact summaries through interfaces in `src/memory/schema.ts`; rebuild live objects through `src/colony/context.ts`.

### Executing Actions in Strategy Planning

**What happens:** `src/strategy/planner.ts` creates spawn requests or calls Screeps action APIs.
**Why it's wrong:** Strategy is designed as an explainable planner; execution happens in bootstrap, spawning, roles, and tasks.
**Do this instead:** Add intent fields to `StrategyPlanMemory` in `src/memory/schema.ts`, consume them through `src/bootstrap/` or a new process in `src/processes/runner.ts`.

### Bypassing Spawn Queue State Transitions

**What happens:** Code calls `spawn.spawnCreep` directly from bootstrap, roles, commands, or strategy.
**Why it's wrong:** It skips dry-run validation, queue priority, retry/failure state, and persisted diagnostics.
**Do this instead:** Create `SpawnRequestMemory` through `src/spawning/queue.ts` and let `src/spawning/runner.ts` own `spawnCreep`.

### Writing Config Without Command Validators

**What happens:** Console commands or helpers assign arbitrary values into `Memory.config`.
**Why it's wrong:** Invalid config can break later kernel stages after migration has already succeeded.
**Do this instead:** Use validators from `src/validation/` and command argument helpers from `src/commands/arguments.ts`.

### Adding Hardcoded Stable Strings

**What happens:** New roles, process names, command paths, runtime environment names, or strategy statuses are string literals in domain code.
**Why it's wrong:** Stable strings are part of Memory and console contracts.
**Do this instead:** Add constants in `src/constants/` and update schema/validators where needed.

## Error Handling

**Strategy:** Fail fast for invalid Memory migration, isolate other kernel stage failures, and keep command/process errors explainable.

**Patterns:**
- `src/main.ts` wraps the whole tick with `ErrorMapper.wrapLoop` from `src/utils/ErrorMapper.ts`.
- `src/runtime/Kernel.ts` catches each lifecycle stage. Migration failure stops the tick; other stage failures are recorded and logged before later stages continue.
- `src/memory/migrations.ts` catches migration exceptions, writes `Memory.runtime.migrationError`, and returns `{ ok: false }`.
- `src/processes/runner.ts` catches process exceptions, records `lastError`, and schedules the next run by cadence.
- `src/spawning/runner.ts` converts Screeps return codes into queue state transitions and structured `SpawnValidationResult`.
- `src/tasks/executor.ts` marks invalid targets or unsupported tasks as failed in task memory.
- `src/commands/registry.ts` returns read-only error results for unknown namespaces or commands.
- `src/commands/namespaces/config.ts` returns `CONFIRM` before high-risk writes that require explicit confirmation.

## Cross-Cutting Concerns

**Logging:** Use `Logger` from `src/logging/Logger.ts` where `RuntimeServices` are available. Direct `console.log` is used at global/runtime boundaries in `src/runtime/Kernel.ts`, `src/cleanup/creepMemory.ts`, and `src/utils/ErrorMapper.ts`.

**Validation:** Use `ValidationResult` from `src/validation/results.ts`; runtime and command validators live in `src/validation/runtime.ts`, `src/validation/roomName.ts`, and `src/commands/arguments.ts`.

**Authentication:** Not applicable inside `src/`; deployment credentials are outside the source runtime and must not be read by source modules.

**Observability:** Configure log level, namespace sampling, profiler, and deep profiler through `Memory.config.observability` defined in `src/memory/schema.ts`. CPU stage summaries are flushed to `Memory.stats.cpu.stages` by `src/stats/Stats.ts`.

**Manual Control:** Use `global.cmd` namespaces from `src/commands/installer.ts`; command effects are classified by `CommandEffect` in `src/constants/commands.ts`.

**Policy Gating:** High-risk strategy capabilities are disabled by default in `src/memory/schema.ts` and gated through `src/strategy/policy.ts` plus config commands in `src/commands/namespaces/config.ts`.

---

*Architecture analysis: 2026-05-07*
