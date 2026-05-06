---
phase: 06-minimal-rcl1-bootstrap-loop
plan: 02
subsystem: spawning
tags: [screeps, spawn-queue, memory-migration, commands, tdd]

requires:
  - phase: 04-colony-and-behavior-primitives
    provides: Spawn queue, body builder, dry-run validation primitives, and read-only spawn command namespace.
  - phase: 05-strategy-and-policy-planning
    provides: Pure strategy output that later bootstrap execution can translate into spawn demand.
provides:
  - Versioned v5 spawn lifecycle Memory fields with migration repair.
  - Generic two-stage spawn lifecycle runner using dry-run validation before real spawnCreep calls.
  - Queue helpers for validated, waiting, spawning, and spawned lifecycle mutation.
  - Read-only spawn command lifecycle counts.
affects: [06-minimal-rcl1-bootstrap-loop, bootstrap-execution, role-task-execution, kernel-spawning]

tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN commits per task.
    - JSON-only Memory lifecycle repair for persistent queue entries.
    - Two-stage Screeps spawn lifecycle through a single generic runner.

key-files:
  created: []
  modified:
    - src/memory/schema.ts
    - src/memory/migrations.ts
    - src/spawning/queue.ts
    - src/spawning/runner.ts
    - src/commands/namespaces/spawn.ts
    - test/unit/memory.test.ts
    - test/unit/spawnPrimitives.test.ts
    - test/unit/commandInspection.test.ts

key-decisions:
  - "Memory v5 stores spawn lifecycle fields directly on each SpawnRequestMemory."
  - "runSpawnValidation remains as the compatibility export and delegates to runSpawnLifecycle."
  - "Recoverable spawn return codes record diagnostics without consuming attempts."
  - "Spawn command status remains read-only and reports lifecycle counts only."

patterns-established:
  - "Spawn lifecycle: queued -> validated by dryRun, validated -> spawning by real spawnCreep, spawning -> spawned when Game.creeps contains the creep."
  - "Recoverable spawn waits: ERR_BUSY and ERR_NOT_ENOUGH_ENERGY keep the request validated and update lastError/lastTriedTick."
  - "Fatal spawn failures: ERR_NAME_EXISTS, ERR_INVALID_ARGS, ERR_RCL_NOT_ENOUGH, and ERR_NOT_OWNER mark the request failed."

requirements-completed: [BOOT-02, BOOT-04]

duration: 18 min
completed: 2026-05-06
---

# Phase 06 Plan 02: Real Spawn Queue Lifecycle Summary

**Spawn queue lifecycle consumption with v5 Memory repair, dry-run gated real spawnCreep scheduling, and read-only lifecycle inspection**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-06T15:26:32Z
- **Completed:** 2026-05-06T15:44:24Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added v5 `SpawnRequestMemory` lifecycle fields and migrations that preserve old queued or validated requests.
- Implemented `runSpawnLifecycle` so queued requests are dry-run validated, validated requests schedule real spawning, and spawning requests complete only after the creep appears.
- Added lifecycle queue mutation helpers and command status counts for `queued`, `blocked`, `validated`, `spawning`, `spawned`, and `failed`.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Version spawn lifecycle Memory fields** - `3e3d615` (test)
2. **Task 1 GREEN: Version spawn lifecycle Memory fields** - `2867829` (feat)
3. **Task 2 RED: Spawn lifecycle runner** - `44a6609` (test)
4. **Task 2 GREEN: Spawn lifecycle runner** - `52dc295` (feat)
5. **Task 3 RED: Spawn lifecycle command counts** - `9c40f01` (test)
6. **Task 3 GREEN: Spawn lifecycle command counts** - `b5f4b53` (feat)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified

- `src/memory/schema.ts` - Bumped `CURRENT_MEMORY_VERSION` to 5 and added lifecycle fields to `SpawnRequestMemory`.
- `src/memory/migrations.ts` - Added v5 migration and spawn queue repair helpers.
- `src/spawning/queue.ts` - Added lifecycle selectors/mutators and initialized lifecycle defaults on new requests.
- `src/spawning/runner.ts` - Added `runSpawnLifecycle` and preserved `runSpawnValidation` as a compatibility wrapper.
- `src/commands/namespaces/spawn.ts` - Added `spawning` and `spawned` counts to read-only status output.
- `test/unit/memory.test.ts` - Covered v4 and current-version lifecycle repair.
- `test/unit/spawnPrimitives.test.ts` - Covered lifecycle runner and queue helper behavior.
- `test/unit/commandInspection.test.ts` - Covered read-only lifecycle count output.

## Decisions Made

- `OK` from a real `spawnCreep` moves a request to `spawning`, not `spawned`.
- Completion is based on `Game.creeps[request.creepName]` becoming visible.
- Fatal spawn return codes are explicitly classified in the runner; recoverable codes keep the request eligible for later retry.
- Existing command-side `dryRun` remains inspection-only and does not enqueue or consume spawn requests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired v5 type fallout in existing fixtures and request creation**
- **Found during:** Task 1 (Version spawn lifecycle Memory fields)
- **Issue:** Adding required lifecycle fields made existing spawn queue fixtures and `createSpawnRequest` fail TypeScript compilation before focused tests could run.
- **Fix:** Added JSON-safe lifecycle defaults to `createSpawnRequest` and existing spawn command/spawn primitive fixtures.
- **Files modified:** `src/spawning/queue.ts`, `test/unit/commandInspection.test.ts`, `test/unit/spawnPrimitives.test.ts`
- **Verification:** `rtk npm run test-unit -- --grep "memory migrations"` and final plan verification passed.
- **Committed in:** `2867829`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required by the v5 schema contract and did not add command-side spawn bypasses.

## Issues Encountered

- During early Task 1 and Task 2 verification, concurrent 06-01 RED work temporarily caused `npm run test-unit -- --grep ...` to compile unrelated missing bootstrap modules before grep filtering. Focused single-file Mocha checks were used for the immediate RED/GREEN loop, and the final plan-level grep test passed after 06-01 related commits landed.

## Known Stubs

None - no placeholders or mock-only data paths block the 06-02 goal.

## Threat Flags

None - the new spawn API surface is the planned spawn queue to Screeps boundary and remains isolated in `src/spawning/runner.ts`.

## Verification

- `rtk npm run test-unit -- --grep "memory migrations"` - passed, 19 tests.
- `rtk npm run test-unit -- --grep "spawn primitives"` - passed, 15 tests.
- `rtk npm run test-unit -- --grep "spawn"` - passed, 29 tests.
- `rtk npm run test-unit -- --grep "memory migrations|spawn primitives|spawn"` - passed, 44 tests.
- `rtk rg -n "spawnCreep" src test/unit` - passed boundary review; the only real non-dry-run source call is in `src/spawning/runner.ts`.
- `rtk graphify update .` - completed AST graph update.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-03 role/task execution work. Spawn requests can now progress through the generic queue lifecycle without bypassing validation or command boundaries.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/06-minimal-rcl1-bootstrap-loop/06-02-SUMMARY.md`.
- Key source files exist: `src/memory/schema.ts`, `src/spawning/runner.ts`.
- Task commits found in git log: `3e3d615`, `2867829`, `44a6609`, `52dc295`, `9c40f01`, `b5f4b53`.
- STATE.md and ROADMAP.md were not updated by this executor.

---
*Phase: 06-minimal-rcl1-bootstrap-loop*
*Completed: 2026-05-06*
