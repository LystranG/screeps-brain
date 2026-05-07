---
phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
plan: 03
subsystem: testing
tags: [screeps-server-mockup, integration-tests, sim, node22, commands]
requires:
  - phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
    provides: Plan 01 integration helper, sim capability probe, scenario factories, and assertion helpers
provides:
  - Official-sim-style ready integration coverage through the shared runtime path
  - Degraded sim missing-object matrix coverage for spawn, source, controller, and creep gaps
  - Memory and `cmd.sim` / `cmd.colony` evidence for sim guidance
affects: [phase-07, TEST-08, operations-runbook]
tech-stack:
  added: []
  patterns: [capability-probed sim integration, stable command-token assertions, per-case helper cleanup]
key-files:
  created:
    - test/integration/sim.test.ts
  modified: []
key-decisions:
  - "Used the project `npm run test-integration` wrapper from Plan 01 so integration gates run under Node 22 via mise."
  - "Kept sim tests on built-bundle scenario helpers and did not import or instantiate Kernel directly."
  - "Used local spawn-queue status membership in sim.test.ts because the shared assertion helper currently expects all possible statuses at once."
patterns-established:
  - "Sim integration tests branch on `probeSimShardCapability()` and keep a documented `mock-server difference` fallback."
  - "Degraded sim matrix verifies stable guidance codes through Memory and command output rather than console log snapshots."
requirements-completed: [TEST-08]
duration: 8min
completed: 2026-05-07
---

# Phase 07 Plan 03: Sim Integration Coverage Summary

**Official-sim-style ready and degraded missing-object integration coverage now runs through the built bundle and command surfaces.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-07T06:55:20Z
- **Completed:** 2026-05-07T07:02:48Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `official-sim-style bootstrap` integration suite in `test/integration/sim.test.ts`.
- Verified ready sim rooms use `createSimReadyScenario`, normal Memory readiness checks, spawn queue progress, and `cmd.sim` / `cmd.colony` / `cmd.spawn` output.
- Added degraded matrix coverage for `missingSpawn`, `missingSource`, `missingController`, and `missingCreep`.
- Verified stable guidance codes `missing-spawn`, `missing-source`, `missing-controller`, and `missing-creep` through Memory and command surfaces.
- Preserved the documented manual fallback path when a mock server cannot represent official `Game.shard.name === "sim"`.

## Task Commits

1. **Task 1 RED: Add failing sim-ready integration test** - `ea732be` (test)
2. **Task 1 GREEN: Implement sim-ready shared-path integration** - `f5f67d7` (feat)
3. **Task 2 RED: Add failing degraded sim matrix test** - `86cc385` (test)
4. **Task 2 GREEN: Implement degraded sim guidance matrix** - `b94b38d` (feat)
5. **Task 2 REFACTOR: Format sim integration matrix** - `f6f3a7c` (refactor)

## Files Created/Modified

- `test/integration/sim.test.ts` - Sim-ready and degraded missing-object integration tests through scenario helpers, Memory assertions, and command output.

## Decisions Made

- Used `rtk npm run test-integration -- --grep ...` rather than the stale Node 16 command embedded in the plan, matching Plan 01 and the user-provided context.
- Did not edit shared `test/integration/assertions.ts`; a local queue-status assertion was used because `assertSpawnQueueProgressed` currently checks for all possible statuses instead of any valid progressed status.
- Left `test/integration/ownedRoom.test.ts` untouched because it belongs to parallel Plan 07-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the Plan 01 Node 22 integration wrapper instead of stale Node 16 commands**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** The plan text still listed `rtk mise x node@16.17.0 -- npm run test-integration`, but Plan 01 established `npm run test-integration` internally enters Node 22 via mise.
- **Fix:** Ran all integration gates through `rtk npm run test-integration -- --grep ...`.
- **Files modified:** None
- **Verification:** Focused sim gates passed through the project wrapper.
- **Committed in:** N/A

**2. [Rule 3 - Blocking] Avoided shared assertion helper race**
- **Found during:** Task 1 GREEN
- **Issue:** `assertSpawnQueueProgressed` requires the queue status list to contain every possible lifecycle status; real integration state contains one current status such as `spawning`.
- **Fix:** Added a local `assertSpawnQueueHasProgressed` helper inside `sim.test.ts` to assert any valid queue lifecycle state without touching shared helpers.
- **Files modified:** `test/integration/sim.test.ts`
- **Verification:** `rtk npm run test-integration -- --grep "official-sim-style bootstrap"` exits 0.
- **Committed in:** `f5f67d7`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blockers)
**Impact on plan:** Scope stayed within `sim.test.ts`; sim coverage passed without changing shared helpers or runtime code.

## Issues Encountered

- The initial Task 1 RED test passed unexpectedly because the sim capability probe already reports `sim-shard-supported`; the test was strengthened before proceeding.
- `rtk npm run test-integration -- --grep "official-sim-style bootstrap"` emits a Node `MaxListenersExceededWarning` from repeated mock-server `playerSandbox` listeners, but exits 0.
- Full `rtk npm run test-integration` was re-run after parallel 07-02 commits and failed during shared mock-server/native loading with `Cannot find module '../../native/build/Release/native.node'`; this is outside Plan 07-03 write scope.
- One focused rerun hit `ENOENT: no such file or directory, open 'dist/main.js'` before Rollup finished writing the bundle; rerunning after `dist/main.js` existed passed the same 07-03 suite.

## Verification

- `rtk mise x node@22 -- node -v` - PASS: `v22.22.2`
- `rtk npm run test-integration -- --grep "uses the normal runtime path when sim has required objects"` - PASS: 1 passing
- `rtk npm run test-integration -- --grep "records degraded guidance without breaking kernel health"` - PASS: 1 passing
- `rtk npm run test-integration -- --grep "official-sim-style bootstrap"` - PASS: 2 passing after retry with `dist/main.js` present
- `rtk ./node_modules/.bin/prettier --check test/integration/sim.test.ts` - PASS
- `rtk npm run test-integration` - FAIL: blocked by shared mock-server/native module loading, not by 07-03 sim tests
- `rtk graphify update .` - PASS

## Known Stubs

None. Grep hits for `null` are helper cleanup guards, not stubs.

## Threat Flags

None. This plan added integration test coverage only; no new runtime endpoint, auth path, file access, or trust-boundary implementation was introduced.

## User Setup Required

None beyond Plan 01 integration setup. The `npm run test-integration` script handles the Node 22 mise wrapper.

## Next Phase Readiness

TEST-08 sim integration evidence is ready. Plan 07-04 or 07-02 should address the owned-room full integration timeout before treating the full integration suite as green.

## Self-Check: PASSED

- Created file exists: `test/integration/sim.test.ts`.
- Summary file exists: `07-03-SUMMARY.md`.
- Task commits exist: `ea732be`, `f5f67d7`, `86cc385`, `b94b38d`, `f6f3a7c`.
- No tracked file deletions were introduced by 07-03 commits.

---
*Phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui*
*Completed: 2026-05-07*
