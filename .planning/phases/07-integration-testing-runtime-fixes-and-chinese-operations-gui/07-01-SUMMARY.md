---
phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui
plan: 01
subsystem: testing
tags: [screeps-server-mockup, integration-tests, mocha, node22, native-snapshot]
requires:
  - phase: 06-minimal-rcl1-bootstrap-loop
    provides: minimal bootstrap runtime, command surface, and unit-tested sim/normal-room paths
provides:
  - Build-first `npm run test-integration` script
  - `screeps-server-mockup@1.5.1` devDependency and Node 22 integration runtime
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
  - "Approved deviation: attempted ambient Node v25.9.0 first; it reproducibly crashes `engine_runner` under `server.tick()`."
  - "Pinned the integration gate to Node 22 via `mise x node@22` because `screeps@4.3.0` requires Node >=22.9.0 and Node 25 is incompatible with the native/V8 snapshot path."
  - "Changed the `isolated-vm` override to `5.0.4`, and added a Node 22 bootstrap that rebuilds `@screeps/driver`, rebuilds nested `isolated-vm`, and regenerates `runtime.snapshot.bin` before integration tests."
  - "Kept `screeps.json` unread and kept `package-lock.json` local/ignored."
patterns-established:
  - "Integration helpers return scenario-owned `IntegrationTestHelper` instances; tests own `close()` cleanup."
  - "Integration assertions check stable Memory fields and short command tokens, not full console logs."
requirements-completed: [TEST-07]
duration: 28min + blocker fix
completed: 2026-05-07
---

# Phase 07 Plan 01: Integration Harness Summary

**Build-first Screeps integration harness and scenario helpers are in place, and the Plan 01 smoke gate now passes from the original `rtk npm run test-integration -- --grep "integration harness smoke"` command.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-05-07T05:24:06Z
- **Completed:** 2026-05-07T05:52:13Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Enabled `npm run test-integration` as a Node 22 wrapper around a build-first integration gate.
- Added `screeps-server-mockup@1.5.1` as a devDependency and made it load under ambient Node `v25.9.0`.
- Added `test-integration:bootstrap` to rebuild native Screeps driver pieces and regenerate the V8 runtime snapshot under Node 22 before integration tests.
- Added reusable integration helper APIs for startup, cleanup, bounded ticking, Memory reads, command execution, diagnostics, and sim-shard probing.
- Added owned-room, sim-ready, and degraded-sim scenario factories plus stable assertion helpers.
- Replaced the starter integration smoke with an `integration harness smoke` suite against the built bundle.
- Fixed the mock-server module map so local Screeps runtime can resolve project modules required by `dist/main.js`.

## Task Commits

1. **Task 1: Install integration dependency and build-first test script** - `1b086e8` (chore)
2. **Task 2: Build observable integration helper and scenario factories** - `f990d86` (test)
3. **Task 3: Add stable integration assertion helpers and smoke coverage** - `dd30b37` (test)

## Files Created/Modified

- `package.json` - Node 22 integration wrapper, bootstrap script, mock server devDependency, and `isolated-vm@5.0.4` override.
- `test/integration/helper.ts` - Scenario-owned mock server lifecycle, Memory/command helpers, diagnostics, sim probe, bounded tick timeout, module map loading, and direct runtime fallback.
- `test/integration/scenarios.ts` - Owned-room, sim-ready, degraded-sim, and sim-capability scenario factories.
- `test/integration/assertions.ts` - Stable Memory and command-token assertion helpers.
- `test/integration/integration.test.ts` - Build-bundle integration smoke suite.

## Decisions Made

- Used ambient `rtk node` / `rtk npm` first as explicitly approved. Verification recorded `v25.9.0` and reproduced `engine_runner SIGSEGV`.
- Selected Node `v22.22.2` for integration because `screeps@4.3.0` declares `node >=22.9.0`; Node 20 produced `SIGTRAP` and an engine warning, while Node 25 produced `SIGSEGV`.
- Regenerated `@screeps/driver/build/runtime.snapshot.bin` under Node 22 with `node --no-node-snapshot` during integration bootstrap.
- Used direct `driver.makeRuntime()` in the helper after `server.tick()` to avoid relying on the unstable child `engine_runner` while still exercising the Screeps runtime and built bundle.
- Kept `package-lock.json` local and untracked because `.gitignore` still ignores `/package-lock.json`.
- Kept `screeps.json` unread.
- Marked TEST-07 unblocked by passing smoke evidence. TEST-08 remains for later sim-specific coverage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched Node verification from v16.17.0 to ambient Node v25.9.0**
- **Found during:** Task 1
- **Issue:** The plan required Node v16.17.0 wrappers, but the user explicitly approved trying newer ambient Node first after Node 16 dependency installation was blocked.
- **Fix:** Ran install/build/test checks through ambient `rtk npm` / `rtk node`; recorded `v25.9.0`.
- **Files modified:** `package.json`, `test/integration/helper.ts`, `07-01-SUMMARY.md`
- **Verification:** `rtk node -v` -> `v25.9.0`; build/lint/unit passed under ambient Node.
- **Committed in:** `1b086e8`, `dd30b37`

