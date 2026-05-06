# Roadmap: lystran-brain

**Created:** 2026-05-03
**Granularity:** Coarse
**Core Value:** The system must provide a maintainable, extensible Screeps control architecture where long-term automation can grow safely from a tested, observable, low-coupling foundation.

## Overview

This roadmap builds lystran-brain from the existing Screeps TypeScript starter into a modular control system. It intentionally separates the foundation from gameplay behavior: first establish the runtime and infrastructure, then add command/control, then domain and behavior abstractions, then strategy, and finally a minimal RCL1 bootstrap loop.

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Runtime and Memory Foundation | Replace starter loop with a tested kernel, typed memory, constants, and baseline verification. | RUN-01, RUN-02, RUN-03, RUN-04, MEM-01, MEM-02, MEM-03, TYP-01, TYP-02, TYP-03, TEST-01, TEST-06 |
| 2 | Observability and Environment Infrastructure | Add logger, profiler, stats, environment detection, and sim bootstrap infrastructure. | MEM-04, OBS-01, OBS-02, OBS-03, OBS-04, ENV-01, ENV-02, SIM-01, SIM-02, SIM-03, TEST-02, TEST-04 |
| 3 | Console Command System | Complete 2026-05-05 — safe manual control and inspection through a scalable console command tree verified. | CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06, TEST-03 |
| 4 | Colony and Behavior Primitives | Complete 2026-05-05 — colony context, room intel, process, role, task, spawn queue, body builder, read-only commands, and kernel wiring verified. | COL-01, COL-02, COL-03, COL-04, BEH-01, BEH-02, BEH-03, BEH-04, BEH-05, TEST-05 |
| 5 | Strategy and Policy Planning | In progress 2026-05-06 — Memory constants foundation complete; explainable strategy planning remains underway. | STR-01, STR-02, STR-03, STR-04, SIM-04 |
| 6 | Minimal RCL1 Bootstrap Loop | Use the foundation to maintain workers, harvest energy, and upgrade a controller in sim or a normal room. | BOOT-01, BOOT-02, BOOT-03, BOOT-04 |

## Phase Details

## Phase 1: Runtime and Memory Foundation

**Status:** Complete — verified 2026-05-03 with 32/32 must-haves passing.

**Goal:** Replace the starter's direct loop logic with a maintainable runtime foundation and typed persistent state.

**Requirements:** RUN-01, RUN-02, RUN-03, RUN-04, MEM-01, MEM-02, MEM-03, TYP-01, TYP-02, TYP-03, TEST-01, TEST-06

**Success Criteria:**
1. `src/main.ts` delegates to a kernel entry point and no longer owns gameplay behavior directly.
2. Kernel lifecycle order is explicit and unit-testable.
3. Empty `Memory` initializes into a typed schema with a version field.
4. Migrations run before other systems and are covered by tests.
5. Stable constants and validators exist for shard, environment, role, process, memory, command, and room-name concepts.
6. `npm run build`, `npm run lint`, and `npm test` are the baseline verification commands for this phase.

**Implementation Notes:**
- Consult `https://docs.screeps.com/api/` for `Game`, `Memory`, and runtime object semantics.
- Keep `ErrorMapper` as the top-level wrapper unless a phase-specific implementation proves a safer alternative.
- Do not introduce gameplay automation in this phase beyond preserving safe cleanup behavior if needed.

## Phase 2: Observability and Environment Infrastructure

**Status:** Complete — verified 2026-05-05 with 16/16 must-haves passing.

**Goal:** Make runtime behavior visible and environment-aware before complex automation is added.

**Requirements:** MEM-04, OBS-01, OBS-02, OBS-03, OBS-04, ENV-01, ENV-02, SIM-01, SIM-02, SIM-03, TEST-02, TEST-04

**Success Criteria:**
1. Logger supports namespace, level, and sampling controls.
2. Lightweight profiler measures named sections with `Game.cpu.getUsed()`.
3. Optional `screeps-profiler` adapter can be enabled without coupling ordinary modules to profiler-specific APIs.
4. Environment detection classifies sim using `Game.shard.name === "sim"`.
5. Fresh sim environments initialize memory idempotently and record bootstrap state.
6. Sim bootstrap reports clear guidance for missing sources, spawns, or initial creeps that normal runtime code cannot create.

