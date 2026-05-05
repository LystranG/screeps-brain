---
phase: 04-colony-and-behavior-primitives
plan: 02
subsystem: colony
tags: [screeps, typescript, colony-context, room-intel, memory, tdd]

requires:
  - phase: 04-colony-and-behavior-primitives
    provides: Memory v3 colony config and intel schema from 04-01
provides:
  - Live per-tick ColonyContext contracts for owned and sim candidate rooms
  - Centralized room intel scans for spawns, sources, creeps, construction, hostiles, energy, and controller facts
  - Conservative persistent colony intel summaries with fact-change/cadence throttling
  - Deterministic primary colony selection with optional read-only persistence controls
affects: [04-colony-and-behavior-primitives, colony, room-intel, processes, commands, spawning]

tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN commits for colony primitives
    - volatile live object context plus conservative serialized Memory summary
    - deterministic primary-first context ordering

key-files:
  created:
    - src/colony/types.ts
    - src/colony/intel.ts
    - src/colony/context.ts
    - .planning/phases/04-colony-and-behavior-primitives/04-02-SUMMARY.md
  modified:
    - test/unit/colonyContext.test.ts
    - test/unit/mock.ts
    - graphify-out/GRAPH_REPORT.md
    - graphify-out/graph.json
    - graphify-out/graph.html

key-decisions:
  - "ColonyContext exposes live per-tick Screeps objects, while Memory.colonies stores only IDs, stage/status facts, reasons, and ticks."
  - "Primary colony selection accepts a valid configured room, otherwise falls back deterministically by sorted visible candidate room name."
  - "Console/read-only callers can pass persistPrimary: false and persistIntel: false to inspect current context without config or Memory side effects."

patterns-established:
  - "Build context from centralized volatile intel rather than ad hoc scans in downstream modules."
  - "Represent missing controller/spawn/source as degraded context reasons instead of throwing."
  - "Throttle persistent room intel by stable fact signature or configured cadence."

requirements-completed: [COL-01, COL-02, COL-03, COL-04, TEST-05]

duration: 20min
completed: 2026-05-05
---

# Phase 04 Plan 02: Colony Context and Room Intel Summary

**Live colony context and room intel primitives with deterministic primary selection and conservative Memory persistence**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-05T15:28:05Z
- **Completed:** 2026-05-05T15:47:47Z
- **Tasks:** 3 completed
- **Files modified:** 6 code/test files plus graphify artifacts and this summary

## Accomplishments

- Added `ColonyContext`, `VolatileRoomIntel`, readiness, energy, stage, and build-result type contracts.
- Implemented centralized room intel scanning through `Room.find` and separated volatile live facts from serialized colony intel.
- Implemented fact-change/cadence based persistent intel updates into `Memory.colonies`.
- Implemented `buildColonyContexts` for owned rooms and official sim candidate rooms, including degraded missing-object reasons.
- Added deterministic primary selection from `Memory.config.colony.primaryRoomName` with sorted fallback and read-only persistence options.

## Task Commits

1. **Task 1 RED: Define colony context and intel type tests** - `989158c` (test)
2. **Task 1 GREEN: Define colony context and intel types** - `efba437` (feat)
3. **Task 2 RED: Add room intel tests** - `7d41cb2` (test)
4. **Task 2 GREEN: Implement room intel persistence** - `e82e61e` (feat)
5. **Task 3 RED: Add colony context builder tests** - `e8a766b` (test)
6. **Task 3 GREEN: Implement colony context builder** - `b5dd49a` (feat)
7. **Refactor: Sort colony primitive imports** - `d525918` (refactor)

**Plan metadata:** included in final docs commit

## Files Created/Modified

- `src/colony/types.ts` - Defines live colony context, volatile intel, readiness, energy, stage, and build result contracts.
- `src/colony/intel.ts` - Builds volatile room intel and persists conservative colony intel on fact changes or cadence.
- `src/colony/context.ts` - Discovers candidate rooms, selects primary colony, builds ready/degraded/error contexts, and optionally persists primary/intel.
- `test/unit/colonyContext.test.ts` - Covers type contracts, room intel scanning/persistence, primary selection, sim degradation, and persistence options.
- `test/unit/mock.ts` - Adds minimal Screeps find/structure constants and mock room factory for room-intel tests.
- `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`, `graphify-out/graph.html` - Updated project graph after code changes.

## Decisions Made

- Persistent intel signatures ignore `lastSeenTick` and `lastRefreshTick`; those ticks are write metadata and should not independently trigger Memory churn.
- Sim rooms are accepted as candidate contexts even when missing controller, spawn, or source data, matching official sim bootstrap constraints.
- Context build errors are isolated per room into `readiness: "error"` contexts and an `errors` array, while ordinary missing world objects produce degraded contexts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added minimal Screeps constants to unit mocks**
- **Found during:** Task 2 (Build volatile intel and persistent intel summaries)
- **Issue:** New room intel tests and implementation use Screeps constants such as `FIND_MY_SPAWNS`, `FIND_SOURCES`, `FIND_HOSTILE_CREEPS`, and `STRUCTURE_SPAWN`; the existing unit harness did not define them at runtime.
- **Fix:** Added a minimal constants bootstrap in `test/unit/mock.ts` and corrected the persistence test fixture so unchanged intel compares against existing Memory.
- **Files modified:** `test/unit/mock.ts`, `test/unit/colonyContext.test.ts`
- **Verification:** `rtk npm run test-unit -- --grep "colony context|room intel"` passed.
- **Committed in:** `e82e61e`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** The fix was limited to test infrastructure required by the planned Screeps room scan APIs. It did not add behavior execution or expand gameplay scope.

## Issues Encountered

- Initial lint verification reported import-order warnings in the new colony modules. A refactor commit sorted imports and `rtk npm run lint` then passed with no warnings.

## Verification

- `rtk npm run test-unit -- --grep "colony context|room intel"` - PASS, 6 passing
- `rtk npm run lint` - PASS
- `rtk npm run build` - PASS, Rollup dry-run build created `dist/main.js`
- Task acceptance `rg` checks for `ColonyContext`, `VolatileRoomIntel`, `missingReasons`, `energy`, `buildVolatileRoomIntel`, `Room.find` constants, `shouldPersistIntel`, `lastRefreshTick`, `buildColonyContexts`, options, `primaryRoomName`, missing reasons, and `game.rooms` - PASS
- `rtk graphify update .` - PASS, graph rebuilt with 215 nodes and 274 edges

## Known Stubs

None - no placeholder UI/data stubs were introduced. Empty arrays and null checks in colony primitives represent valid no-object room states and degraded sim contexts.

## Threat Flags

None - the plan's trust boundaries covered live `Game.rooms` to `ColonyContext` and volatile intel to `Memory.colonies` summaries. No network endpoints, auth paths, file access paths, or schema trust boundaries were added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04-03 can consume `buildColonyContexts`, `ColonyContext`, and persistent colony intel to implement process, role, and task primitives without spreading direct `Game.rooms` scans into behavior modules.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/04-colony-and-behavior-primitives/04-02-SUMMARY.md`
- Commits found: `989158c`, `efba437`, `7d41cb2`, `e82e61e`, `e8a766b`, `b5dd49a`, `d525918`
- Verification commands passed after final implementation and refactor.

---
*Phase: 04-colony-and-behavior-primitives*
*Completed: 2026-05-05*
