---
phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
plan: 06
subsystem: docs
tags: [operations-runbook, chinese-docs, integration-tests, screeps-server-mockup, node22]
requires:
  - phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
    plan: 01
    provides: Node 22 build-first integration harness and `screeps-server-mockup@1.5.1`
  - phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
    plan: 04
    provides: accepted `rtk npm run test-integration` evidence path
  - phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
    plan: 05
    provides: runtime handoff closure and Node 22 gate confirmation
provides:
  - Simplified Chinese operator/developer runbook for local, sim, normal-room, and private-server startup
  - GitBook navigation entry for the Chinese operations guide
  - Updated integration testing documentation matching the enabled build-first Node 22 harness
affects: [phase-07, operations-docs, integration-testing, DOC-01, OPS-01]
tech-stack:
  added: []
  patterns: [scenario-based command documentation, Symptom -> checks -> fix troubleshooting, build-first integration documentation]
key-files:
  created:
    - docs/operations.zh-CN.md
    - .planning/phases/07-integration-testing-runtime-fixes-and-chinese-operations-gui/07-06-SUMMARY.md
  modified:
    - docs/SUMMARY.md
    - docs/in-depth/testing.md
key-decisions:
  - "Documented `npm run test-integration` as the current accepted integration entry; it uses the Node 22 wrapper and runs build before Mocha."
  - "Kept deployment safety explicit: docs reference `screeps.sample.json` for shape and say runtime code must not read `screeps.json`."
  - "Did not run graphify update because Plan 06 changed documentation only and no source files."
patterns-established:
  - "Chinese operations docs should be operator/developer runbooks with scenario-based `global.cmd` interpretation."
  - "Troubleshooting examples use exact `Symptom -> checks -> fix` headings."
requirements-completed: [OPS-01, DOC-01, TEST-07, TEST-08]
duration: 4min
completed: 2026-05-07
---

# Phase 07 Plan 06: Chinese Operations Runbook Summary

**Simplified Chinese operations runbook now connects local build/lint/unit/integration evidence to official sim, normal-room, private-server, command inspection, troubleshooting, and deployment-safety workflows.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-07T07:33:12Z
- **Completed:** 2026-05-07T07:36:43Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `docs/operations.zh-CN.md` as a Chinese operator/developer runbook.
- Documented local validation commands, including current `npm run test-integration` behavior: Node 22 wrapper, bootstrap, build-first Mocha integration gate.
- Covered official sim, normal MMO room, private server, and season deployment checks with scenario-based `global.cmd` inspection.
- Added `Symptom -> checks -> fix` troubleshooting for integration startup, missing sim objects, spawn queue stalls, worker upgrade stalls, stale build output, and degraded room state.
- Linked the guide from `docs/SUMMARY.md`.
- Updated `docs/in-depth/testing.md` to remove stale manual integration setup wording and document `screeps-server-mockup@1.5.1`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the Chinese operations runbook** - `1f09ed5` (docs)
2. **Task 2: Link docs navigation and refresh testing guide** - `38ff010` (docs)
3. **Task 3: Run final docs and full phase verification** - `266dd24` (test, empty verification commit)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified

- `docs/operations.zh-CN.md` - Chinese runbook for local validation, integration tests, official sim, normal/private room startup, command inspection, troubleshooting, and deployment safety.
- `docs/SUMMARY.md` - Added `[Chinese Operations Guide](operations.zh-CN.md)` to GitBook navigation.
- `docs/in-depth/testing.md` - Replaced starter-era manual integration setup docs with the enabled `screeps-server-mockup@1.5.1` and build-first Node 22 integration gate.
- `.planning/phases/07-integration-testing-runtime-fixes-and-chinese-operations-gui/07-06-SUMMARY.md` - Plan summary, verification evidence, deviations, and self-check.

## Decisions Made

- Used the current accepted `rtk npm run test-integration` route for integration documentation and verification. The package script enters `mise x node@22` and then runs `npm run test-integration:bootstrap && npm run build && mocha test/integration/**/*.ts`.
- Preserved deployment safety by referencing `screeps.sample.json` for shape and explicitly saying not to let runtime code read `screeps.json`.
- Kept command documentation scenario-based and read-only, with deploy scripts separated from inspection commands.
- Did not run `rtk graphify update .` because this plan changed docs only and no `src/` code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the approved Node 22 integration route instead of stale Node 16 plan text**
- **Found during:** Task 1 and Task 3
- **Issue:** The plan interfaces/verification block still required Node `v16.17.0`, but the user context, `07-01-SUMMARY.md`, `07-04-EVIDENCE.md`, and `07-05-SUMMARY.md` superseded it: Node 16 install is blocked by the old native dependency chain, and the accepted gate is `rtk npm run test-integration` through Node 22.
- **Fix:** Documented and verified the actual current project scripts: `npm run test-integration` enters Node 22, bootstraps native runtime pieces, builds first, and runs Mocha integration tests.
- **Files modified:** `docs/operations.zh-CN.md`, `docs/in-depth/testing.md`, `07-06-SUMMARY.md`
- **Verification:** `rtk npm run test-integration` exited 0 with 5 passing integration tests.
- **Committed in:** `1f09ed5`, `38ff010`, `266dd24`

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocker)
**Impact on plan:** The docs now match the accepted runtime evidence path and avoid sending operators to the known-broken Node 16 route.

