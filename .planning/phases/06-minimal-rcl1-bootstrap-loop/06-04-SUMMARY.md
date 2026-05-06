---
phase: 06-minimal-rcl1-bootstrap-loop
plan: 04
subsystem: kernel-bootstrap-loop
tags: [screeps, kernel, bootstrap, sim, spawn-lifecycle, matrix-tests]

requires:
  - phase: 06-minimal-rcl1-bootstrap-loop
    plan: 01
    provides: bootstrapExecution process, slot demand, spawn queue demand, and task assignment.
  - phase: 06-minimal-rcl1-bootstrap-loop
    plan: 02
    provides: validated -> spawning -> spawned lifecycle runner.
  - phase: 06-minimal-rcl1-bootstrap-loop
    plan: 03
    provides: creepRoles task execution for harvest and upgrade tasks.
provides:
  - Kernel default spawning stage wired to the real spawn lifecycle runner.
  - Sim missing-object guidance for spawn, source, controller, and initial creep gaps.
  - Ready/degraded normal and sim bootstrap matrix evidence through the default kernel path.
affects: [phase-06, kernel, sim-guidance, bootstrap-verification]

tech-stack:
  added: []
  patterns:
    - Kernel wires processes and spawning through existing execution modules only.
    - Sim remains an environment guidance surface, not a gameplay fork.
    - Bootstrap matrix tests exercise real kernel stages instead of direct process calls.

key-files:
  created:
    - .planning/phases/06-minimal-rcl1-bootstrap-loop/06-04-SUMMARY.md
  modified:
    - src/runtime/Kernel.ts
    - src/environment/simBootstrap.ts
    - src/commands/namespaces/sim.ts
    - test/unit/kernel.test.ts
    - test/unit/mock.ts

key-decisions:
  - "Kernel runSpawning calls runSpawnLifecycle and does not contain direct spawn or bootstrap execution logic."
  - "Sim guidance uses stable missing-object codes in Memory.runtime.sim.guidance and keeps command inspection under cmd.sim.guidance()."
  - "Task 3 preserved the previous executor's partial matrix test work and completed it with controller and upgrade coverage."

patterns-established:
  - "Normal and sim rooms share the same kernel -> colony context -> processes -> creepRoles -> spawn lifecycle path."
  - "Missing spawn/source/controller facts degrade demand without fabricating Screeps world objects."
  - "Spawn requests in spawning state complete only after Game.creeps exposes the requested creep name."

requirements-completed: [BOOT-01, BOOT-02, BOOT-03, BOOT-04]

duration: recovered continuation
completed: 2026-05-07
---

# Phase 06 Plan 04: Kernel Bootstrap Loop Summary

**Default kernel now runs the minimal RCL1 bootstrap loop through process, role, task, spawn lifecycle, and sim guidance boundaries.**

## Performance

- **Duration:** recovered continuation after prior executor hit 429 and this executor hit one signing gate
- **Completed:** 2026-05-07
- **Tasks:** 3
- **Files modified:** 13 code/test files plus this summary after final gate closure

## Accomplishments

- Switched the kernel spawning stage from validation-only behavior to `runSpawnLifecycle`.
- Extended sim guidance with `missing-spawn`, `missing-source`, and `missing-controller` while preserving the existing `cmd.sim.guidance()` surface.
- Added a shared kernel bootstrap matrix covering normal ready, sim ready, missing spawn, missing source, missing controller, missing creep, harvest/upgrade role execution, and spawning completion.
- Verified the real spawn lifecycle boundary: dry-run validates queued requests, validated requests schedule real spawning, and spawned requests complete only when the creep becomes visible.

## Task Commits

1. **Task 1 RED: Kernel lifecycle spawn assertions** - `af6761d` (`test`)
2. **Task 1 GREEN: Real spawn lifecycle from kernel** - `481b72f` (`feat`)
3. **Task 2 RED: Sim missing object guidance tests** - `c82ff2e` (`test`)
4. **Task 2 GREEN: Sim missing object guidance** - `f88c9d6` (`feat`)
5. **Task 3: Bootstrap matrix coverage** - `f63f092` (`test`)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified

- `src/runtime/Kernel.ts` - Calls `runSpawnLifecycle` during the default `runSpawning` stage.
- `src/environment/simBootstrap.ts` - Records stable missing-object guidance without creating world objects.
- `src/commands/namespaces/sim.ts` - Continues exposing active guidance through the existing read-only sim namespace.
- `src/bootstrap/runner.ts` - Import order aligned with lint gate.
- `src/bootstrap/slots.ts` - Import order aligned with lint gate.
- `src/bootstrap/spawnDemand.ts` - Import order aligned with lint gate and readonly array style.
- `src/bootstrap/taskAssignment.ts` - Import order aligned with lint gate.
- `src/memory/migrations.ts` - Import order aligned with lint gate.
- `src/processes/runner.ts` - Import order aligned with lint gate.
- `src/spawning/runner.ts` - Import member order aligned with lint gate.
- `src/tasks/executor.ts` - Import/member order aligned with lint gate.
- `test/unit/kernel.test.ts` - Covers kernel lifecycle integration, sim handoff, and ready/degraded bootstrap matrix.
- `test/unit/mock.ts` - Adds `Game.getObjectById` lookup support for live test targets.
- `.planning/phases/06-minimal-rcl1-bootstrap-loop/06-04-SUMMARY.md` - Documents execution outcome and verification.

## Decisions Made

