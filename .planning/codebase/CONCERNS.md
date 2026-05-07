# Codebase Concerns

**Analysis Date:** 2026-05-07

**Scope:** `src`

## Tech Debt

**Memory migration repetition:**
- Issue: Each migration rebuilds the same nested `runtime`, `config`, `stats`, `commands`, `processes`, and `creeps` sections with large spread blocks.
- Files: `src/memory/migrations.ts`, `src/memory/schema.ts`
- Impact: Adding `CURRENT_MEMORY_VERSION` fields requires editing every active migration block. A missing nested merge can silently reset user policy, observability, process state, or queue state.
- Fix approach: Extract section-level repair helpers such as `repairRuntimeMemory`, `repairConfigMemory`, `repairStatsMemory`, and `repairCommandsMemory`; keep version functions focused on version-specific changes.

**Migration executes current-version repair on every tick:**
- Issue: `runMemoryMigrations` always calls `orderedMigrations[CURRENT_MEMORY_VERSION](memory)` after catching up, even when `memory.version` already equals `CURRENT_MEMORY_VERSION`.
- Files: `src/memory/migrations.ts`
- Impact: Every tick rewrites core Memory sections and scans all colonies and spawn queues. The repair behavior is useful after manual edits, but it adds constant per-tick Memory churn and CPU cost.
- Fix approach: Gate full repair behind a dirty/validation failure signal or a low-frequency maintenance cadence; keep cheap version check in the normal tick path.

**Spawn queue terminal records are only pruned for bootstrap slot prefixes:**
- Issue: `removeTerminalSlotRequests` removes terminal `spawned` and `failed` requests only when a matching bootstrap slot is processed.
- Files: `src/bootstrap/spawnDemand.ts`, `src/spawning/queue.ts`, `src/spawning/runner.ts`
- Impact: Non-bootstrap requests and obsolete bootstrap slots can remain in `Memory.colonies[roomName].spawnQueue` indefinitely. Large queues increase selection scans, migration repair scans, debug output size, and Memory usage.
- Fix approach: Add a generic queue compaction policy by status and age, for example prune `spawned`/`failed` records after a retention window while preserving a small recent history.

**Kernel rebuilds colony contexts twice per tick:**
- Issue: The kernel calls `buildColonyContexts` once in `runColoniesAndProcesses` and again in `runSpawning`.
- Files: `src/runtime/Kernel.ts`, `src/colony/context.ts`, `src/colony/intel.ts`
- Impact: Room scans run twice in one tick, including `room.find(FIND_MY_SPAWNS)`, `room.find(FIND_SOURCES)`, `room.find(FIND_MY_CREEPS)`, `room.find(FIND_MY_CONSTRUCTION_SITES)`, and `room.find(FIND_HOSTILE_CREEPS)`.
- Fix approach: Build contexts once after environment/bootstrap, pass the same immutable tick context through processes and spawning, and keep persistence behavior explicit.

**Future-facing logistics demands are modeled but not executed:**
- Issue: Bootstrap slots include `pickup`, `transfer`, and `refill` logistics demand objects, while task assignment only accepts `harvest` and `upgrade`.
- Files: `src/bootstrap/slots.ts`, `src/bootstrap/taskAssignment.ts`, `src/tasks/executor.ts`
- Impact: The data model suggests logistics coverage exists, but runtime assignment ignores it. Future code can accidentally assume refill/transfer demands are active.
- Fix approach: Either implement logistics assignment end to end or separate future-only intent fields from executable demand fields with names that make non-execution explicit.

**Strategy planning remains explanatory rather than executable:**
- Issue: `buildStrategyPlan` persists priorities, intents, deferrals, and reasons, but executable bootstrap/spawn/task behavior does not consume those intents.
- Files: `src/strategy/planner.ts`, `src/strategy/runner.ts`, `src/bootstrap/runner.ts`, `src/processes/runner.ts`
- Impact: Commands can display strategy state that looks authoritative while actual behavior is driven by bootstrap-specific rules.
- Fix approach: Add a clear strategy-to-demand adapter or mark current strategy plans as inspection-only until execution paths consume them.

