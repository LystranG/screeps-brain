---
phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
plan: 01
subsystem: testing
tags: [screeps-server-mockup, integration-tests, mocha, node25]
requires:
  - phase: 06-minimal-rcl1-bootstrap-loop
    provides: minimal bootstrap runtime, command surface, and unit-tested sim/normal-room paths
provides:
  - Build-first `npm run test-integration` script
  - `screeps-server-mockup@1.5.1` devDependency and Node 25 install workaround
  - Observable integration helper with Memory, command, diagnostics, and bounded tick methods
  - Owned-room, sim-ready, and degraded-sim scenario factories
  - Stable integration assertion helpers and smoke suite
affects: [phase-07, integration-testing, operations-runbook]
tech-stack:
  added: [screeps-server-mockup@1.5.1]
  patterns: [build-first integration tests, scenario factories, stable Memory assertions, bounded mock-server diagnostics]
key-files:
  created:
    - test/integration/scenarios.ts
    - test/integration/assertions.ts
  modified:
    - package.json
    - test/integration/helper.ts
    - test/integration/integration.test.ts
key-decisions:
  - "Approved deviation: attempted ambient Node v25.9.0 first because Node 16 dependency installation was blocked."
  - "Removed the earlier Node 16-oriented `screeps`/`isolated-vm` overrides and kept only `isolated-vm: 6.1.2` so Node 25 installs from the npm tarball instead of a missing-header GitHub snapshot."
  - "Did not mark TEST-07 or TEST-08 complete because the mock server tick gate still fails under ambient Node."
patterns-established:
  - "Integration helpers return scenario-owned `IntegrationTestHelper` instances; tests own `close()` cleanup."
  - "Integration assertions check stable Memory fields and short command tokens, not full console logs."
requirements-completed: []
duration: 28min
completed: 2026-05-07
---

# Phase 07 Plan 01: Integration Harness Summary

**Build-first Screeps integration harness and scenario helpers are in place, with ambient Node 25 dependency loading proven but mock-server ticking blocked by an upstream engine runner crash.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-05-07T05:24:06Z
- **Completed:** 2026-05-07T05:52:13Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Enabled `npm run test-integration` as `npm run build && mocha test/integration/**/*.ts`.
- Added `screeps-server-mockup@1.5.1` as a devDependency and made it load under ambient Node `v25.9.0`.
- Added reusable integration helper APIs for startup, cleanup, bounded ticking, Memory reads, command execution, diagnostics, and sim-shard probing.
- Added owned-room, sim-ready, and degraded-sim scenario factories plus stable assertion helpers.
- Replaced the starter integration smoke with an `integration harness smoke` suite against the built bundle.

## Task Commits

1. **Task 1: Install integration dependency and build-first test script** - `1b086e8` (chore)
2. **Task 2: Build observable integration helper and scenario factories** - `f990d86` (test)
3. **Task 3: Add stable integration assertion helpers and smoke coverage** - `dd30b37` (test)

## Files Created/Modified

- `package.json` - Build-first integration script, mock server devDependency, and Node 25 `isolated-vm` override.
- `test/integration/helper.ts` - Scenario-owned mock server lifecycle, Memory/command helpers, diagnostics, sim probe, and bounded tick timeout.
- `test/integration/scenarios.ts` - Owned-room, sim-ready, degraded-sim, and sim-capability scenario factories.
- `test/integration/assertions.ts` - Stable Memory and command-token assertion helpers.
- `test/integration/integration.test.ts` - Build-bundle integration smoke suite.

## Decisions Made

- Used ambient `rtk node` / `rtk npm` first as explicitly approved. Verification recorded `v25.9.0`.
- Kept `package-lock.json` local and untracked because `.gitignore` still ignores `/package-lock.json`.
- Kept `screeps.json` unread.
- Kept `TEST-07` and `TEST-08` open because the integration tick gate did not pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched Node verification from v16.17.0 to ambient Node v25.9.0**
- **Found during:** Task 1
- **Issue:** The plan required Node v16.17.0 wrappers, but the user explicitly approved trying newer ambient Node first after Node 16 dependency installation was blocked.
- **Fix:** Ran install/build/test checks through ambient `rtk npm` / `rtk node`; recorded `v25.9.0`.
- **Files modified:** `package.json`, `test/integration/helper.ts`, `07-01-SUMMARY.md`
- **Verification:** `rtk node -v` -> `v25.9.0`; build/lint/unit passed under ambient Node.
- **Committed in:** `1b086e8`, `dd30b37`

