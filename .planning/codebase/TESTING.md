# Testing Patterns

**Analysis Date:** 2026-05-03

## Test Framework

**Runner:**
- Mocha `^5.2.0`
- Config: `test/mocha.opts`
- TypeScript runtime: `ts-node/register` with `TS_NODE_PROJECT=tsconfig.test.json` set in `test/setup-mocha.js`

**Assertion Library:**
- Chai `^4.2.0`, using `assert` imports in `test/unit/main.test.ts` and `test/integration/integration.test.ts`.
- Sinon `^6.3.5` and `sinon-chai` `^3.2.0` are registered globally in `test/setup-mocha.js`, but no local tests use spies/stubs directly.

**Run Commands:**
```bash
npm test                  # Run unit tests through package.json "test"
npm run test-unit         # Run Mocha against test/unit/**/*.ts
npm run test-integration  # Prints setup guidance; integration execution is not enabled in package.json
npm run lint              # Lint src/**/*.ts
npm run build             # Build dist/main.js through Rollup
```

## Test File Organization

**Location:**
- Unit tests live in `test/unit/` and run by default through `package.json` script `test-unit`.
- Unit test fixtures live next to unit tests, such as `test/unit/mock.ts`.
- Integration tests live in `test/integration/`, with shared Screeps server setup in `test/integration/helper.ts`.
- Mocha setup lives in `test/setup-mocha.js`; Mocha options live in `test/mocha.opts`.

**Naming:**
- Use `.test.ts` for executable tests, such as `test/unit/main.test.ts` and `test/integration/integration.test.ts`.
- Use descriptive helper names without `.test.ts` for support files, such as `test/unit/mock.ts` and `test/integration/helper.ts`.

**Structure:**
```text
test/
├── mocha.opts              # Mocha runtime options and require hooks
├── setup-mocha.js          # Global lodash/mocha/chai/sinon setup and ts-node project override
├── unit/
│   ├── main.test.ts        # Fast tests for src/main.ts loop behavior
│   └── mock.ts             # Minimal Game and Memory fixtures
└── integration/
    ├── helper.ts           # ScreepsServer lifecycle helper
    └── integration.test.ts # Async server-backed examples
```

## Test Structure

**Suite Organization:**
```typescript
import {assert} from "chai";
import {loop} from "../../src/main";
import {Game, Memory} from "./mock"

describe("main", () => {
  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = _.clone(Game);
    // @ts-ignore : allow adding Memory to global
    global.Memory = _.clone(Memory);
  });

  it("should export a loop function", () => {
    assert.isTrue(typeof loop === "function");
  });
});
```

**Patterns:**
- Use one top-level `describe("main", ...)` suite per entry point in `test/unit/main.test.ts` and `test/integration/integration.test.ts`.
- Use `beforeEach` to reset global Screeps state before each unit test. `test/unit/main.test.ts` clones `Game` and `Memory` from `test/unit/mock.ts`.
- Keep unit tests synchronous unless they touch async APIs. `test/unit/main.test.ts` calls `loop()` directly and asserts in-memory side effects.
- Use regular `async function ()` for Mocha tests that may need a test context or timeout handling. `test/integration/integration.test.ts` uses `async function ()` for server-backed tests.
- Use direct Chai `assert.*` calls for expectations, such as `assert.isUndefined`, `assert.isDefined`, and `assert.equal`.

## Mocking

**Framework:** Hand-written fixtures for unit tests; `sinon` and `sinon-chai` are available globally from `test/setup-mocha.js`.

**Patterns:**
```typescript
// test/unit/mock.ts
export const Game: {
  creeps: { [name: string]: any };
  rooms: any;
  spawns: any;
  time: any;
} = {
  creeps: {},
  rooms: [],
  spawns: {},
  time: 12345
};

export const Memory: {
  creeps: { [name: string]: any };
} = {
  creeps: {}
};
```

**What to Mock:**
- Mock Screeps globals (`Game`, `Memory`) in unit tests when the code under test only needs a small subset of runtime state. Use `test/unit/mock.ts` as the pattern.
- Clone fixtures before assigning to `global` so each test starts with isolated `Game` and `Memory` objects, as in `test/unit/main.test.ts`.
- Mock only the game surface needed by the behavior under test; `test/unit/mock.ts` includes `creeps`, `rooms`, `spawns`, and `time`.

**What NOT to Mock:**
- Do not mock the full Screeps server for integration tests. Use `screeps-server-mockup` through `test/integration/helper.ts`.
- Do not mock source modules under `src/` for basic entry-point tests; import `loop` from `src/main.ts` and assert real behavior.

## Fixtures and Factories

**Test Data:**
```typescript
Memory.creeps.persistValue = "any value";
Memory.creeps.notPersistValue = "any value";

Game.creeps.persistValue = "any value";

loop();

assert.isDefined(Memory.creeps.persistValue);
assert.isUndefined(Memory.creeps.notPersistValue);
```

**Location:**
- Unit fixtures: `test/unit/mock.ts`
- Integration server fixture and lifecycle hooks: `test/integration/helper.ts`
- Mocha global library fixture: `test/setup-mocha.js`

## Coverage

**Requirements:** None enforced. No coverage tool or coverage threshold is configured in `package.json`, `test/mocha.opts`, or repository config files.

**View Coverage:**
```bash
# Not configured
```

## Test Types

**Unit Tests:**
- Scope: fast behavior tests for source modules that can run with minimal Screeps globals.
- Command: `npm run test-unit`
- Example: `test/unit/main.test.ts` verifies that `loop` is exported, returns `void`, and deletes memory for missing creeps.
- Add new unit tests under `test/unit/` and keep helper fixtures close to the tests that use them.

**Integration Tests:**
- Scope: behavior that depends on an actual Screeps runtime and server tick progression.
- Scaffold: `test/integration/helper.ts` creates `ScreepsServer`, resets/stubs a 3x3 world, loads `dist/main.js`, adds a bot, starts the server, and stops it after each test.
- Example: `test/integration/integration.test.ts` advances server ticks and reads/writes player memory.
- Command state: `package.json` `test-integration` prints setup guidance. `docs/in-depth/testing.md` documents enabling this by installing `screeps-server-mockup`, building first, and changing the script to `npm run build && mocha test/integration/**/*.ts`.

**E2E Tests:**
- Not used. The closest equivalent is the Screeps server-backed integration scaffold in `test/integration/`.

## Common Patterns

**Async Testing:**
```typescript
it("runs a server and matches the game tick", async function () {
  for (let i = 1; i < 10; i += 1) {
    assert.equal(await helper.server.world.gameTime, i);
    await helper.server.tick();
  }
});
```

**Error Testing:**
```typescript
// No dedicated error-path tests are present.
// Add error tests with assert.throws for synchronous failures or rejected promises for async helpers.
```

---

*Testing analysis: 2026-05-03*