**Deep profiler adapter is recreated and wraps the loop every tick:**
- Issue: `createScreepsProfilerAdapter` is called inside `loop`, so the adapter instance and `didEnable` flag do not persist across ticks.
- Files: `src/main.ts`, `src/profiling/ScreepsProfilerAdapter.ts`
- Impact: When deep profiler is enabled, `enableOnce` only protects a single adapter instance. Runtime may call profiler enable/wrap repeatedly instead of using a stable global or module-level adapter.
- Fix approach: Keep one module-level adapter or global profiler state and update its enabled state from Memory through an explicit boundary.

## Known Bugs

**Potential real spawn name collision after request id truncation:**
- Symptoms: `createSpawnName` slices names to 100 characters. Distinct long request ids can collapse to the same creep name, causing `ERR_NAME_EXISTS`.
- Files: `src/spawning/runner.ts`
- Trigger: Two validated spawn requests in the same room/tick with long ids that share the first 100 sanitized characters.
- Workaround: Use shorter request ids. A code fix should include a bounded hash suffix before truncation.

**Finished spawning requests can remain stuck if the creep is not visible when checked:**
- Symptoms: `completeSpawnedRequests` returns `null` when `request.status === "spawning"` but `game.creeps[request.creepName]` is missing; there is no timeout or recovery path.
- Files: `src/spawning/runner.ts`, `src/spawning/queue.ts`
- Trigger: A creep name is lost, manually deleted, not visible due to mock/private-server behavior, or the spawning request state is manually edited.
- Workaround: Manually adjust the request status in Memory. A code fix should expire stale `spawning` requests or reconcile against `Game.spawns[spawnName].spawning`.

**Recoverable spawn waits have no retry limit:**
- Symptoms: Requests that repeatedly return `ERR_BUSY` or `ERR_NOT_ENOUGH_ENERGY` stay active without incrementing `attempts`.
- Files: `src/spawning/runner.ts`, `src/spawning/queue.ts`
- Trigger: A request body remains above available energy, all spawns stay busy, or energy never reaches the required level.
- Workaround: Remove or edit the request in Memory. A code fix should track wait age separately from fatal attempts.

## Security Considerations

**Debug dump can disclose sensitive Memory values placed by users or future code:**
- Risk: `cmd.debug.dump("Memory.config")` and `cmd.debug.dump("Memory.commands")` serialize whitelisted Memory sections into console output.
- Files: `src/commands/namespaces/debug.ts`, `src/commands/arguments.ts`, `src/commands/history.ts`
- Current mitigation: Dump paths are restricted to `Memory.runtime`, `Memory.config`, `Memory.stats`, and `Memory.commands`; output length is capped at 2000 characters.
- Recommendations: Keep credentials out of Memory; add redaction for key names containing `token`, `secret`, `password`, `credential`, and `key`; avoid dumping `Memory.commands` when `recordReadOnly` is enabled.

**Command history stores arguments for mutating and confirmation commands:**
- Risk: `recordCommandHistory` persists stringified command arguments in `Memory.commands.history`.
- Files: `src/commands/history.ts`, `src/commands/arguments.ts`, `src/commands/namespaces/config.ts`
- Current mitigation: Only mutating/confirmation commands are recorded by default; object arguments are summarized with `Object.prototype.toString`.
- Recommendations: Treat command arguments as public runtime metadata. Redact suspicious string arguments and avoid adding commands that accept secrets.

**Console command surface mutates policy Memory without authentication inside code:**
- Risk: The `cmd` global exposes config toggles to whoever has Screeps console access.
- Files: `src/commands/installer.ts`, `src/commands/namespaces/config.ts`
- Current mitigation: High-risk toggles such as `deepProfiler`, `allowExpansion`, and `allowRemoteMining` require a `CONFIRM` argument.
- Recommendations: Keep high-impact actions behind confirmation, add dry-run/readback commands before destructive operations, and do not add world-changing commands that bypass scheduling layers.

