# Coding Conventions

**Analysis Date:** 2026-05-07

Scope: `src` only, with `test/` read only where it documents behavior connected to `src`.

## Naming Patterns

**Files:**
- Use lowercase descriptive file names for feature modules: `src/main.ts`, `src/runtime/lifecycle.ts`, `src/commands/arguments.ts`, `src/spawning/queue.ts`, `src/tasks/model.ts`.
- Use PascalCase file names only when the file exports a matching class-like utility: `src/runtime/Kernel.ts`, `src/logging/Logger.ts`, `src/profiling/Profiler.ts`, `src/stats/Stats.ts`, `src/utils/ErrorMapper.ts`.
- Group domain code by directory under `src/`: `src/bootstrap/`, `src/cleanup/`, `src/colony/`, `src/commands/`, `src/constants/`, `src/environment/`, `src/memory/`, `src/processes/`, `src/runtime/`, `src/spawning/`, `src/strategy/`, `src/tasks/`, `src/validation/`.
- Put command namespace implementations under `src/commands/namespaces/` with one namespace per file, such as `src/commands/namespaces/config.ts` and `src/commands/namespaces/debug.ts`.
- Put stable string domains under `src/constants/`, such as `src/constants/commands.ts`, `src/constants/processes.ts`, `src/constants/roles.ts`, `src/constants/runtime.ts`, and `src/constants/strategy.ts`.

**Functions:**
- Use camelCase verbs for exported factories and runners: `createDefaultProjectMemorySections()` in `src/memory/schema.ts`, `runMemoryMigrations()` in `src/memory/migrations.ts`, `buildStrategyPlan()` in `src/strategy/planner.ts`, `runBootstrapExecution()` in `src/bootstrap/runner.ts`.
- Prefix constructors/factories with `create`: `createCommandRegistry()` in `src/commands/registry.ts`, `createTaskMemory()` in `src/tasks/model.ts`, `createSpawnRequest()` in `src/spawning/queue.ts`.
- Prefix orchestration functions with `run`: `runSpawnLifecycle()` in `src/spawning/runner.ts`, `runProcessDefinitions()` in `src/processes/runner.ts`, `runStrategyPlanning()` in `src/strategy/runner.ts`.
- Prefix validation functions with `validate`: `validateConfirmToken()` in `src/commands/arguments.ts`, `validateLogLevel()` in `src/validation/runtime.ts`, `validateTaskMemory()` in `src/tasks/model.ts`.
- Prefix narrow type guards with `is`: `isRoleName()` and `isSpawnRequestStatus()` in `src/memory/migrations.ts`, `isObjectRecord()` in `src/tasks/model.ts`.
- Keep helper functions private to their module unless they form part of an explicit runtime contract. Examples: `deriveStrategyStage()` in `src/strategy/planner.ts` stays local, while `shouldRefreshStrategyPlan()` is exported because `src/strategy/runner.ts` consumes it.

**Variables:**
- Use camelCase locals and parameters: `startingVersion`, `migrationResult`, `existingPlan`, `namespaceName`, `commandName`, `requestedTick`.
- Use descriptive aggregate names for collections: `observedStages` in `test/unit/kernel.test.ts`, `stageSummaries` in `src/commands/namespaces/debug.ts`, `candidates` in `src/spawning/queue.ts`.
- Use `result` for structured return values and `summary` for accumulated counters: `KernelRunResult` in `src/runtime/Kernel.ts`, `BootstrapExecutionSummary` in `src/bootstrap/runner.ts`.
- Use uppercase constants for fixed configuration: `CURRENT_MEMORY_VERSION` in `src/memory/schema.ts`, `MAX_VALIDATION_ATTEMPTS` in `src/spawning/queue.ts`, `COMMAND_API_VERSION` in `src/constants/commands.ts`.

