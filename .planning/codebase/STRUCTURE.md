# Codebase Structure

**Analysis Date:** 2026-05-07

## Directory Layout

```text
src/
├── main.ts                         # Screeps loop entry; delegates to Kernel
├── bootstrap/                      # Early-room slots, spawn demand, and task assignment
├── cleanup/                        # Tick-end cleanup routines
├── colony/                         # Live room-to-colony context and compact intel
├── commands/                       # Screeps console command API
│   └── namespaces/                 # Individual cmd.* namespaces
├── constants/                      # Stable strings for Memory and public contracts
├── environment/                    # Runtime environment detection and sim bootstrap guidance
├── logging/                        # Namespace-aware console logger
├── memory/                         # Persistent Memory schema and migrations
├── processes/                      # Cadenced process definitions and runner
├── profiling/                      # Lightweight CPU profiler and screeps-profiler adapter
├── roles/                          # Role registry and role dispatch boundary
├── runtime/                        # Kernel lifecycle and runtime services
├── spawning/                       # Spawn queue, body builder, and spawn lifecycle
├── stats/                          # Runtime stats flushing
├── strategy/                       # Strategy policy, planner, and runner
├── tasks/                          # Creep task memory model and executor
├── types/                          # Ambient declarations for optional external modules
├── utils/                          # Shared runtime utilities
└── validation/                     # Shared validation result and validators
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript runtime source bundled for Screeps.
- Contains: One top-level entry point and domain folders.
- Key files: `src/main.ts`.

**`src/runtime/`:**
- Purpose: Own the per-tick lifecycle and service construction.
- Contains: `Kernel`, lifecycle stage definitions, runtime service factory.
- Key files: `src/runtime/Kernel.ts`, `src/runtime/lifecycle.ts`, `src/runtime/services.ts`.

**`src/memory/`:**
- Purpose: Define and repair persistent Screeps `Memory`.
- Contains: Type interfaces, default state factories, global `Memory` and `CreepMemory` augmentation, migrations.
- Key files: `src/memory/schema.ts`, `src/memory/migrations.ts`.

**`src/colony/`:**
- Purpose: Build live, typed colony contexts from visible Screeps rooms and maintain compact colony intel.
- Contains: Context builder, volatile intel scanner, context/intel types.
- Key files: `src/colony/context.ts`, `src/colony/intel.ts`, `src/colony/types.ts`.

**`src/processes/`:**
- Purpose: Define the cadenced process execution model used by the kernel.
- Contains: Process interfaces, process memory handling, default process list.
- Key files: `src/processes/runner.ts`, `src/processes/types.ts`.

**`src/strategy/`:**
- Purpose: Produce explainable, persistent strategy plans from colony facts and policy gates.
- Contains: Planner, runner, policy helpers, trigger/decision types.
- Key files: `src/strategy/planner.ts`, `src/strategy/runner.ts`, `src/strategy/policy.ts`, `src/strategy/types.ts`.

**`src/bootstrap/`:**
- Purpose: Translate early colony facts into slots, spawn demand, and task assignment.
- Contains: Bootstrap runner, slot builder, spawn demand adapter, task assignment logic.
- Key files: `src/bootstrap/runner.ts`, `src/bootstrap/slots.ts`, `src/bootstrap/spawnDemand.ts`, `src/bootstrap/taskAssignment.ts`.

**`src/spawning/`:**
- Purpose: Own body construction, spawn queue state, and actual spawn lifecycle API calls.
- Contains: Body builder, queue helpers, spawn lifecycle runner.
- Key files: `src/spawning/bodyBuilder.ts`, `src/spawning/queue.ts`, `src/spawning/runner.ts`.

**`src/roles/`:**
- Purpose: Map `CreepMemory.role` to executable role behavior.
- Contains: Role interfaces, default role registry, deferred role boundary.
- Key files: `src/roles/registry.ts`.

**`src/tasks/`:**
- Purpose: Model and execute assigned creep task memory.
- Contains: Task constants, task memory factory/validator, executor for harvest/upgrade/pickup/transfer/refill.
- Key files: `src/tasks/model.ts`, `src/tasks/executor.ts`.

**`src/commands/`:**
- Purpose: Expose the Screeps console command tree and command registry.
- Contains: Command types, registry, installer, formatter, history, argument validators, namespace implementations.
- Key files: `src/commands/installer.ts`, `src/commands/registry.ts`, `src/commands/types.ts`, `src/commands/arguments.ts`, `src/commands/history.ts`, `src/commands/formatter.ts`.

**`src/commands/namespaces/`:**
- Purpose: Keep each `cmd.*` namespace isolated.
- Contains: Environment, sim, config, debug, colony, strategy, spawn, and future namespaces.
- Key files: `src/commands/namespaces/env.ts`, `src/commands/namespaces/sim.ts`, `src/commands/namespaces/config.ts`, `src/commands/namespaces/debug.ts`, `src/commands/namespaces/colony.ts`, `src/commands/namespaces/strategy.ts`, `src/commands/namespaces/spawn.ts`, `src/commands/namespaces/future.ts`.

**`src/environment/`:**
- Purpose: Detect the runtime environment and guide simulator setup.
- Contains: Shard classification, compact environment summary updates, sim readiness guidance.
- Key files: `src/environment/detection.ts`, `src/environment/simBootstrap.ts`.

**`src/logging/`:**
- Purpose: Provide namespace-aware Screeps console logging.
- Contains: `Logger` and logging config types.
- Key files: `src/logging/Logger.ts`.

**`src/profiling/`:**
- Purpose: Measure kernel stage CPU and integrate optional `screeps-profiler`.
- Contains: Lightweight `Profiler`, deep profiler adapter, lazy `require("screeps-profiler")`.
- Key files: `src/profiling/Profiler.ts`, `src/profiling/ScreepsProfilerAdapter.ts`.

**`src/stats/`:**
- Purpose: Flush CPU profile samples into compact rolling summaries.
- Contains: Stats flush function.
- Key files: `src/stats/Stats.ts`.

**`src/cleanup/`:**
- Purpose: Keep tick-end cleanup isolated from strategy or execution logic.
- Contains: Dead creep memory cleanup.
- Key files: `src/cleanup/creepMemory.ts`.

**`src/constants/`:**
- Purpose: Centralize stable strings used in Memory, command, process, role, runtime, and strategy contracts.
- Contains: `as const` objects and matching union types.
- Key files: `src/constants/commands.ts`, `src/constants/memory.ts`, `src/constants/processes.ts`, `src/constants/roles.ts`, `src/constants/runtime.ts`, `src/constants/strategy.ts`.

**`src/validation/`:**
- Purpose: Provide reusable validation primitives for command and runtime inputs.
- Contains: `ValidationResult`, log level/shard/environment validators, room-name validator.
- Key files: `src/validation/results.ts`, `src/validation/runtime.ts`, `src/validation/roomName.ts`.

**`src/utils/`:**
- Purpose: Hold shared runtime utilities that are not game strategy.
- Contains: Source-map stack trace mapper and loop wrapper.
- Key files: `src/utils/ErrorMapper.ts`.

**`src/types/`:**
- Purpose: Declare types for optional modules not covered by installed ambient types.
- Contains: `screeps-profiler` ambient declaration.
- Key files: `src/types/screeps-profiler.d.ts`.

## Key File Locations

**Entry Points:**
- `src/main.ts`: Exported Screeps `loop`; wraps `Kernel.run()`.
- `src/runtime/Kernel.ts`: Main per-tick orchestrator.
- `src/commands/installer.ts`: Installs the `global.cmd` console API.

**Configuration:**
- `src/memory/schema.ts`: Runtime default config under `ProjectConfigMemory`.
- `src/constants/*.ts`: Stable config-adjacent enumerations and public string contracts.
- `src/commands/namespaces/config.ts`: Console command mutations for observability, construction, defense, and selected strategy gates.

**Core Logic:**
- `src/runtime/Kernel.ts`: Lifecycle execution and error isolation.
- `src/colony/context.ts`: Room discovery and `ColonyContext` construction.
- `src/processes/runner.ts`: Cadenced process dispatch.
- `src/strategy/planner.ts`: Strategy plan creation.
- `src/bootstrap/runner.ts`: Bootstrap execution coordinator.
- `src/spawning/runner.ts`: Spawn lifecycle action coordinator.
- `src/tasks/executor.ts`: Creep task behavior.

**Persistence:**
- `src/memory/schema.ts`: Persistent shape and defaults.
- `src/memory/migrations.ts`: Versioned migrations and repair helpers.
- `src/colony/intel.ts`: Compact colony intel persistence.
- `src/spawning/queue.ts`: Spawn queue persistence helpers.
- `src/commands/history.ts`: Command history persistence.

**Observability:**
- `src/logging/Logger.ts`: Runtime logger.
- `src/profiling/Profiler.ts`: Stage profiler.
- `src/profiling/ScreepsProfilerAdapter.ts`: Optional deep profiler.
- `src/stats/Stats.ts`: Rolling stats writer.
- `src/utils/ErrorMapper.ts`: Source-mapped error output.

**Testing:**
- Not in `--paths src` scope. Source files expose testable boundaries through `KernelOptions` in `src/runtime/Kernel.ts`, pure helpers in `src/strategy/planner.ts`, `src/bootstrap/slots.ts`, `src/spawning/bodyBuilder.ts`, and queue/model functions in `src/spawning/queue.ts` and `src/tasks/model.ts`.

## Naming Conventions

**Files:**
- Use lowercase descriptive filenames for feature modules: `src/bootstrap/slots.ts`, `src/spawning/queue.ts`, `src/tasks/model.ts`.
- Use PascalCase filenames for exported class utilities: `src/runtime/Kernel.ts`, `src/logging/Logger.ts`, `src/profiling/Profiler.ts`, `src/profiling/ScreepsProfilerAdapter.ts`, `src/utils/ErrorMapper.ts`, `src/stats/Stats.ts`.
- Use `types.ts` for local domain interfaces: `src/colony/types.ts`, `src/processes/types.ts`, `src/strategy/types.ts`, `src/commands/types.ts`.
- Use `runner.ts` for modules that coordinate a domain workflow: `src/processes/runner.ts`, `src/bootstrap/runner.ts`, `src/spawning/runner.ts`, `src/strategy/runner.ts`.
- Use namespace filenames under `src/commands/namespaces/` matching `CommandPath` names: `colony.ts`, `config.ts`, `debug.ts`, `env.ts`, `sim.ts`, `spawn.ts`, `strategy.ts`.

**Directories:**
- Use singular domain names when the directory owns one conceptual subsystem: `src/runtime/`, `src/memory/`, `src/colony/`, `src/strategy/`, `src/environment/`, `src/validation/`.
- Use plural domain names when the directory owns registries or multiple instances: `src/processes/`, `src/commands/`, `src/roles/`, `src/tasks/`, `src/constants/`.

**Exports:**
- Export public functions with verb-first names: `buildColonyContexts`, `runProcessDefinitions`, `createDefaultProcessDefinitions`, `runStrategyPlanning`, `buildStrategyPlan`, `runBootstrapExecution`, `runSpawnLifecycle`.
- Export factory helpers with `create*`: `createRuntimeServices`, `createDefaultProjectMemorySections`, `createDefaultStrategyPlanMemory`, `createSpawnRequest`, `createDefaultCommandRegistry`.
- Export validation helpers with `validate*`: `validateLogLevel`, `validateRuntimeEnvironment`, `validateTaskMemory`, `validateConfirmToken`.
- Export persistent constants as `as const` objects plus matching union type aliases: `RoleName`, `ProcessName`, `CommandPath`, `StrategyIntentType`.

## Where to Add New Code

**New Kernel Stage:**
- Primary code: `src/runtime/Kernel.ts`
- Stage order: `src/runtime/lifecycle.ts`
- Constants if stage name becomes public/persistent: `src/constants/processes.ts`
- Use only for cross-cutting per-tick infrastructure that must happen before or after existing stages.

**New Cadenced Gameplay Process:**
- Process interface: `src/processes/types.ts`
- Registration: `src/processes/runner.ts`
- Persistent process state: `src/memory/schema.ts` if new fields are needed.
- Use this for colony systems that should run by priority/cadence and record status in `Memory.processes`.

**New Memory Section or Field:**
- Schema: `src/memory/schema.ts`
- Defaults: `createDefaultProjectMemorySections()` in `src/memory/schema.ts`
- Migration/repair: `src/memory/migrations.ts`
- Stable key constants if needed: `src/constants/memory.ts`

**New Role:**
- Stable role string: `src/constants/roles.ts`
- Creep memory typing: `src/memory/schema.ts` if role-specific task/memory fields are added.
- Registry behavior: `src/roles/registry.ts`
- Task execution: `src/tasks/model.ts` and `src/tasks/executor.ts` if the role uses new task types.

**New Task Type:**
- Task constants/model: `src/tasks/model.ts`
- Runtime execution: `src/tasks/executor.ts`
- Task demand creation: `src/bootstrap/slots.ts` or a new process-specific demand module.
- Memory migration if task memory shape changes: `src/memory/migrations.ts`.

**New Spawn Behavior:**
- Body template/intents: `src/spawning/bodyBuilder.ts`
- Queue fields/transitions: `src/spawning/queue.ts`
- Real API calls and return-code handling: `src/spawning/runner.ts`
- Bootstrap demand source: `src/bootstrap/spawnDemand.ts` or `src/bootstrap/slots.ts`.

**New Strategy Intent or Policy Gate:**
- Stable intent constants: `src/constants/strategy.ts`
- Memory schema if plan shape changes: `src/memory/schema.ts`
- Planner generation: `src/strategy/planner.ts`
- Gate logic: `src/strategy/policy.ts`
- Console inspection: `src/commands/namespaces/strategy.ts`
- Config mutation if operator-controlled: `src/commands/namespaces/config.ts`.

**New Console Command Namespace:**
- Namespace implementation: `src/commands/namespaces/<name>.ts`
- Stable command path: `src/constants/commands.ts`
- Registry registration: `src/commands/registry.ts`
- Global command tree binding: `src/commands/installer.ts`
- Arguments/validation: `src/commands/arguments.ts` and `src/validation/`.
- Bump `COMMAND_API_VERSION` in `src/constants/commands.ts` when changing the public `cmd` tree.

**New Read-Only Command:**
- Add to relevant namespace under `src/commands/namespaces/`.
- Use `CommandEffect.readOnly` from `src/constants/commands.ts`.
- Rebuild contexts with `{ persistPrimary: false, persistIntel: false }` when inspecting live room state, as in `src/commands/namespaces/spawn.ts`.

**New Config Command:**
- Add validator in `src/validation/` or `src/commands/arguments.ts`.
- Add command definition in `src/commands/namespaces/config.ts`.
- Mutate only whitelisted `Memory.config` fields from `src/memory/schema.ts`.
- Require `CONFIRM` for high-risk changes following `createConfirmedToggleCommand` in `src/commands/namespaces/config.ts`.

**New Environment or Sim Logic:**
- Environment classification: `src/environment/detection.ts`
- Sim-only guidance: `src/environment/simBootstrap.ts`
- Stable names: `src/constants/runtime.ts`
- Persistent runtime summary shape: `src/memory/schema.ts`.

**New Observability Feature:**
- Logger behavior: `src/logging/Logger.ts`
- Stage CPU metrics: `src/profiling/Profiler.ts`, `src/stats/Stats.ts`
- Deep profiling integration: `src/profiling/ScreepsProfilerAdapter.ts`
- Config/defaults: `src/memory/schema.ts`
- Console inspection/mutation: `src/commands/namespaces/debug.ts`, `src/commands/namespaces/config.ts`.

**New Validation Helper:**
- Generic result type: `src/validation/results.ts`
- Runtime value validators: `src/validation/runtime.ts`
- Command argument validators: `src/commands/arguments.ts`

**New Utility:**
- Shared runtime utility: `src/utils/`
- Prefer domain-specific directories over `src/utils/` when the helper belongs to a clear subsystem.

## Special Directories

**`src/types/`:**
- Purpose: Ambient declarations for runtime dependencies such as `screeps-profiler`.
- Generated: No.
- Committed: Yes.

**`src/commands/namespaces/`:**
- Purpose: One file per public console namespace.
- Generated: No.
- Committed: Yes.
- Constraint: Keep namespace registration synchronized with `src/commands/registry.ts` and `src/commands/installer.ts`.

**`src/constants/`:**
- Purpose: Stable strings that can appear in `Memory`, logs, commands, or persisted plans.
- Generated: No.
- Committed: Yes.
- Constraint: Add constants here before using new stable string values elsewhere.

**`src/memory/`:**
- Purpose: Persistent data contract.
- Generated: No.
- Committed: Yes.
- Constraint: Any persistent shape change requires defaults and migration/repair code.

---

*Structure analysis: 2026-05-07*