**Implementation Notes:**
- Default profiler must remain low overhead.
- `screeps-profiler` should be a debug/deep profiling adapter, not a mandatory dependency path.
- Simulation bootstrap must not pretend the normal Screeps API can create non-creatable world objects.

## Phase 3: Console Command System

**Status:** Complete — verified 2026-05-05 with 14/14 must-haves passing.

**Goal:** Provide safe manual control and inspection through a scalable console command tree.

**Requirements:** CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06, TEST-03

**Plans:** 5/5 plans complete

Plans:
- [x] 03-01-PLAN.md — Build command core contracts, formatter, validators, history, and registry.
- [x] 03-02-PLAN.md — Add read-only env/sim/debug namespaces and future blocked entries.
- [x] 03-03-PLAN.md — Add explicit typed config mutation commands with confirmation gates.
- [x] 03-04-PLAN.md — Install versioned `global.cmd` and wire it into the Kernel lifecycle.
- [x] 03-05-PLAN.md — Close the CMD-05 config namespace persistence gap for prototype-reserved keys.

**Success Criteria:**
1. `global.cmd` is installed and stable across ticks.
2. Commands are organized under namespaces such as `env`, `sim`, `colony`, `strategy`, `config`, `spawn`, and `debug`.
3. `cmd.help()` and namespace help show available commands and concise descriptions.
4. Read-only commands can inspect environment, colony, strategy, config, and profiler/debug state.
5. Mutating commands update `Memory.config`, policies, plans, or queues through typed handlers.
6. Commands do not bypass the spawn queue, strategy policy gates, or core execution framework except for explicitly marked debug commands.

**Implementation Notes:**
- Design the registry so later commands can be added without modifying a monolithic global object.
- Command names and paths should use centralized constants.
- Use typed argument parsing and validation for room names and strategy modes.

## Phase 4: Colony and Behavior Primitives

**Status:** Complete — gap closure completed 2026-05-06; ready for re-verification.

**Goal:** Establish the domain abstractions needed to add behavior without coupling modules to global scans or one-off role logic.

**Requirements:** COL-01, COL-02, COL-03, COL-04, BEH-01, BEH-02, BEH-03, BEH-04, BEH-05, TEST-05

**Plans:** 6/6 plans complete

Plans:
- [x] 04-01-PLAN.md — Add typed Memory and constants foundation for Phase 4 primitives.
- [x] 04-02-PLAN.md — Create colony context and room intel primitives without behavior execution.
- [x] 04-03-PLAN.md — Add process, role, and task primitives with cadence-aware runner and no-op role skeletons.
- [x] 04-04-PLAN.md — Add spawn queue, body builder, and dry-run validation primitives.
- [x] 04-05-PLAN.md — Wire Phase 4 primitives into Kernel and expose read-only colony/spawn command inspection.
- [x] 04-06-PLAN.md — Close Memory colony repair and spawn validation starvation verifier gaps.

**Success Criteria:**
1. The system can build a `ColonyContext` for each owned room or sim candidate.
2. Colony context exposes room, controller, spawns, sources, creeps, construction sites, hostiles, and energy state.
3. Room intel uses volatile cache and controlled refresh cadence.
4. Behavior processes run against context and services rather than ad hoc global scans.
5. Role registry, task abstraction, spawn queue, and body builder exist with unit tests.
6. Spawn requests include role, priority, body, memory, and reason metadata.

**Implementation Notes:**
- Do not implement the full gameplay loop until these primitives are tested.
- Store object IDs in persistent state and resolve live objects through current tick context.
- Body builder should start simple and be easy to extend by role and available energy.

## Phase 5: Strategy and Policy Planning

**Status:** In Progress — 1/5 plans complete as of 2026-05-06.

**Goal:** Add explainable long-term decision support while preserving human control over expensive or risky actions.

**Requirements:** STR-01, STR-02, STR-03, STR-04, SIM-04

