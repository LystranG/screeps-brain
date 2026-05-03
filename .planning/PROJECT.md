# lystran-brain

## What This Is

lystran-brain is a TypeScript Screeps World control system built on the existing Screeps TypeScript starter. The project will turn the current starter loop into a modular, extensible automation framework with clear runtime infrastructure, colony abstractions, strategy planning, command controls, and an eventual single-room bootstrap loop.

The initial work focuses on foundations first: low-coupling, high-cohesion modules, typed persistent memory, observability, environment detection, simulation support, and extensible command and decision systems. Gameplay automation is built on top of those foundations rather than embedded directly in `src/main.ts`.

## Core Value

The system must provide a maintainable, extensible Screeps control architecture where long-term automation can grow safely from a tested, observable, low-coupling foundation.

## Requirements

### Validated

- ✓ TypeScript/Rollup Screeps starter builds from `src/main.ts` into Screeps-compatible CommonJS output - existing
- ✓ Screeps deployment destinations are configured through `rollup.config.js`, `package.json` scripts, and local `screeps.json` - existing
- ✓ Unit test scaffold exists with Mocha, Chai, `ts-node`, and mocked Screeps globals under `test/unit/` - existing
- ✓ Source-map based loop error wrapper exists in `src/utils/ErrorMapper.ts` - existing
- ✓ Codebase map exists under `.planning/codebase/` and documents stack, architecture, structure, conventions, testing, integrations, and concerns - existing

### Active

- [ ] Replace starter loop behavior with a thin runtime entry that delegates to a kernel lifecycle.
- [ ] Establish runtime infrastructure: memory schema/migrations, environment detection, logger, lightweight profiler, cache, and error boundaries.
- [ ] Keep deep profiling optional through a `screeps-profiler` adapter while retaining a default low-overhead profiler abstraction.
- [ ] Centralize stable string constants for shard names, environment names, memory keys, role names, process names, and command paths.
- [ ] Add typed room/shard/environment helpers, including `Game.shard.name === "sim"` simulation detection and room name validation.
- [ ] Create a simulation bootstrapper that initializes memory and bot-created setup artifacts in fresh sim environments while clearly reporting objects normal runtime code cannot create.
- [ ] Introduce colony and room abstractions that aggregate room state without coupling behavior modules directly to global scans.
- [ ] Introduce process, task, role, spawn queue, and body builder abstractions before implementing gameplay logic.
- [ ] Add a tree-shaped console command system exposed through `global.cmd` for status, configuration, strategy, simulation, spawn, and debug commands.
- [ ] Add a strategy planning layer for long-term colony decisions that produces explainable plans and respects manual policy controls.
- [ ] Build a later minimal RCL1 bootstrap loop on top of the foundation: discover owned room state, maintain worker creeps, harvest energy, and upgrade the controller.
- [ ] Expand tests to cover memory migration, environment detection, sim bootstrap behavior, command dispatch, spawn queue ordering, body building, and process scheduling.

### Out of Scope

- Full autonomous multi-room empire management - deferred until the foundation and single-room bootstrap loop are stable.
- Fully automatic claiming or expansion into new rooms - high-cost strategic decisions should require explicit policy or command approval at this stage.
- Fully automatic warfare, market trading, lab reactions, power creeps, and cross-shard behavior - advanced systems are not part of the initial architecture milestone.
- Large-scale wall and rampart automation by default - defensive construction can be planned, but high-cost fortification must be policy-controlled.
- Direct runtime creation of Screeps world objects that the normal API cannot create, such as sources, spawn structures, or initial creeps in a fresh simulator - handled by explicit user setup guidance or test harnesses instead.
- Rewriting the project around Overmind or adopting its full architecture - Overmind is a reference for patterns, not the project identity or implementation target.

## Context

The repository is currently the Screeps TypeScript starter. It uses TypeScript 4.8, Rollup 2, `rollup-plugin-screeps`, Mocha/Chai tests, and a single exported `loop` in `src/main.ts`. The existing code only logs the tick and removes dead creep memory. The codebase map identifies this as a starter scaffold that needs core abstractions before serious gameplay behavior is added.