**Types:**
- Use PascalCase for exported interfaces, classes, and enum-like type aliases: `KernelRunResult`, `RuntimeServices`, `ProjectMemoryShape`, `CommandResult`, `TaskMemory`.
- Prefer `interface` for object shapes. Examples: `LoggerConfig` in `src/logging/Logger.ts`, `CommandDefinition` in `src/commands/types.ts`, `CreateSpawnRequestParams` in `src/spawning/queue.ts`.
- Use `as const` objects plus derived union types for runtime-safe string sets: `CommandPath`, `CommandStatusPrefix`, and `CommandEffect` in `src/constants/commands.ts`; `TaskStatus` and `TaskType` in `src/tasks/model.ts`.
- Use discriminated result unions where callers must branch explicitly: `ValidationResult<T>` in `src/validation/results.ts`, `MigrationResult` in `src/memory/migrations.ts`.

## Code Style

**Formatting:**
- Use Prettier from `.prettierrc`: semicolons enabled, 2-space indentation, 120-character print width, double quotes, no trailing commas, arrow parens omitted when possible, and `endOfLine: auto`.
- Use TypeScript strict mode from `tsconfig.json`: `strict: true`, `noImplicitReturns: true`, and `allowUnreachableCode: false`.
- Keep object literals and return values explicit. Runtime factories such as `createDefaultProjectMemorySections()` in `src/memory/schema.ts` and `createSpawnRequest()` in `src/spawning/queue.ts` return fully populated JSON-compatible records.
- Keep the Screeps entry point thin. `src/main.ts` owns `ErrorMapper.wrapLoop`, `Kernel` construction, and deep profiler wrapping; feature behavior belongs in domain modules such as `src/runtime/Kernel.ts`, `src/spawning/runner.ts`, and `src/bootstrap/runner.ts`.
- Keep persistent `Memory` values JSON-only. `src/memory/schema.ts`, `src/tasks/model.ts`, `src/strategy/planner.ts`, and `src/spawning/queue.ts` store strings, numbers, booleans, arrays, and plain objects, not live Screeps objects.

**Linting:**
- Use ESLint from `.eslintrc.js`; run `npm run lint`, which lints `src/**/*.ts`.
- ESLint extends `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:@typescript-eslint/recommended-requiring-type-checking`, `plugin:import/*`, and `prettier`.
- Type-aware linting uses `parserOptions.project: "tsconfig.json"` in `.eslintrc.js`; new source files under `src/` must be included by `tsconfig.json`.
- Keep explicit member accessibility on class members. Examples: `public run()` and `private createLifecycleStages()` in `src/runtime/Kernel.ts`, `public debug()` and `private log()` in `src/logging/Logger.ts`.
- Avoid multiple classes per file; `.eslintrc.js` enforces `max-classes-per-file: 1`.
- Avoid `var`, bitwise operators, literal throws, wrapper constructors, `eval`, missing radix in `parseInt`, and invalid identifiers banned by `.eslintrc.js`.
- `console.log` is allowed for Screeps runtime output, but route ordinary logs through `Logger` in `src/logging/Logger.ts` or narrowly scoped runtime boundaries such as `src/runtime/Kernel.ts`, `src/cleanup/creepMemory.ts`, and `src/utils/ErrorMapper.ts`.

## Import Organization

**Order:**
1. External libraries first, such as `source-map` in `src/utils/ErrorMapper.ts`.
2. Source-root imports through the `src/` base URL, such as `memory/schema`, `runtime/services`, `commands/types`, and `constants/roles`.
3. Type-only imports use `import type` where possible, as in `src/strategy/planner.ts` and `src/strategy/types.ts`.

**Path Aliases:**
- Use `tsconfig.json` `baseUrl: "src/"` for application imports. Prefer `import { Kernel } from "runtime/Kernel"` in `src/main.ts` over relative traversal.
- Tests load `tsconfig-paths/register` from `test/mocha.opts`, so source aliases work in `test/unit/*.test.ts`.
- Existing tests sometimes use relative imports when exercising the exact entry file, such as `../../src/main` in `test/unit/main.test.ts` and `../../src/runtime/Kernel` in `test/unit/kernel.test.ts`; keep this pattern only when the test intentionally binds to the public entry file.
- Avoid importing upward across feature directories in `src/`; use source-root aliases instead.