**Source-mapped stack traces may include runtime data embedded in error messages:**
- Risk: `ErrorMapper.wrapLoop` logs mapped stack traces directly to the Screeps console.
- Files: `src/utils/ErrorMapper.ts`, `src/main.ts`
- Current mitigation: Stack output is HTML-escaped with `_.escape`.
- Recommendations: Avoid throwing errors containing secrets or large serialized Memory; use short operational error messages in runtime code.

## Performance Bottlenecks

**High-cost source map loading on first runtime error:**
- Problem: `sourceMappedStackTrace` documents first-call cost above 30 CPU after reset.
- Files: `src/utils/ErrorMapper.ts`
- Cause: Lazy `SourceMapConsumer(require("main.js.map"))` initialization and stack remapping run inside the Screeps tick.
- Improvement path: Keep source mapping useful during development, but allow disabling it or rate-limiting mapped output in production shards.

**Repeated room scans in context building:**
- Problem: Each call to `buildVolatileRoomIntel` performs five `room.find` calls per room.
- Files: `src/colony/context.ts`, `src/colony/intel.ts`, `src/runtime/Kernel.ts`
- Cause: Context building is repeated in separate kernel stages, and scans are not reused within the tick.
- Improvement path: Create a per-tick runtime context cache and pass it through process and spawn stages.

**Queue selection sorts all candidates each lifecycle phase:**
- Problem: `selectNextSpawnRequestByStatus` scans all colony queues and sorts candidates for `spawning`, `validated`, and `queued` paths.
- Files: `src/spawning/queue.ts`, `src/spawning/runner.ts`
- Cause: The lifecycle performs up to three independent queue selections per tick.
- Improvement path: Keep queues compact, select minimum candidate without full array sort, or compute queue indexes once per tick.

**Per-tick current-version migration repair scales with Memory size:**
- Problem: Migration repair traverses every colony and every spawn request even when schema is already current.
- Files: `src/memory/migrations.ts`, `src/runtime/Kernel.ts`
- Cause: The current migration function is used as both version migration and continuous repair.
- Improvement path: Split migration from validation/repair and run expensive repair only when needed.

**Deep profiler can materially increase tick overhead:**
- Problem: Enabling `Memory.config.observability.deepProfiler.enabled` loads `screeps-profiler`, enables it, and wraps the loop path.
- Files: `src/main.ts`, `src/profiling/ScreepsProfilerAdapter.ts`, `src/commands/namespaces/config.ts`
- Cause: Deep profiling is intentionally high-touch instrumentation of Screeps prototypes.
- Improvement path: Keep default disabled, retain `CONFIRM`, and add visibility in `Memory.stats` or command output when deep profiling is active.

## Fragile Areas

**Memory schema and migrations:**
- Files: `src/memory/schema.ts`, `src/memory/migrations.ts`
- Why fragile: `Memory` is persistent JSON and manually editable; schema interfaces do not validate all nested values at runtime. Several repairs cast unknown values back to typed objects after shallow checks.
- Safe modification: Add or change persistent fields through `CURRENT_MEMORY_VERSION`, defaults in `createDefaultProjectMemorySections`, versioned migration tests, and repair helpers. Do not store live Screeps objects in Memory.
- Test coverage: Unit coverage exists in `test/unit/memory.test.ts` and `test/unit/memorySchema.test.ts`; add tests for corrupted nested config, stale spawn queues, and invalid numeric values such as `NaN` or negative cadence.

**Spawn lifecycle state machine:**
- Files: `src/spawning/queue.ts`, `src/spawning/runner.ts`, `src/bootstrap/spawnDemand.ts`
- Why fragile: Queue state transitions are spread across multiple exported mutators. Some transitions use return objects, while `runValidatedSpawn` also mutates `selected.request.status` directly for fatal errors.
- Safe modification: Add transition-level tests before changing statuses. Prefer a single transition function that owns status, attempts, errors, and timestamps.
- Test coverage: Unit coverage exists in `test/unit/spawnPrimitives.test.ts`; add tests for stale `spawning`, long-name collisions, terminal cleanup, non-bootstrap requests, and indefinite recoverable waits.