The intended architecture borrows selected ideas from mature Screeps projects, especially Overmind's separation of colony context, process-like ownership of behavior, tasks, spawn coordination, caching, and profiling. Those ideas should be adapted into a smaller project-specific architecture rather than copied wholesale.

Screeps runtime constraints drive the design. `Game` is volatile and reconstructed each tick, while `Memory` persists and must be versioned. Live game objects should not be stored in `Memory`; stable IDs and serializable state should be stored instead. CPU is a hard gameplay constraint, so observability and profiling must exist before complex behavior grows.

The user expects to test frequently in the official simulation environment before running in live rooms. The sim environment can be detected with `Game.shard.name === "sim"`. Fresh sim environments may contain only a room controller and lack sources, spawns, and creeps. Runtime code should perform only API-permitted setup, initialize memory, and provide clear guidance or command support for objects that require manual setup or a test harness.

The project should support manual control without undermining automation. Console commands should be available through an extensible tree-shaped `global.cmd` API for status inspection, configuration, strategy explanation, simulation setup, and safe one-off actions. Commands should route through registries and handlers instead of bypassing the core systems.

Long-term colony decisions should use a semi-automatic strategy layer. Low-risk tactical work should run automatically, while expensive, high-risk, or strategic actions such as large fortification, remote mining, expansion, market automation, and war should require policy flags or explicit commands.

## Constraints

- **Tech stack**: Continue using the TypeScript/Rollup Screeps starter unless a later phase proves a change is necessary - this preserves the current working build and deployment flow.
- **Runtime**: Screeps code executes inside the per-tick game loop and must keep CPU usage visible and bounded - long-running or expensive behavior needs profiling and cadence controls.
- **Persistence**: Screeps `Memory` is persistent JSON state and must be schema-versioned - new persistent structures require migration and tests.
- **Simulation**: Official sim detection uses `Game.shard.name === "sim"` - sim-specific behavior must be isolated behind environment/bootstrap modules.
- **API limits**: Bot runtime code cannot create sources, spawn structures, or arbitrary initial creeps - sim setup must separate API-permitted initialization from external/manual world seeding.
- **Secrets**: `screeps.json` contains credentials and must remain ignored and unread by runtime code - deployment safety is part of the infrastructure baseline.
- **Maintainability**: New code should be low-coupling and high-cohesion - modules should depend on abstractions such as context, services, plans, and queues rather than global scans where practical.
- **Extensibility**: Stable strings for shards, environments, roles, processes, commands, and memory keys should be centralized - business logic should not hardcode these values ad hoc.
- **Manual control**: Human commands should modify policies, request plans, or enqueue safe actions - commands should not bypass core scheduling and execution layers except for explicit debug utilities.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Project name is `lystran-brain` | Avoids confusing the project with Overmind while still allowing selective architectural inspiration | — Pending |
| Build foundations before the minimal RCL1 loop | Framework-first development keeps gameplay behavior from becoming tightly coupled to `main.ts` | — Pending |
| Keep `src/main.ts` as a thin runtime entry | The entry point should delegate to a kernel lifecycle and remain easy to reason about | — Pending |
| Use a default lightweight profiler plus optional `screeps-profiler` adapter | Everyday observability should be low overhead; deep function-level profiling should be opt-in | — Pending |
| Detect official simulator with `Game.shard.name === "sim"` | User-tested detection is direct and avoids relying only on room naming side effects | — Pending |
| Treat sim bootstrap as idempotent and API-bounded | Fresh sim setup should be useful without pretending runtime code can create non-creatable world objects | — Pending |
| Use semi-automatic long-term strategy | Tactical behavior can be automated, but high-cost or risky decisions need policy controls | — Pending |
| Expose manual operations through a tree-shaped `global.cmd` command system | Commands need to scale by namespace and stay routed through explicit handlers | — Pending |
| Centralize stable strings and validate room names | Constants and validators reduce hidden coupling and typo-driven runtime failures | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-03 after initialization*
