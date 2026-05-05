# Requirements: lystran-brain

**Defined:** 2026-05-03
**Core Value:** The system must provide a maintainable, extensible Screeps control architecture where long-term automation can grow safely from a tested, observable, low-coupling foundation.

## v1 Requirements

### Runtime Foundation

- [x] **RUN-01**: The Screeps exported `loop` delegates to a kernel lifecycle instead of containing gameplay logic directly.
- [x] **RUN-02**: The kernel executes a deterministic per-tick lifecycle covering memory migration, service refresh, environment/bootstrap checks, colony processing, spawning, cleanup, and stats flushing.
- [x] **RUN-03**: Runtime errors are handled through a top-level error boundary that preserves useful Screeps console diagnostics.
- [x] **RUN-04**: Starter per-tick console logging is replaced by controlled logger output.

### Memory And Configuration

- [x] **MEM-01**: The project defines a typed `Memory` schema with a version field and initialized top-level sections.
- [x] **MEM-02**: A migration runner safely upgrades empty or older memory states before gameplay systems run.
- [x] **MEM-03**: Persistent state stores serializable IDs and values rather than live Screeps objects.
- [x] **MEM-04**: Project configuration supports colony policy settings such as automation mode, construction permission, defense permission, and strategy mode.

### Constants And Types

- [x] **TYP-01**: Stable strings for shards, runtime environments, roles, processes, memory keys, command paths, and strategy modes are centralized in domain-specific constants.
- [x] **TYP-02**: Room name and shard/environment helpers validate values such as `sim`, `W1N1`, and `E2S7` before command or strategy use.
- [x] **TYP-03**: New architecture code avoids broad `any` for project-owned memory, command, service, and context interfaces.

### Observability

- [x] **OBS-01**: A logger service supports namespace, level, and sampling controls.
- [x] **OBS-02**: A lightweight profiler service measures named sections with `Game.cpu.getUsed()`.
- [x] **OBS-03**: A `screeps-profiler` adapter can be enabled for deep profiling without making default runtime profiling depend on it.
- [x] **OBS-04**: Runtime stats are structured so future dashboard/export integrations can consume them.

### Environment And Simulation

- [x] **ENV-01**: The runtime detects the official simulator with `Game.shard.name === "sim"`.
- [x] **ENV-02**: Environment detection exposes typed environment metadata for sim, world-like, private, and unknown contexts.
- [x] **SIM-01**: In a fresh sim environment, the system initializes memory and records idempotent sim bootstrap state.
- [x] **SIM-02**: Sim bootstrap performs only API-permitted setup, such as memory defaults, flags, or construction sites where possible.
- [x] **SIM-03**: When a sim environment lacks sources, spawns, or initial creeps that bot runtime code cannot create, the system reports clear setup guidance.
- [ ] **SIM-04**: When sim has the required room objects, the normal colony/bootstrap systems can proceed without a separate code path.

### Command System

- [x] **CMD-01**: The runtime exposes a stable `global.cmd` console entry point.
- [x] **CMD-02**: Commands are registered through a tree-shaped command registry with namespaces such as `env`, `sim`, `colony`, `strategy`, `config`, `spawn`, and `debug`.
- [x] **CMD-03**: `cmd.help()` and namespaced help list available commands and short descriptions.
- [x] **CMD-04**: Commands can inspect environment, colony status, configuration, strategy explanations, and profiler/debug state.
- [x] **CMD-05**: Commands can update policy/configuration through typed handlers that persist to `Memory.config`.
- [x] **CMD-06**: High-risk or state-changing commands route through policies, plans, or queues instead of bypassing core execution systems.

### Colony And Domain Model

- [x] **COL-01**: The system builds a `ColonyContext` for each owned room or detected sim colony candidate.
- [ ] **COL-02**: `ColonyContext` aggregates current room, controller, spawns, sources, creeps, construction sites, hostiles, and energy state.
- [x] **COL-03**: Room intel is cached separately from persistent memory and can be refreshed on a controlled cadence.
- [ ] **COL-04**: Domain modules use context/service abstractions instead of scanning global `Game` objects ad hoc.

### Behavior Framework