**Bootstrap task assignment and executor coupling:**
- Files: `src/bootstrap/slots.ts`, `src/bootstrap/taskAssignment.ts`, `src/tasks/executor.ts`, `src/roles/registry.ts`
- Why fragile: Slot creation, task selection, role scoring, and action execution all need to agree on valid task types. Logistics fields already outpace executor support.
- Safe modification: Add a task type only after updating slot demand, assignment validation, executor handling, role behavior, and memory validation together.
- Test coverage: Unit coverage exists in `test/unit/bootstrapExecution.test.ts` and `test/unit/behaviorPrimitives.test.ts`; add coverage for logistics tasks before activating them.

**Command system and global installation:**
- Files: `src/commands/installer.ts`, `src/commands/registry.ts`, `src/commands/types.ts`, `src/commands/namespaces/config.ts`, `src/commands/namespaces/debug.ts`
- Why fragile: Commands are exposed via a Screeps global object that can outlive module reloads; versioning through `COMMAND_API_VERSION` must be updated whenever command closures or signatures change.
- Safe modification: Update `COMMAND_API_VERSION` for command tree shape changes, keep command effects accurate, and record mutating command history consistently.
- Test coverage: Unit coverage exists in `test/unit/commandCore.test.ts`, `test/unit/commandConfig.test.ts`, `test/unit/commandInspection.test.ts`, and `test/unit/commandInstall.test.ts`; add tests for redaction and high-risk command confirmation when new mutators are added.

**Environment and sim bootstrap boundary:**
- Files: `src/environment/detection.ts`, `src/environment/simBootstrap.ts`, `src/colony/context.ts`
- Why fragile: Sim behavior intentionally differs from world behavior. The code creates guidance flags but must not imply it can create sources, spawns, or initial creeps.
- Safe modification: Keep sim-only side effects behind `Game.shard.name === "sim"` detection and preserve guidance-only behavior for unsupported world setup.
- Test coverage: Unit coverage exists in `test/unit/environment.test.ts` and `test/unit/simBootstrap.test.ts`; add tests for private-server API differences before relying on non-official sim shapes.

## Scaling Limits

**Single-room bootstrap assumptions:**
- Current capacity: Bootstrap population target is capped at 4 creeps per ready room.
- Limit: `calculateTargetPopulation` and `buildBootstrapSlots` are tuned for early bootstrap, not multi-room mature automation.
- Scaling path: Promote target population, role mix, hauling, construction, defense, and expansion into strategy-driven room policies.
- Files: `src/bootstrap/slots.ts`, `src/bootstrap/spawnDemand.ts`, `src/strategy/planner.ts`

**Command history retention is count-limited, not size-limited:**
- Current capacity: `COMMAND_HISTORY_LIMIT` limits number of records.
- Limit: Long string arguments can still grow Memory within the count cap.
- Scaling path: Add per-argument and per-record truncation plus redaction before push.
- Files: `src/commands/history.ts`, `src/constants/commands.ts`

**CPU summaries grow by stage name:**
- Current capacity: `Memory.stats.cpu.stages` stores one rolling summary per observed stage.
- Limit: Dynamic stage names would grow the map indefinitely.
- Scaling path: Keep stage names fixed constants and reject or normalize unknown names before writing stats.
- Files: `src/stats/Stats.ts`, `src/runtime/lifecycle.ts`, `src/memory/schema.ts`

## Dependencies at Risk

**`source-map` runtime dependency:**
- Risk: Source-map consumption is CPU-heavy in Screeps and depends on `main.js.map` being bundled and available through `require`.
- Impact: Error handling can become the most expensive tick work after reset.
- Migration plan: Keep `ErrorMapper` behind an environment/config switch or use unmapped stacks for production shards.
- Files: `src/utils/ErrorMapper.ts`

