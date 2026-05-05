---
phase: 04-colony-and-behavior-primitives
plan: 04
subsystem: spawning
tags: [screeps, typescript, spawn-queue, body-builder, dry-run, tdd]

requires:
  - phase: 04-colony-and-behavior-primitives
    provides: Memory v3 spawn queue schema and role constants from 04-01
  - phase: 04-colony-and-behavior-primitives
    provides: ColonyContext contracts and primary colony ordering from 04-02
provides:
  - Intent-based body builder for worker, harvester, upgrader, and builder bodies
  - Per-colony spawn queue helpers with explainable request metadata and duplicate rejection
  - Primary-first spawn request selection by colony, priority, and requested tick
  - Dry-run spawn validation runner that never creates gameplay creeps in Phase 4
affects: [04-colony-and-behavior-primitives, spawning, colony, commands, bootstrap]

tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN commits for spawn primitives
    - Pure body template selection with costs derived from Screeps BODYPART_COST
    - Per-colony persistent queue plus volatile ColonyContext selection
    - Phase 4 spawn validation through StructureSpawn.spawnCreep dryRun only

key-files:
  created:
    - src/spawning/bodyBuilder.ts
    - src/spawning/queue.ts
    - src/spawning/runner.ts
    - .planning/phases/04-colony-and-behavior-primitives/04-04-SUMMARY.md
  modified:
    - test/unit/spawnPrimitives.test.ts
    - test/unit/mock.ts
    - src/memory/schema.ts

key-decisions:
  - "Body builder templates stay intentionally simple in Phase 4 and derive all costs from BODYPART_COST."
  - "Spawn queue selection prioritizes primary colony requests before numeric priority and requested tick ordering."
  - "Spawn runner validates with dryRun: true only; real queue consumption remains deferred to Phase 6."

patterns-established:
  - "Spawn requests carry explainable metadata and mutate through queue helper functions instead of direct ad hoc Memory writes."
  - "Dry-run spawn names include role, room, tick, and request id for traceable validation without creating creeps."

requirements-completed: [BEH-04, BEH-05, TEST-05]

duration: 17min
completed: 2026-05-05
---

# Phase 04 Plan 04: Spawn Queue and Body Builder Summary

**Intent-based Screeps body builder, per-colony spawn queue helpers, and dry-run-only spawn validation primitives**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-05T15:55:10Z
- **Completed:** 2026-05-05T16:12:30Z
- **Tasks:** 3 completed
- **Files modified:** 6 code/test files plus this summary

## Accomplishments

- Added body templates for `worker`, `harvester`, `upgrader`, and `builder` intents with cost calculation from `BODYPART_COST`.
- Added per-colony spawn queue helpers for creating, enqueueing, selecting, validating, and error-marking requests.
- Added primary-first queue ordering, then lower numeric priority, then earlier requested tick.
- Added dry-run spawn validation that calls `spawnCreep` only with `dryRun: true`.
- Added focused unit coverage for body builder, queue ordering, duplicate request rejection, and dry-run success/error paths.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Body builder behavior tests** - `0c45650` (test)
2. **Task 1 GREEN: Body builder implementation** - `959d992` (feat)
3. **Task 2 RED: Spawn queue behavior tests** - `e0430f9` (test)
4. **Task 2 GREEN: Spawn queue implementation** - `68ae39d` (feat)
5. **Task 3 RED: Dry-run spawn runner tests** - `88be589` (test)
6. **Task 3 GREEN: Dry-run spawn validation** - `9e59d04` (feat)
7. **Refactor: Sort spawn primitive imports** - `61901a9` (refactor)

**Plan metadata:** included in final docs commit

## Files Created/Modified

- `src/spawning/bodyBuilder.ts` - Builds body templates by intent and calculates body cost from Screeps constants.
- `src/spawning/queue.ts` - Creates and mutates explainable per-colony spawn queue requests.
- `src/spawning/runner.ts` - Selects the next request and validates it through dry-run spawn calls only.
- `test/unit/spawnPrimitives.test.ts` - Covers body builder, queue, and dry-run runner behavior.
- `test/unit/mock.ts` - Adds minimal Screeps body constants and body cost table for unit tests.
- `src/memory/schema.ts` - Extends spawn request status with `validated` for dry-run validation results.

## Decisions Made