- Preserved the previous 06-04 commits as authoritative and continued only from Task 3/final gates.
- Completed the previous executor's partial Task 3 diff instead of rewriting it.
- Did not update `STATE.md` or `ROADMAP.md`; the orchestrator owns those writes after wave completion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Continued Task 3 after previous executor quota failure**
- **Found during:** Task 3 (Add ready/degraded bootstrap matrix and run final gates)
- **Issue:** The previous executor left partial matrix work in `test/unit/kernel.test.ts` and `test/unit/mock.ts` after hitting a 429.
- **Fix:** Preserved the partial diff, added missing controller and upgrade-path coverage, and completed the shared matrix.
- **Files modified:** `test/unit/kernel.test.ts`, `test/unit/mock.ts`
- **Verification:** `rtk npm run test-unit -- --grep "kernel bootstrap matrix"` passed with 9 tests; `rtk npm test` passed with 191 tests.
- **Committed in:** `f63f092`

**2. [Rule 1 - Bug] Fixed mock object lookup for reassigned Game state**
- **Found during:** Task 3 (ready room worker executes assigned harvest/upgrade through creepRoles)
- **Issue:** The partial `Game.getObjectById` mock captured the initial game object and could miss objects after tests replaced `game.rooms`, `game.spawns`, or `game.creeps`.
- **Fix:** Updated the mock to resolve targets from the current global Game object at call time.
- **Files modified:** `test/unit/mock.ts`
- **Verification:** harvest and upgrade matrix tests passed through `creepRoles`.
- **Committed in:** `f63f092`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** No scope expansion. The fixes completed the intended Task 3 evidence and preserved the shared normal/sim bootstrap path.

## Issues Encountered

- The first attempt to commit Task 3 failed because the signing agent could not find the key: `Couldn't find key in agent?`. Work stopped per `AGENTS.md`; after user authorization, the same commit command succeeded.
- Final lint gate was closed by converting `ReadonlyArray<T>` to `readonly T[]` in `src/bootstrap/spawnDemand.ts` and sorting Phase 6 imports without behavioral changes.
- The original raw `screeps.json` grep was narrowed to exclude the two intentional negative security tests while still failing on runtime/source references.
- The original raw `spawnCreep` grep was narrowed to an allowlist that includes the existing read-only dry-run command test at `test/unit/commandInspection.test.ts:831` and the planned spawn runner boundary.

## Known Stubs

None. Stub-pattern scan found only normal test setup objects, empty arrays, null guards, and Memory initialization patterns.

## Threat Flags

No unmodeled runtime threat surface was introduced. The new execution boundary remains the planned kernel/process/spawn lifecycle path, sim guidance does not create world objects, and no runtime code reads `screeps.json`.

## Verification

- `rtk npm run test-unit -- --grep "bootstrap execution|spawn primitives|kernel bootstrap matrix"` - PASS after code-review blocker fixes; 37 focused tests.
- `rtk npm run test-unit -- --grep "kernel.*bootstrap|kernel strategy sim handoff|default lifecycle"` - PASS before recovery, Task 1 scope.
- `rtk npm run test-unit -- --grep "sim.*bootstrap|kernel strategy sim handoff|kernel.*bootstrap"` - PASS, 35 tests after Task 3 recovery.
- `rtk npm run test-unit -- --grep "kernel bootstrap matrix"` - PASS, 9 tests.
- `rtk npm test` - PASS, 191 tests.
- `rtk npm run build` - PASS, Rollup created `dist/main.js`.
- `rtk npm run lint` - PASS, no errors or warnings.
- `rtk proxy sh -c '! rtk rg -n "CommandPath\\.bootstrap|cmd\\.bootstrap|createBootstrapNamespace" src test/unit'` - PASS.
- `rtk proxy sh -c '! rtk rg -n "screeps\\.json" src test/unit --glob "!test/unit/commandCore.test.ts" --glob "!test/unit/commandInspection.test.ts"'` - PASS; the only remaining matches are negative security tests in `test/unit/commandCore.test.ts` and `test/unit/commandInspection.test.ts`.
- `rtk proxy sh -c '! rtk rg -n "spawnCreep" src test/unit --glob "!src/spawning/runner.ts" --glob "!src/commands/namespaces/spawn.ts" --glob "!test/unit/mock.ts" --glob "!test/unit/spawnPrimitives.test.ts" --glob "!test/unit/kernel.test.ts" --glob "!test/unit/commandInspection.test.ts"'` - PASS; the allowlist includes the existing read-only dry-run command test.
- `rtk graphify update .` - PASS, graph regenerated after final source edits.

## Code Review Closure

Phase 06 review blockers CR-01, CR-02, and CR-03 are resolved in follow-up fix commit `f7facf8`, also recorded in `06-REVIEW.md`. Bootstrap terminal slot requests can be replaced, spawn demand respects the missing target population, and recoverable dry-run spawn failures now wait without consuming attempts.

### Verification Blocked

None. Final validation gates are closed.

## User Setup Required

None.

## Next Phase Readiness

The minimal bootstrap loop path is wired and covered by unit evidence. Final lint, build, test, namespace, security-string, spawn-boundary, and graph update gates are green.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/06-minimal-rcl1-bootstrap-loop/06-04-SUMMARY.md`.
- Key files exist: `src/runtime/Kernel.ts`, `src/environment/simBootstrap.ts`, `src/commands/namespaces/sim.ts`, `test/unit/kernel.test.ts`, `test/unit/mock.ts`.
- Task commits found in git log: `af6761d`, `481b72f`, `c82ff2e`, `f88c9d6`, `f63f092`.
- `STATE.md` and `ROADMAP.md` were not updated by this executor.

---
*Phase: 06-minimal-rcl1-bootstrap-loop*
*Completed: 2026-05-07*