**`screeps-profiler` optional runtime dependency:**
- Risk: The adapter requires `screeps-profiler` only when deep profiling is enabled. Missing or incompatible profiler code will fail the loop path after enabling.
- Impact: A confirmed config change can introduce runtime failures.
- Migration plan: Catch load failures, surface them in `Memory.runtime.migrationError` or observability status, and auto-disable deep profiler after a failed load.
- Files: `src/profiling/ScreepsProfilerAdapter.ts`, `src/main.ts`

**Screeps lodash global `_`:**
- Risk: `ErrorMapper` relies on global `_` for escaping rather than importing a local helper.
- Impact: Non-Screeps tests or private runtimes missing `_` can fail during error logging.
- Migration plan: Add a local escape helper or guarded fallback.
- Files: `src/utils/ErrorMapper.ts`

## Missing Critical Features

**No generic Memory validation command or runtime health report:**
- Problem: Migrations repair many shapes, but there is no command that validates current Memory and reports corrupt sections without mutating them.
- Blocks: Safe diagnosis after manual Memory edits or failed migrations.
- Files: `src/memory/migrations.ts`, `src/commands/namespaces/debug.ts`, `src/runtime/Kernel.ts`

**No spawn queue administrative cleanup command:**
- Problem: Operators cannot inspect and clear stale queue entries through a controlled command path.
- Blocks: Recovery from stuck `spawning`, failed terminal buildup, or bad manually queued requests.
- Files: `src/spawning/queue.ts`, `src/commands/namespaces/spawn.ts`, `src/commands/installer.ts`

**No CPU budget guard for process execution:**
- Problem: Processes run by cadence and priority, but no CPU bucket/limit check stops lower-priority work when CPU is constrained.
- Blocks: Safe scale-up to more rooms and more processes.
- Files: `src/processes/runner.ts`, `src/runtime/Kernel.ts`, `src/runtime/services.ts`

**No executable construction, repair, defense, expansion, or remote mining adapter:**
- Problem: Strategy intents describe these areas, but current runtime does not turn them into tasks or actions.
- Blocks: Moving beyond single-room bootstrap automation.
- Files: `src/strategy/planner.ts`, `src/bootstrap/runner.ts`, `src/tasks/executor.ts`

## Test Coverage Gaps

**Runtime CPU and repeated context scans:**
- What's not tested: The kernel's double `buildColonyContexts` cost and per-tick migration repair behavior are not guarded by performance-oriented tests.
- Files: `src/runtime/Kernel.ts`, `src/colony/context.ts`, `src/memory/migrations.ts`
- Risk: New stages can multiply room scans or Memory repairs unnoticed.
- Priority: Medium

**Spawn lifecycle edge recovery:**
- What's not tested: Name truncation collisions, stale `spawning` requests, age-based cleanup, and infinite recoverable wait loops.
- Files: `src/spawning/runner.ts`, `src/spawning/queue.ts`, `src/bootstrap/spawnDemand.ts`
- Risk: Spawn automation can stall while the rest of the kernel reports normal operation.
- Priority: High

**Security redaction for debug and command history:**
- What's not tested: Sensitive-looking strings in `Memory.config`, `Memory.commands.history`, or command arguments are not redacted.
- Files: `src/commands/namespaces/debug.ts`, `src/commands/history.ts`
- Risk: Future commands or manual Memory edits can leak secrets into console output.
- Priority: Medium

**Deep profiler failure modes:**
- What's not tested: Missing `screeps-profiler`, repeated enable/wrap behavior across ticks, and recovery after profiler load failure.
- Files: `src/main.ts`, `src/profiling/ScreepsProfilerAdapter.ts`
- Risk: Confirming deep profiler can break the main loop or add unexpected CPU overhead.
- Priority: Medium

**Task/logistics execution completeness:**
- What's not tested: Pickup, transfer, refill assignment from bootstrap logistics demand.
- Files: `src/bootstrap/slots.ts`, `src/bootstrap/taskAssignment.ts`, `src/tasks/executor.ts`
- Risk: Future logistics fields may be mistaken for active behavior.
- Priority: Medium

---

*Concerns audit: 2026-05-07*