- [ ] **BEH-01**: A process abstraction owns focused behavior domains and can run against a `ColonyContext`.
- [x] **BEH-02**: A role registry maps creep memory role names to role runners without large conditional dispatch blocks.
- [x] **BEH-03**: A lightweight task abstraction represents a creep's current action and target ID.
- [x] **BEH-04**: A spawn queue accepts spawn requests with role, priority, body, memory, and reason metadata.
- [x] **BEH-05**: A body builder generates valid creep bodies from available room energy and requested role intent.

### Strategy

- [ ] **STR-01**: A strategy planner evaluates long-term colony stage and priorities on a configurable cadence instead of every tick.
- [ ] **STR-02**: Strategy plans include reason strings explaining decisions such as upgrading, building, repairing, defense preparation, or deferring work.
- [ ] **STR-03**: Low-risk tactical actions can run automatically while high-cost actions respect manual policy gates.
- [ ] **STR-04**: Expansion, large fortification, remote mining, market automation, and warfare remain disabled unless policy explicitly enables them.

### Minimal Bootstrap Loop

- [ ] **BOOT-01**: After the foundation exists, the system can discover a single owned room with controller, spawn, and source data.
- [ ] **BOOT-02**: The system can maintain a minimal worker population through the spawn queue.
- [ ] **BOOT-03**: Worker behavior can harvest energy and upgrade the controller through the role/task framework.
- [ ] **BOOT-04**: The minimal loop can run in sim or a normal room when required objects exist.

### Testing And Verification

- [x] **TEST-01**: Unit tests cover memory initialization and migrations from empty memory.
- [x] **TEST-02**: Unit tests cover environment detection, including `Game.shard.name === "sim"`.
- [x] **TEST-03**: Unit tests cover command tree parsing, help output, and configuration mutation.
- [x] **TEST-04**: Unit tests cover logger/profiler behavior without relying on live Screeps.
- [x] **TEST-05**: Unit tests cover colony context creation, spawn queue priority, and body builder output.
- [x] **TEST-06**: Build, lint, and unit tests provide the baseline verification gate for implementation phases.

## v2 Requirements

### Advanced Colony Automation

- **V2-COL-01**: The system supports multi-room colony management.
- **V2-COL-02**: The system supports remote mining with policy-controlled activation.
- **V2-COL-03**: The system supports advanced construction planning for roads, containers, storage, and extensions.

### Defense And Expansion

- **V2-DEF-01**: The system supports staged tower, rampart, and wall planning beyond early defensive basics.
- **V2-EXP-01**: The system can evaluate candidate expansion rooms and request human approval.
- **V2-CMB-01**: The system supports combat and war operations through explicit policies.

### Economy

- **V2-MKT-01**: The system supports market and terminal automation.
- **V2-LAB-01**: The system supports lab, mineral, and boost workflows.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Overmind clone | Overmind is an architectural reference, not the project target. |
| Full autonomous multi-room empire | Requires stable single-room foundation first. |
| Automatic expansion by default | High strategic cost and should require explicit policy approval. |
| Automatic warfare by default | High risk and outside initial infrastructure scope. |
| Automatic market trading by default | Can spend resources/credits incorrectly without mature strategy. |
| Runtime creation of sources/spawns/initial creeps | Normal Screeps bot code cannot create these objects directly. |
| Large-scale walls/ramparts by default | Expensive and should be policy-controlled. |

## Traceability

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
| SIM-04 | Phase 5 | Pending |
| CMD-01 | Phase 3 | Complete |
| CMD-02 | Phase 3 | Complete |
| CMD-03 | Phase 3 | Complete |
| CMD-04 | Phase 3 | Complete |
| CMD-05 | Phase 3 | Complete |
| CMD-06 | Phase 3 | Complete |
| COL-01 | Phase 4 | Complete |
| COL-02 | Phase 4 | Pending |
| COL-03 | Phase 4 | Complete |
| COL-04 | Phase 4 | Pending |
| BEH-01 | Phase 4 | Pending |
| BEH-02 | Phase 4 | Complete |
| BEH-03 | Phase 4 | Complete |
| BEH-04 | Phase 4 | Complete |
| BEH-05 | Phase 4 | Complete |
| STR-01 | Phase 5 | Pending |
| STR-02 | Phase 5 | Pending |
| STR-03 | Phase 5 | Pending |
| STR-04 | Phase 5 | Pending |
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
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-05 after Phase 2 verification*