**2. [Rule 3 - Blocking] Replaced incompatible native dependency/runtime pairing**
- **Found during:** Task 1
- **Issue:** `isolated-vm@6.1.2` could install under Node 25, but the Screeps runtime snapshot/native path crashed during tick execution. Node 20 could not cleanly support `screeps@4.3.0`, and Node 22 with a Node-25 snapshot failed with V8 snapshot mismatch.
- **Fix:** Pinned `isolated-vm: 5.0.4`, ran integration under Node 22, and bootstrapped `@screeps/driver` native bindings plus `runtime.snapshot.bin` under that same Node version.
- **Files modified:** `package.json`
- **Verification:** `rtk npm run test-integration -- --grep "integration harness smoke"` exits 0 from ambient Node after entering the Node 22 wrapper and regenerating the runtime snapshot.
- **Committed in:** `1b086e8`

**3. [Rule 3 - Blocking] Added bounded tick diagnostics**
- **Found during:** Task 3
- **Issue:** Under ambient Node, `server.tick()` can hang until Mocha's hard timeout, hiding the real mock-server failure.
- **Fix:** Wrapped helper `tick()` in a 10s timeout that reports game time, recent console output, and server process events.
- **Files modified:** `test/integration/helper.ts`
- **Verification:** Smoke now fails quickly with `engine_runner ... exited by signal SIGSEGV`.
- **Committed in:** `dd30b37`

---

**4. [Rule 3 - Blocking] Added integration module map and direct runtime fallback**
- **Found during:** blocker fix
- **Issue:** Once native crashes were fixed, `driver.makeRuntime()` reported `Unknown module 'constants/runtime'` because the mock server received only `{ main: dist/main.js }`, while the bundle still contained project `require(...)` calls.
- **Fix:** `IntegrationTestHelper` now loads `dist/main.js` as `main` and supplements the mock-server modules map with CommonJS-transpiled `src/**/*.ts` modules. The helper also runs the current player through `driver.makeRuntime()` after each `server.tick()` so Memory/console assertions do not depend on the unstable child runner.
- **Files modified:** `test/integration/helper.ts`
- **Verification:** Smoke passes and asserts Memory plus `cmd.help()` output.

**Total deviations:** 4 auto-fixed (4 Rule 3 blockers)
**Impact on plan:** The harness code, dependency metadata, and smoke integration gate are now usable through the Node 22 wrapper.

## Issues Encountered

- `rtk npm install` initially failed in sandbox with DNS/network restrictions; reran with approved network escalation.
- `PYTHON=python3 npm install` exposed `node-gyp@3.8.0` Python 2 syntax in the old `@screeps/driver` chain.
- `npm install --ignore-scripts`, `npm rebuild isolated-vm`, and `npm rebuild @screeps/driver` were needed locally to build native bindings under Node 25.
- Ambient Node `v25.9.0` still fails with `engine_runner` `SIGSEGV`; `NODE_OPTIONS=--no-node-snapshot` alone did not fix it.
- Node 22 initially failed because native bindings and `@screeps/driver/build/runtime.snapshot.bin` had been built/generated by another Node/V8 version.
- Node 20 with `isolated-vm@5.0.4` still failed with `SIGTRAP`, and `screeps@4.3.0` declares `node >=22.9.0`; Node 20 is not the chosen tradeoff.
- After the native issue was fixed, the harness exposed an independent module-map issue: `dist/main.js` required `constants/runtime`, which the mock server did not know unless source modules were provided.

## Verification

- `rtk node -v` - PASS: `v25.9.0` for ambient reproduction
- `rtk mise x node@22 -- node -v` - PASS: `v22.22.2`
- `rtk node -e "require('screeps-server-mockup')"` - PASS: exports `ScreepsServer,TerrainMatrix,stdHooks`
- `rtk mise x node@22 -- ./node_modules/.bin/tsc -p tsconfig.test.json --noEmit` - PASS
- `rtk mise x node@22 -- npm run build` - PASS
- `rtk mise x node@22 -- npm run lint` - PASS
- `rtk mise x node@22 -- npm test` - PASS: 195 passing
- `rtk npm run test-integration -- --grep "integration harness smoke"` - PASS: 1 passing
- `rtk mise x node@22 -- npm run test-integration:node22` - PASS: 1 passing
- `rtk graphify update .` - PASS

## Known Stubs

None. Grep hits for `= []`, `= {}`, and `= null` are normal helper defaults and cleanup guards, not UI/rendered stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: local-network-process | `test/integration/helper.ts` | Integration tests now start a local Screeps storage/engine process and bind a local port through `screeps-server-mockup`. |
| threat_flag: console-command-eval | `test/integration/helper.ts` | `runCommand()` sends test command strings to Screeps `player.console(...)`; intended for fixed test commands only. |

## User Setup Required

Node 22 must be available through `mise`. The `test-integration` script invokes `mise x node@22` automatically and bootstraps native bindings/snapshot before tests.

## Next Phase Readiness

Phase 07 can continue. Later plans should keep integration commands on the `npm run test-integration` wrapper or `rtk mise x node@22 -- npm run test-integration:node22`, not ambient Node 25.

## Self-Check: PASSED

- Created files exist: `test/integration/scenarios.ts`, `test/integration/assertions.ts`, `07-01-SUMMARY.md`.
- Task commits exist: `1b086e8`, `f990d86`, `dd30b37`.
- No tracked file deletions were introduced.

---
*Phase: 07-integration-testing-runtime-fixes-and-chinese-operations-gui*
*Completed: 2026-05-07*
