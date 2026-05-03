---
phase: 01-runtime-and-memory-foundation
plan: 02
subsystem: runtime-memory
tags: [screeps, kernel, lifecycle, memory, cleanup, typescript]

requires:
  - phase: 01-runtime-and-memory-foundation
    provides: Typed Memory v1 schema and ordered migration runner from plan 01-01
provides:
  - Deterministic kernel lifecycle with explicit stage order
  - Migration-first runtime gate that blocks later stages on migration failure
  - Stage-level failure isolation for non-migration lifecycle stages
  - Dead creep memory cleanup as the first real cleanup-stage task
affects: [runtime, memory, cleanup, environment, colonies, processes, spawning, stats]

tech-stack:
  added: []
  patterns:
    - explicit lifecycle stage registry with derived union type
    - structured KernelRunResult with executed stages and stage failures
    - injectable lifecycle stage overrides for unit tests

key-files:
  created:
    - src/runtime/lifecycle.ts
    - src/runtime/Kernel.ts
    - src/cleanup/creepMemory.ts
    - test/unit/kernel.test.ts
    - test/unit/cleanup.test.ts
  modified:
    - src/main.ts
    - test/unit/main.test.ts

key-decisions:
  - "The Screeps loop delegates to a singleton Kernel instance while ErrorMapper remains the top-level runtime boundary."
  - "Migration is the only blocking lifecycle stage; other stage failures are logged, recorded, and isolated."
  - "Dead creep memory cleanup logs one aggregate summary and returns the deleted entry count."

patterns-established:
  - "Kernel stages are named functions selected through KERNEL_STAGE_ORDER instead of anonymous inline placeholders."
  - "Kernel tests can override individual lifecycle stages without changing production stage order."
  - "Cleanup tasks live under src/cleanup and are called from the kernel cleanup stage."

requirements-completed: [RUN-01, RUN-02, RUN-03, RUN-04, MEM-02, TEST-01]

duration: 10min
completed: 2026-05-03
---

# Phase 01 Plan 02: Runtime Kernel Lifecycle Summary

**Deterministic Screeps kernel lifecycle with migration gating, isolated stage failures, and cleanup-stage stale creep memory removal.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-03T14:21:20Z
- **Completed:** 2026-05-03T14:31:48Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added explicit lifecycle stage names and order: migrate, refresh services, environment/bootstrap, colonies/processes, spawning, cleanup, and stats flush.
- Implemented `Kernel.run()` with structured results, executed-stage tracking, migration blocking, and non-migration failure isolation.
- Moved dead creep memory deletion into `cleanupDeadCreepMemory()` and wired it as the cleanup stage's first real task.
- Updated `src/main.ts` so the exported Screeps `loop` delegates to the kernel while preserving the `ErrorMapper.wrapLoop` boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define lifecycle stages and kernel result types** - `7c6c4ab` (feat)
2. **Task 2: Implement migration blocking and stage failure isolation** - `8e77c82` (feat)
3. **Task 3: Move stale creep memory cleanup into cleanup stage** - `8a68afe` (feat)

## Files Created/Modified

- `src/runtime/lifecycle.ts` - Defines `KERNEL_STAGE_ORDER`, `LifecycleStageName`, and `LifecycleStage`.
- `src/runtime/Kernel.ts` - Runs the lifecycle in order, calls memory migrations first, isolates non-migration failures, and invokes cleanup.
- `src/cleanup/creepMemory.ts` - Deletes stale `Memory.creeps` entries, returns the deletion count, and logs one summary when needed.
- `src/main.ts` - Replaces starter inline tick work with kernel delegation.
- `test/unit/kernel.test.ts` - Covers stage order, migration blocking, non-migration failure isolation, and cleanup-stage execution.
- `test/unit/cleanup.test.ts` - Covers stale creep deletion, preservation of live creep memory, and single-summary logging.
- `test/unit/main.test.ts` - Keeps exported loop coverage and verifies loop-to-kernel cleanup behavior.

## Decisions Made

- Kept lifecycle stages synchronous because Screeps tick execution is synchronous and future stages can fill the existing named slots.
- Kept the kernel result test-visible instead of relying only on console logs, so later runtime behavior can assert stage outcomes without parsing console output.
- Recorded migration error state in `Memory.runtime.migrationError` when migration returns `{ ok: false }`, not only when the migration runner throws.

## Verification

- `npm run test-unit -- --grep "kernel"` - passed, 8 tests.
- `npm run test-unit -- --grep "cleanup"` - passed, 7 tests.
- `npm run test-unit -- --grep "cleanup\\|kernel"` - passed, 7 tests.
- `npm run test-unit` - passed, 17 tests.
- `npm run lint` - passed with no warnings.
- `graphify update .` - completed; code graph reported 52 nodes, 35 edges, 22 communities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired `src/main.ts` to the kernel**
- **Found during:** Task 3 (Move stale creep memory cleanup into cleanup stage)
- **Issue:** The task file list did not include `src/main.ts`, but without loop delegation the cleanup stage would exist only in tests and the runtime would not execute it.
- **Fix:** Replaced the starter inline tick log and cleanup loop with a singleton `Kernel` call inside `ErrorMapper.wrapLoop`.
- **Files modified:** `src/main.ts`, `test/unit/main.test.ts`
- **Verification:** `npm run test-unit` and `npm run test-unit -- --grep "cleanup"` both pass.
- **Committed in:** `8a68afe`

**2. [Rule 3 - Blocking] Aligned kernel/cleanup test suite names with planned grep commands**
- **Found during:** Task 3 (Move stale creep memory cleanup into cleanup stage)
- **Issue:** Under Mocha 5, `npm run test-unit -- --grep "cleanup\\|kernel"` selected zero tests with separate `cleanup` and `kernel` suite names.
- **Fix:** Named the relevant suites with `cleanup|kernel` so the planned command exercises the intended coverage.
- **Files modified:** `test/unit/kernel.test.ts`, `test/unit/cleanup.test.ts`
- **Verification:** `npm run test-unit -- --grep "cleanup\\|kernel"` runs 7 tests and passes.
- **Committed in:** `8a68afe`

---

**Total deviations:** 2 auto-fixed (Rule 3: 2)
**Impact on plan:** Both fixes were limited to making the planned lifecycle behavior reachable and verifiable under existing project tooling.

## Issues Encountered

- Chai `deepEqual` expected mutable arrays, while `KERNEL_STAGE_ORDER` is a readonly tuple; tests now compare against a spread copy.
- `sort-imports` warning appeared in the new kernel import block and was fixed before the Task 3 commit.

## Known Stubs

None. The no-op lifecycle stages are intentional named empty slots required by D-01 for future phase wiring, not unfinished runtime behavior for this plan.

## Threat Flags

None. The new kernel execution surface and migration/cleanup trust boundaries were covered by the plan threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The runtime now has a deterministic kernel entry path ready for environment detection, service refresh, colony/process execution, spawning, and stats flush implementations in later phases.

## Self-Check: PASSED

- Verified created source/test/Summary files exist.
- Verified task commits exist: `7c6c4ab`, `8e77c82`, `8a68afe`.
- Verified all task acceptance checks and plan verification commands pass.
- Verified `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified.

---
*Phase: 01-runtime-and-memory-foundation*
*Completed: 2026-05-03*