- The body builder uses fixed Phase 4 templates and does not search combinations, keeping CPU behavior predictable.
- `enqueueSpawnRequest` creates the missing colony queue container when needed, but still rejects duplicate IDs in that colony queue.
- `markSpawnRequestValidated` records the validation tick on the request; later real spawn consumption can decide whether and how to consume validated requests.
- The runner accepts `Game` in its signature for future integration, but Phase 4 validation relies on supplied `ColonyContext` objects to avoid extra global scans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Screeps body constants to unit mocks**
- **Found during:** Task 1 (Implement intent-based body builder)
- **Issue:** The unit test runtime did not define `WORK`, `CARRY`, `MOVE`, or `BODYPART_COST`, while the planned body builder must use Screeps constants.
- **Fix:** Added minimal body constants and the cost table to `test/unit/mock.ts`.
- **Files modified:** `test/unit/mock.ts`
- **Verification:** `rtk npm run test-unit -- --grep "spawn primitives|body builder"` passed.
- **Committed in:** `959d992`

**2. [Rule 1 - Bug] Added `validated` to spawn request status type**
- **Found during:** Task 2 (Implement per-colony spawn queue helpers)
- **Issue:** The plan requires dry-run validation to mark requests as `validated`, but `SpawnRequestMemory.status` did not include that value.
- **Fix:** Extended the union type in `src/memory/schema.ts`.
- **Files modified:** `src/memory/schema.ts`
- **Verification:** `rtk npm run test-unit -- --grep "spawn primitives|spawn queue"` and final plan verification passed.
- **Committed in:** `68ae39d`

**3. [Rule 1 - Bug] Delayed body template creation until function call**
- **Found during:** Task 2 verification
- **Issue:** `bodyBuilder.ts` originally read Screeps globals during module import, which made direct test-file execution fail before mock globals were initialized.
- **Fix:** Moved template construction behind `buildBody` so constants are read at runtime, matching Screeps execution.
- **Files modified:** `src/spawning/bodyBuilder.ts`, `test/unit/spawnPrimitives.test.ts`
- **Verification:** Direct `spawnPrimitives.test.ts` execution and final plan verification passed.
- **Committed in:** `68ae39d`

---

**Total deviations:** 3 auto-fixed (1 Rule 3, 2 Rule 1)
**Impact on plan:** All fixes were required for the planned spawn primitives to compile and validate correctly. No real spawning behavior or gameplay automation was added.

## Issues Encountered

- Concurrent plan 04-03 modified `src/processes/runner.ts` during this execution. Those changes were left untouched and are outside this plan's ownership.
- Initial lint verification reported import-order warnings in the new spawning modules. A refactor commit sorted imports and `rtk npm run lint` passed.

## Verification

- `rtk npm run test-unit -- --grep "spawn primitives|body builder|spawn queue|dry-run"` - PASS, 9 passing
- `rtk npm run lint` - PASS
- `rtk npm run build` - PASS, Rollup dry-run build created `dist/main.js`
- Task acceptance `rg` checks for `buildBody`, `BODYPART_COST`, low-energy reason, `fallbackReason`, `createSpawnRequest`, `selectNextSpawnRequest`, duplicate ID rejection, `priority`, `runSpawnValidation`, `dryRun: true`, `spawnCreep`, and `validated` - PASS
- `rtk rg -n "spawnCreep" src test/unit` - PASS, calls exist only in dry-run runner and test mock
- `rtk graphify update .` - PASS, graph rebuilt with 258 nodes and 325 edges

## Known Stubs

None - no placeholder UI/data stubs were introduced. Empty arrays and null values in queue/context tests and default colony containers represent valid no-object or no-request states.

## Threat Flags

None - the plan's threat model covered body builder input to creep bodies and spawn queue Memory to dry-run `StructureSpawn` validation. No network endpoints, auth paths, file access paths, or new external trust boundaries were added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04-05 can expose read-only spawn inspection and dry-run commands on top of `buildBody`, `selectNextSpawnRequest`, and `runSpawnValidation`. Phase 6 can later consume the same queue primitives to implement real spawn creation behind explicit bootstrap behavior.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/04-colony-and-behavior-primitives/04-04-SUMMARY.md`
- Created files exist: `src/spawning/bodyBuilder.ts`, `src/spawning/queue.ts`, `src/spawning/runner.ts`
- Commits found: `0c45650`, `959d992`, `e0430f9`, `68ae39d`, `88be589`, `9e59d04`, `61901a9`
- Verification commands passed after final implementation and refactor.

---
*Phase: 04-colony-and-behavior-primitives*
*Completed: 2026-05-05*