**2. [Rule 3 - Blocking] Replaced Node 16-oriented dependency overrides**
- **Found during:** Task 1
- **Issue:** Earlier overrides pinned `screeps@4.1.5`, which pulled `@screeps/driver@5.1.0` and `node-gyp@3.8.0`; that requires Python 2 syntax and fails with Python 3 under Node 25.
- **Fix:** Removed the `screeps`/`isolated-vm@4.7.2` overrides and added only `isolated-vm: 6.1.2` so `screeps@4.3.0` and `@screeps/driver@5.3.0` can install with `node-gyp@12.2.0`.
- **Files modified:** `package.json`
- **Verification:** `require("screeps-server-mockup")` returned `ScreepsServer,TerrainMatrix,stdHooks`.
- **Committed in:** `1b086e8`

**3. [Rule 3 - Blocking] Added bounded tick diagnostics**
- **Found during:** Task 3
- **Issue:** Under ambient Node, `server.tick()` can hang until Mocha's hard timeout, hiding the real mock-server failure.
- **Fix:** Wrapped helper `tick()` in a 10s timeout that reports game time, recent console output, and server process events.
- **Files modified:** `test/integration/helper.ts`
- **Verification:** Smoke now fails quickly with `engine_runner ... exited by signal SIGSEGV`.
- **Committed in:** `dd30b37`

---

**Total deviations:** 3 auto-fixed (3 Rule 3 blockers)
**Impact on plan:** The harness code and dependency metadata were completed, but the core runtime integration gate remains blocked by the local mock server dependency under Node 25.

## Issues Encountered

- `rtk npm install` initially failed in sandbox with DNS/network restrictions; reran with approved network escalation.
- `PYTHON=python3 npm install` exposed `node-gyp@3.8.0` Python 2 syntax in the old `@screeps/driver` chain.
- `npm install --ignore-scripts`, `npm rebuild isolated-vm`, and `npm rebuild @screeps/driver` were needed locally to build native bindings under Node 25.
- `npm run test-integration -- --grep "integration harness smoke"` fails after build because `screeps-server-mockup@1.5.1` resolves to `screeps@4.3.0`; `server.tick()` times out and diagnostics show `engine_runner` exits by `SIGSEGV`.
- A standalone minimal mockup tick reproduced the same blocker: server start reaches game time 1, then `server.tick()` times out.

## Verification

- `rtk node -v` - PASS: `v25.9.0`
- `rtk node -e "require('screeps-server-mockup')"` - PASS: exports `ScreepsServer,TerrainMatrix,stdHooks`
- `rtk ./node_modules/.bin/tsc -p tsconfig.test.json --noEmit` - PASS
- `rtk npm run build` - PASS
- `rtk npm run lint` - PASS
- `rtk npm run test-unit` - PASS: 195 passing
- `rtk graphify update .` - PASS
- `rtk npm run test-integration -- --grep "integration harness smoke"` - FAIL: build succeeds, mock server starts, but `server.tick()` times out because `engine_runner` exits with `SIGSEGV`.

## Known Stubs

None. Grep hits for `= []`, `= {}`, and `= null` are normal helper defaults and cleanup guards, not UI/rendered stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: local-network-process | `test/integration/helper.ts` | Integration tests now start a local Screeps storage/engine process and bind a local port through `screeps-server-mockup`. |
| threat_flag: console-command-eval | `test/integration/helper.ts` | `runCommand()` sends test command strings to Screeps `player.console(...)`; intended for fixed test commands only. |

## User Setup Required

None for code changes. The integration tick gate remains technically blocked under ambient Node `v25.9.0`.

## Next Phase Readiness

Phase 07 can continue only if later plans either:

- run the mock server under a Node version that does not crash its engine runner,
- patch/replace the mock-server dependency chain, or
- classify local mock ticking as an external limitation and move full tick evidence to a documented manual/private-server fallback.

## Self-Check: PASSED

- Created files exist: `test/integration/scenarios.ts`, `test/integration/assertions.ts`, `07-01-SUMMARY.md`.
- Task commits exist: `1b086e8`, `f990d86`, `dd30b37`.
- No tracked file deletions were introduced.

---
*Phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui*
*Completed: 2026-05-07*