## Error Handling

**Patterns:**
- Use structured result objects for expected failures. Examples: `ValidationResult<T>` in `src/validation/results.ts`, `CommandResult` in `src/commands/types.ts`, `SpawnQueueResult` in `src/spawning/queue.ts`, and `KernelRunResult` in `src/runtime/Kernel.ts`.
- Return `{ ok: false, reason: string }` for validation failures in `src/commands/arguments.ts`, `src/validation/runtime.ts`, `src/validation/roomName.ts`, and `src/tasks/model.ts`.
- Return `{ ok: false, status: "ERR", message, effect }` for command failures in `src/commands/registry.ts` and command namespaces under `src/commands/namespaces/`.
- Throw only for unrecoverable lifecycle preconditions. `src/runtime/Kernel.ts` throws when memory migration fails and when runtime services are required before initialization.
- The `migrate` lifecycle stage is fail-fast in `src/runtime/Kernel.ts`; non-migration stage failures are recorded and logged, then later stages continue.
- Catch `unknown` values and narrow to `Error` before reading `.message`. Examples: `runMemoryMigrations()` in `src/memory/migrations.ts` and `Kernel.run()` in `src/runtime/Kernel.ts`.
- Wrap the exported Screeps loop in `ErrorMapper.wrapLoop()` in `src/main.ts`; keep new top-level tick orchestration inside this wrapper.
- `src/utils/ErrorMapper.ts` escapes mapped stack traces before writing HTML to the Screeps console and rethrows non-`Error` values.
- Recoverable Screeps return codes should keep state retryable. `src/spawning/runner.ts` and `src/spawning/queue.ts` distinguish waiting states from failed attempts; `src/tasks/executor.ts` keeps `ERR_NOT_IN_RANGE` tasks running and blocked rather than failed.

## Logging

**Framework:** `console.log` wrapped by `Logger` where possible.

**Patterns:**
- Use `Logger` from `src/logging/Logger.ts` for namespaced runtime logs. Methods are `debug`, `info`, `warn`, and `error`; output format is `[level] namespace: message`.
- Create `Logger` through runtime services in `src/runtime/services.ts` so ordinary modules do not read `Memory.config` directly.
- Use namespace strings such as `kernel:colonies`, `kernel:processes`, and `kernel:spawning` from `src/runtime/Kernel.ts` when logging subsystem failures.
- Honor log level, disabled namespaces, and sampling in `Logger.shouldLog()` in `src/logging/Logger.ts`; warnings and errors bypass namespace sampling.
- Keep console output concise. Screeps console is CPU-sensitive and visible during runtime.
- Direct `console.log` calls are acceptable for boundary events: source-mapped errors in `src/utils/ErrorMapper.ts`, kernel stage failures in `src/runtime/Kernel.ts`, and cleanup summaries in `src/cleanup/creepMemory.ts`.

## Comments

**When to Comment:**
- Comment phase boundaries, runtime constraints, Memory migration safety, command global caching, and Screeps API caveats. Examples: `src/runtime/Kernel.ts`, `src/memory/migrations.ts`, `src/commands/installer.ts`, `src/tasks/executor.ts`.
- Prefer short Chinese comments for non-obvious intent and constraints in new or changed code, matching current source style in `src/runtime/Kernel.ts`, `src/bootstrap/runner.ts`, `src/memory/schema.ts`, and `src/tasks/model.ts`.
- Explain why a branch protects runtime state, not what each assignment does.
- Use comments when a type escape or lint disable is necessary. Examples: `src/profiling/ScreepsProfilerAdapter.ts` disables `no-var-requires` near Screeps profiler loading; `src/utils/ErrorMapper.ts` disables starter-era linting globally.

