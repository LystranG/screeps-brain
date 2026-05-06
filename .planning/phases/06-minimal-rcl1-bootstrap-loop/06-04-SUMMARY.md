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
- **Files modified:** 5 code/test files plus this summary

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
- `rtk npm run lint` remains blocked by pre-existing Phase 6 source lint in files outside the Task 3 continuation ownership:
  - `src/bootstrap/spawnDemand.ts:6` uses `ReadonlyArray<T>` where the repo lint rule requires `readonly T[]`.
  - Additional sort-import warnings exist in Phase 6 source files.
- The exact plan grep `rtk sh -c '! rg -n "screeps\\.json" src test/unit'` fails because existing tests intentionally assert that `screeps.json` dump paths are rejected.
- The exact plan grep for direct `spawnCreep` fails because the allowlist omits the existing read-only dry-run command test at `test/unit/commandInspection.test.ts:831`. The actual source matches remain limited to `src/spawning/runner.ts` and `src/commands/namespaces/spawn.ts`.

## Known Stubs

None. Stub-pattern scan found only normal test setup objects, empty arrays, null guards, and Memory initialization patterns.

## Threat Flags

No unmodeled runtime threat surface was introduced. The new execution boundary remains the planned kernel/process/spawn lifecycle path, sim guidance does not create world objects, and no runtime code reads `screeps.json`.

## Verification

- `rtk npm run test-unit -- --grep "kernel.*bootstrap|kernel strategy sim handoff|default lifecycle"` - PASS before recovery, Task 1 scope.
- `rtk npm run test-unit -- --grep "sim.*bootstrap|kernel strategy sim handoff|kernel.*bootstrap"` - PASS, 35 tests after Task 3 recovery.
- `rtk npm run test-unit -- --grep "kernel bootstrap matrix"` - PASS, 9 tests.
- `rtk npm test` - PASS, 191 tests.
- `rtk npm run build` - PASS, Rollup created `dist/main.js`.
- `rtk sh -c '! rg -n "CommandPath\\.bootstrap|cmd\\.bootstrap|createBootstrapNamespace" src test/unit'` - PASS.
- `rtk graphify update .` - PASS, rebuilt 415 nodes, 640 edges, 45 communities; no graph files remained modified in git status.

### Verification Blocked

- `rtk npm run lint` - FAIL due to existing lint in `src/bootstrap/spawnDemand.ts` and import-sort warnings in Phase 6 source files outside this continuation's Task 3 ownership.
- `rtk sh -c '! rg -n "screeps\\.json" src test/unit'` - FAIL due to existing negative security tests referencing the string `screeps.json`.
- `rtk sh -c 'rg -n "spawnCreep" src/spawning/runner.ts >/dev/null; runner=$?; unexpected=$(rg -n "spawnCreep" src test/unit | rg -v "^(src/spawning/runner\\.ts|src/commands/namespaces/spawn\\.ts|test/unit/mock\\.ts|test/unit/spawnPrimitives\\.test\\.ts|test/unit/kernel\\.test\\.ts):" || true); test "$runner" -eq 0; test -z "$unexpected"'` - FAIL due to existing dry-run command test at `test/unit/commandInspection.test.ts:831`; diagnostic run showed `runner=0`.

## User Setup Required

None.

## Next Phase Readiness

The minimal bootstrap loop path is wired and covered by unit evidence. Before closing the full phase as green, the orchestrator or a follow-up fix should address the lint error and align the two boundary grep commands with existing negative tests/read-only dry-run command tests.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/06-minimal-rcl1-bootstrap-loop/06-04-SUMMARY.md`.
- Key files exist: `src/runtime/Kernel.ts`, `src/environment/simBootstrap.ts`, `src/commands/namespaces/sim.ts`, `test/unit/kernel.test.ts`, `test/unit/mock.ts`.
- Task commits found in git log: `af6761d`, `481b72f`, `c82ff2e`, `f88c9d6`, `f63f092`.
- `STATE.md` and `ROADMAP.md` were not updated by this executor.

---
*Phase: 06-minimal-rcl1-bootstrap-loop*
*Completed: 2026-05-07*
