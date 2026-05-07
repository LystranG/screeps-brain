# Testing

Automated testing helps prevent regressions and reproduce complex failure
scenarios for bug fixing or feature implementation. This project uses Mocha for
unit tests and a local Screeps server mockup for integration tests.

Tests are executed as tests only if they include `.test.ts` in their filename.
If you have written a test file but aren't seeing it executed, this is probably
why. There are two separate test commands and configurations, as unit tests do
not need the complete Screeps server run-time as integration tests do.

## Running Tests

`npm test` runs the unit suite through `npm run test-unit`. Use this command for
the normal fast feedback loop.

Use `npm run test-integration` when you need built-bundle evidence against the
local Screeps harness. The project uses Node 22 through `mise.toml`; this script
bootstraps native mock-server runtime pieces, builds the bundle, and then runs
the integration Mocha suite. The effective integration command is:

```bash
npm run build && mocha test/integration/**/*.ts
```

Arguments after `--` are passed through to Mocha. For example, this command only
executes integration tests with `memory` in their description:

```bash
npm run test-integration -- -g memory
```

## Unit Testing

You can test code with simple run-time dependencies via the unit testing
support. Since unit testing is much faster than integration testing by orders of
magnitude, prefer unit tests wherever possible.

## Integration Testing

### Installed Harness

`screeps-server-mockup@1.5.1` is installed as a devDependency. No manual script
setup is required; `package.json` already provides:

```text
npm run test-integration
  -> npm run test-integration:bootstrap
  -> npm run build && mocha test/integration/**/*.ts
```

The build-first step is intentional. Integration tests load `dist/main.js`, so
running Rollup first prevents stale output from hiding source changes.

### Integration Testing with Screeps Server Mockup

Integration testing is for code that depends heavily on having a full game
environment. Server testing support is implemented via
[screeps-server-mockup](https://github.com/screepers/screeps-server-mockup),
which runs a local Screeps private-server style environment one tick at a time.

The project helper creates scenario-specific worlds and runs the compiled
`dist/main.js` bundle as the `player` bot. Current scenarios cover smoke
startup, normal owned-room bootstrap, official-sim-style ready behavior, and
degraded sim guidance paths.

Most methods exposed by the mock-server API are asynchronous, so tests and
helpers should use `await` for setup, ticking, console commands, and cleanup.
Mocha waits for returned Promises and `async` tests/hooks, which keeps these
integration tests ordered and debuggable.

Local integration tests are the primary automated evidence for runtime startup,
Memory initialization, command output, spawn queue behavior, and worker
harvest/upgrade progress. They are not a perfect replacement for official sim,
MMO, or private-server checks. Manual official sim and normal/private-room
verification steps are covered in `docs/operations.zh-CN.md`.

If local behavior differs from the MMO server, compare the stable `Memory`
fields and `global.cmd` output first. Full console-log snapshots are intentionally
not the main assertion surface because mock-server, official sim, MMO, and
private-server environments can differ in timing and diagnostics.