## Issues Encountered

- The local SDK path `node ./node_modules/@gsd-build/sdk/dist/cli.js query state.load` was absent, so the PATH `gsd-sdk query state.load` fallback was used.
- Some state-specific SDK handlers (`state.advance-plan`, `state.update-progress`, `state.record-session`) could not parse the current `STATE.md` body fields, but `roadmap.update-plan-progress` and `requirements.mark-complete` succeeded and updated `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md`.
- The final integration gate still emits the previously documented `MaxListenersExceededWarning` after the suite passes. It did not fail tests and remains mock-server lifecycle diagnostic noise from Plan 04 evidence.

## Verification

- `rtk rg -n "lystran-brain 中文运维手册|本地验证|官方 sim 启动检查|普通房间/私服启动检查|Symptom -> checks -> fix|screeps.sample.json" docs/operations.zh-CN.md` - PASS.
- `rtk rg -n "npm run test-integration|npm run build && mocha test/integration/\\*\\*/\\*\\.ts|cmd\\.sim\\.guidance\\(\\)|cmd\\.colony\\.status\\(\\)|cmd\\.spawn\\.queue\\(\\)|cmd\\.strategy\\.status\\(\\)|cmd\\.debug\\.stats\\(\\)|missing-spawn|missing-source|missing-controller|不要让运行时代码读取 screeps\\.json" docs/operations.zh-CN.md` - PASS.
- `rtk rg -n "Chinese Operations Guide|operations\\.zh-CN\\.md|screeps-server-mockup@1\\.5\\.1|npm run build && mocha test/integration/\\*\\*/\\*\\.ts" docs/SUMMARY.md docs/in-depth/testing.md` - PASS.
- `rtk rg -n "You will also need to add scripts to run integration tests|yarn add -D screeps-server-mockup" docs/in-depth/testing.md` - PASS no matches.
- `rtk rg -n "Symptom -> checks -> fix|集成服务器|missing-spawn|spawn queue|worker|stale build|degraded" docs/operations.zh-CN.md` - PASS.
- `rtk rg -n "cmd\\.env\\.status\\(\\)|cmd\\.sim\\.status\\(\\)|cmd\\.sim\\.guidance\\(\\)|cmd\\.colony\\.status\\(\\)|cmd\\.spawn\\.queue\\(\\)|cmd\\.strategy\\.status\\(\\)|cmd\\.debug\\.stats\\(\\)" docs/operations.zh-CN.md` - PASS.
- `rtk rg -n "screeps\\.sample\\.json|不要让运行时代码读取 screeps\\.json|凭据" docs/operations.zh-CN.md` - PASS.
- `rtk sh -lc 'if rg -n "screeps\\.json" src; then exit 1; else test $? -eq 1; fi'` - PASS.
- `rtk npm run build` - PASS.
- `rtk npm run lint` - PASS.
- `rtk npm test` - PASS: 195 passing.
- `rtk npm run test-integration` - PASS: 5 passing through the Node 22 wrapper.

## Known Stubs

None. Stub scan found no placeholder/TODO/FIXME or hardcoded empty UI/data values in files created or modified by this plan.

## Threat Flags

None. Plan 06 changed documentation only and introduced no new runtime endpoints, auth paths, file access patterns, schema changes, or source trust-boundary changes.

## User Setup Required

None. Operators should continue using the existing project scripts and local ignored deployment credentials described by `screeps.sample.json`.

## Next Phase Readiness

Phase 07 is ready to close: integration harness, runtime evidence, handoff closure, and Chinese operations documentation are complete with current build, lint, unit, integration, and credential-boundary gates passing.

## Self-Check: PASSED

- Created files exist: `docs/operations.zh-CN.md`, `07-06-SUMMARY.md`.
- Modified files exist: `docs/SUMMARY.md`, `docs/in-depth/testing.md`.
- Task commits exist: `1f09ed5`, `38ff010`, `266dd24`.
- No tracked file deletions were introduced.
- No runtime source files were modified.

---
*Phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui*
*Completed: 2026-05-07*