**Success Criteria:**
1. Strategy planner evaluates colony stage and priorities on a cadence, not every tick.
2. Strategy output includes reason strings for upgrade, construction, repair, defense, and deferral decisions.
3. Low-risk tactical actions can be automated through policy defaults.
4. Expansion, large fortification, remote mining, market automation, and warfare remain disabled unless policy enables them.
5. Sim environments with required objects can proceed through normal colony and strategy paths.

**Implementation Notes:**
- Strategy should produce plans/intents, not directly manipulate creeps.
- Keep the initial strategy conservative and explainable.
- Add command hooks for inspecting and adjusting strategy policies.

## Phase 6: Minimal RCL1 Bootstrap Loop

**Goal:** Prove the architecture by running a minimal single-room loop that maintains workers, harvests energy, and upgrades a controller.

**Requirements:** BOOT-01, BOOT-02, BOOT-03, BOOT-04

**Success Criteria:**
1. The system discovers a single owned room with controller, spawn, and source data.
2. Spawn queue maintains a minimal worker population.
3. Worker role/task behavior harvests energy and upgrades the controller.
4. The loop runs through the same kernel, colony, strategy, process, role, task, and spawn abstractions built earlier.
5. The loop works in sim or a normal room when the required Screeps objects exist.

**Implementation Notes:**
- This phase validates architecture, not final gameplay intelligence.
- Keep behavior minimal: do not add advanced construction, defense, remote mining, or expansion here.
- If official sim lacks required world objects, use the sim guidance from Phase 2 or a test harness.

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUN-01 | Phase 1 | Validated |
| RUN-02 | Phase 1 | Validated |
| RUN-03 | Phase 1 | Validated |
| RUN-04 | Phase 1 | Validated |
| MEM-01 | Phase 1 | Validated |
| MEM-02 | Phase 1 | Validated |
| MEM-03 | Phase 1 | Validated |
| MEM-04 | Phase 2 | Validated |
| TYP-01 | Phase 1 | Validated |
| TYP-02 | Phase 1 | Validated |
| TYP-03 | Phase 1 | Validated |
| OBS-01 | Phase 2 | Validated |
| OBS-02 | Phase 2 | Validated |
| OBS-03 | Phase 2 | Validated |
| OBS-04 | Phase 2 | Validated |
| ENV-01 | Phase 2 | Validated |
| ENV-02 | Phase 2 | Validated |
| SIM-01 | Phase 2 | Validated |
| SIM-02 | Phase 2 | Validated |
| SIM-03 | Phase 2 | Validated |
| SIM-04 | Phase 5 | Complete |
| CMD-01 | Phase 3 | Complete |
| CMD-02 | Phase 3 | Complete |
| CMD-03 | Phase 3 | Complete |
| CMD-04 | Phase 3 | Complete |
| CMD-05 | Phase 3 | Complete |
| CMD-06 | Phase 3 | Complete |
| COL-01 | Phase 4 | Complete |
| COL-02 | Phase 4 | Complete |
| COL-03 | Phase 4 | Complete |
| COL-04 | Phase 4 | Complete |
| BEH-01 | Phase 4 | Complete |
| BEH-02 | Phase 4 | Complete |
| BEH-03 | Phase 4 | Complete |
| BEH-04 | Phase 4 | Complete |
| BEH-05 | Phase 4 | Complete |
| STR-01 | Phase 5 | Complete |
| STR-02 | Phase 5 | Complete |
| STR-03 | Phase 5 | Complete |
| STR-04 | Phase 5 | Complete |
| BOOT-01 | Phase 6 | Pending |
| BOOT-02 | Phase 6 | Pending |
| BOOT-03 | Phase 6 | Pending |
| BOOT-04 | Phase 6 | Pending |
| TEST-01 | Phase 1 | Validated |
| TEST-02 | Phase 2 | Validated |
| TEST-03 | Phase 3 | Complete |
| TEST-04 | Phase 2 | Validated |
| TEST-05 | Phase 4 | Complete |
| TEST-06 | Phase 1 | Validated |

**Coverage:**
- v1 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

---
*Roadmap created: 2026-05-03*
*Last updated: 2026-05-05 after Phase 2 verification*