**JSDoc/TSDoc:**
- Use JSDoc for public APIs with non-obvious behavior or runtime cost. Examples: `Kernel.run()` in `src/runtime/Kernel.ts`, `createDefaultProjectMemorySections()` in `src/memory/schema.ts`, `runMemoryMigrations()` in `src/memory/migrations.ts`, and `ErrorMapper.sourceMappedStackTrace()` in `src/utils/ErrorMapper.ts`.
- Public factories that define persistent schemas should document JSON-only guarantees, as in `createDefaultStrategyPlanMemory()` and `createDefaultProjectMemorySections()` in `src/memory/schema.ts`.
- Ambient Screeps type extensions in `src/memory/schema.ts` use a short block comment in `declare global`; keep global augmentation comments close to the declarations.

## Function Design

**Size:** Keep orchestration functions readable and delegate domain decisions to helpers. `Kernel.run()` in `src/runtime/Kernel.ts` owns stage iteration, while stage bodies call modules such as `runMemoryMigrations()`, `buildColonyContexts()`, `runProcessDefinitions()`, and `runSpawnLifecycle()`.

**Parameters:** Pass explicit context objects and plain data instead of reading globals inside lower-level modules. Examples: `runBootstrapExecution(contexts, memory, tick)` in `src/bootstrap/runner.ts`, `buildStrategyPlan(context, memory, tick, trigger)` in `src/strategy/planner.ts`, and `runCreepTask(creep, context)` in `src/tasks/executor.ts`.

**Return Values:** Prefer structured summaries and result records over side-effect-only functions. Examples: `BootstrapExecutionSummary` in `src/bootstrap/runner.ts`, `StrategyPlanningResult` in `src/strategy/runner.ts`, `ProcessRunResult` in `src/processes/types.ts`, and `SpawnValidationResult` in `src/spawning/runner.ts`.

**Guidelines:**
- Keep pure planning separate from execution. `src/strategy/planner.ts` creates persistent summaries and intents; `src/bootstrap/runner.ts`, `src/spawning/runner.ts`, and `src/tasks/executor.ts` mutate queues/tasks or call Screeps APIs.
- Keep migration repair helpers local to `src/memory/migrations.ts` unless another module needs the contract. `repairStrategyPlan()` is exported because other code can need that specific repair behavior.
- Use exhaustive `switch` for stable lifecycle or enum-like domains. `getDefaultStageRunner()` in `src/runtime/Kernel.ts` binds every `LifecycleStageName`.
- Keep command implementations data-driven. A namespace returns `CommandNamespaceDefinition` with `name`, `summary`, `effect`, and `commands`, as in `src/commands/namespaces/debug.ts` and `src/commands/namespaces/config.ts`.
- Validate untrusted command args before reading or mutating Memory. Use `src/commands/arguments.ts` and `src/validation/*`.

## Module Design

**Exports:** Export only stable contracts and tested helpers. Examples: `createDefaultCommandRegistry()` from `src/commands/registry.ts`, `createDefaultRoleRegistry()` from `src/roles/registry.ts`, `createDefaultProjectMemorySections()` from `src/memory/schema.ts`, and `runSpawnLifecycle()` from `src/spawning/runner.ts`.

**Barrel Files:** Not used. Import directly from the module that owns the contract, such as `commands/registry`, `memory/schema`, `runtime/Kernel`, or `spawning/queue`.

**Boundaries:**
- `src/main.ts` is the runtime entry point only.
- `src/runtime/Kernel.ts` coordinates lifecycle stages and owns resilience policy.
- `src/runtime/services.ts` builds per-tick services such as `Logger`, `Profiler`, environment metadata, and CPU availability.
- `src/memory/schema.ts` owns persistent type shape and defaults; `src/memory/migrations.ts` owns repair and version transitions.
- `src/constants/` owns stable runtime strings and enum-like values; use these instead of ad hoc literals in feature modules.
- `src/commands/` owns console API shape, formatting, history, installation, and namespace behavior.
- `src/strategy/` owns planning and policy only; it does not call Screeps action APIs.
- `src/bootstrap/`, `src/spawning/`, `src/tasks/`, and `src/roles/` own execution primitives and Memory-backed state machines.
- `src/validation/` owns reusable validation result patterns.

---

*Convention analysis: 2026-05-07*
