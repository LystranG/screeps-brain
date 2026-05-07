# 07-04 Integration Evidence

## Environment

- Date captured: 2026-05-07T07:07:59Z
- Ambient command shell: `rtk`
- Ambient Node: `v25.9.0`
- Accepted integration command: `rtk npm run test-integration`
- Wrapper Node: `v22.22.2` via `npm run test-integration` -> `mise x node@22 -- npm run test-integration:node22 --`
- Superseded plan target: `node: v16.17.0` was not used for the integration gate because 07-01 evidence and user approval established that Node 16 dependency installation is blocked by the old native chain, while ambient Node 25 reproduces `engine_runner SIGSEGV`.
- Effective gate: Node 22 integration wrapper is the current accepted evidence path.

## Command Result

PASS

Command:

```bash
rtk npm run test-integration
```

Exit code: 0

Relevant output excerpt:

```text
> npm run test-integration:bootstrap && npm run build && mocha test/integration/**/*.ts
rebuilt dependencies successfully
rebuilt dependencies successfully
Runtime snapshot created (2462009 bytes)
> rollup -c
No destination specified - code will be compiled but not uploaded
cleared: /Users/lystran/programming/screeps/dist

  integration harness smoke
    ✓ ticks the built bundle and exposes project Memory plus global cmd output (448ms)

  normal owned-room bootstrap
    ✓ initializes kernel, Memory, colony readiness, processes, and commands (415ms)
    ✓ creates a worker and progresses harvest and upgrade within bounded ticks (308ms)

  official-sim-style bootstrap
    ✓ uses the normal runtime path when sim has required objects (723ms)
    ✓ records degraded guidance without breaking kernel health (2453ms)

  5 passing (4s)
src/main.ts -> dist/main.js...
created dist/main.js in 588ms
(node:45785) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 playerSandbox listeners added to [EventEmitter]. MaxListeners is 10.
```

Warning/gap:

- `MaxListenersExceededWarning` appears after the passing suite when repeated sim/degraded cases add `playerSandbox` listeners through the mock-server driver config. This is diagnostic noise from the integration harness lifecycle, not a failing assertion or source handoff. No test was skipped or weakened.

## Failure Classification

| Item | Result | Classification | Evidence | Next action |
|------|--------|----------------|----------|-------------|
| none | PASS | full integration suite passed | `5 passing`; Memory/command assertions covered smoke, normal owned-room bootstrap, and official-sim-style bootstrap suites | no runtime handoff |

## Runtime Gap Handoff

None. The full integration suite passed through the accepted Node 22 wrapper, and no source subsystem failure was observed.

## Plan 05 Closure

- Closed by: Plan 07-05
- Result: no runtime hardening applied because this evidence file contains no concrete `runtime hardening gap`.
- Runtime source edits: none.
- Boundary: Plan 07-05 proceeds with verification and boundary gates only.
