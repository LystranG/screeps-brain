# Testing Patterns

**Analysis Date:** 2026-05-07

Scope: `src` behavior and related tests under `test/`.

## Test Framework

**Runner:**
- Mocha 5.2.0
- Config: `test/mocha.opts`
- TypeScript execution: `ts-node/register` from `test/mocha.opts`
- Source alias support: `tsconfig-paths/register` from `test/mocha.opts`
- Test TypeScript module mode: `tsconfig.test.json` extends `tsconfig.json` and overrides `module` to `CommonJs`.

**Assertion Library:**
- Chai 4.2.0, usually imported as `import { assert } from "chai";` in `test/unit/*.test.ts`.
- Sinon 6.3.5 for stubs and spies, usually imported as `import * as sinon from "sinon";`.
- Sinon-Chai is registered globally in `test/setup-mocha.js`.

**Run Commands:**
```bash
npm test                  # Run unit tests through npm run test-unit
npm run test-unit         # Run Mocha over test/unit/**/*.ts
npm run test-integration  # Print integration-test setup guidance
npm run lint              # Lint src/**/*.ts
npm run build             # Rollup build for dist/main.js
```

## Test File Organization

**Location:**
- Unit tests live in `test/unit/` and exercise `src` modules directly.
- Integration test scaffolding lives in `test/integration/` and targets built `dist/main.js`.
- Mocha global setup lives in `test/setup-mocha.js`.
- Screeps mock helpers live in `test/unit/mock.ts`.

**Naming:**
- Unit test files use `.test.ts`: `test/unit/kernel.test.ts`, `test/unit/memory.test.ts`, `test/unit/commandCore.test.ts`, `test/unit/spawnPrimitives.test.ts`, `test/unit/behaviorPrimitives.test.ts`.
- Integration test files use `.test.ts`: `test/integration/integration.test.ts`.
- Shared test helpers use descriptive non-test names: `test/unit/mock.ts`, `test/integration/helper.ts`.

**Structure:**
```text
test/
├── mocha.opts              # Mocha runner configuration
├── setup-mocha.js          # Global lodash/mocha/chai/sinon setup and TS_NODE_PROJECT
├── unit/
│   ├── mock.ts             # Screeps constants, Game/Memory mocks, room helpers
│   ├── main.test.ts        # src/main.ts loop contract
│   ├── kernel.test.ts      # src/runtime/Kernel.ts lifecycle and integrated runtime flow
│   ├── memory.test.ts      # src/memory/migrations.ts version repair
│   ├── memorySchema.test.ts
│   ├── command*.test.ts    # src/commands/* and namespaces
│   ├── strategyPlanner.test.ts
│   ├── spawnPrimitives.test.ts
│   ├── behaviorPrimitives.test.ts
│   └── observability.test.ts
└── integration/
    ├── helper.ts           # screeps-server-mockup harness
    └── integration.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { assert } from "chai";
import * as sinon from "sinon";
import { Kernel, LifecycleStageOverrides } from "../../src/runtime/Kernel";
import { createMockGame, createMockMemory } from "./mock";

describe("kernel|stats cleanup|kernel runtime kernel", () => {
  let consoleLog: sinon.SinonStub | null = null;

  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = createMockGame();
    // @ts-ignore : allow adding Memory to global
    global.Memory = createMockMemory();
  });

  afterEach(() => {
    if (consoleLog) {
      consoleLog.restore();
      consoleLog = null;
    }
  });

  it("continues after non-migration stage failure", () => {
    consoleLog = sinon.stub(console, "log");
    const stages: LifecycleStageOverrides = {};
    const result = new Kernel({ stages }).run();

    assert.isFalse(result.ok);
  });
});
```

**Patterns:**
- Group related behavior by source domain in `describe` names. Examples: `command core|arguments` in `test/unit/commandCore.test.ts`, `spawn primitives lifecycle runner` in `test/unit/spawnPrimitives.test.ts`, and `behavior primitives task executor` in `test/unit/behaviorPrimitives.test.ts`.
- Use `beforeEach` to assign fresh `global.Game` and `global.Memory` when testing code that reads Screeps globals, as in `test/unit/main.test.ts`, `test/unit/kernel.test.ts`, and `test/unit/cleanup.test.ts`.
- Use `afterEach` to restore stubs and delete global command state, as in `test/unit/kernel.test.ts` and `test/unit/commandInstall.test.ts`.
- Prefer exact shape assertions with `assert.deepEqual` for persistent Memory records, command results, task records, spawn requests, and summaries.
- Use focused scalar assertions with `assert.equal`, `assert.isTrue`, `assert.isFalse`, `assert.include`, `assert.lengthOf`, and `assert.containsAllKeys` when checking incremental state.
- Keep helpers local to the test file when they are domain-specific, such as `createStrategyContext()` in `test/unit/strategyPlanner.test.ts`, `createSpawn()` in `test/unit/spawnPrimitives.test.ts`, and `createActionCreep()` in `test/unit/behaviorPrimitives.test.ts`.

## Mocking

**Framework:** Sinon plus hand-built Screeps object mocks.

**Patterns:**
```typescript
let consoleLog: sinon.SinonStub | null = null;

afterEach(() => {
  if (consoleLog) {
    consoleLog.restore();
    consoleLog = null;
  }
});

it("emits info, warn, and error through console.log by default", () => {
  consoleLog = sinon.stub(console, "log");
  const logger = new Logger({}, () => 10);

  logger.info("kernel:migrate", "migration ok");

  assert.isTrue(consoleLog.calledWith("[info] kernel:migrate: migration ok"));
});
```

**Screeps global mocking:**
- `test/unit/mock.ts` installs Screeps constants on `global`: `FIND_SOURCES`, `FIND_MY_CREEPS`, `STRUCTURE_SPAWN`, `WORK`, `CARRY`, `MOVE`, `OK`, error codes, and `RESOURCE_ENERGY`.
- Use `createMockGame()` from `test/unit/mock.ts` for a fresh Game-like object with `creeps`, `cpu`, `shard`, `rooms`, `spawns`, `flags`, `time`, and `getObjectById()`.
- Use `createMockMemory()` from `test/unit/mock.ts` for minimal `Memory` when migration/default code should fill the rest.
- Use `createMockRoom()` from `test/unit/mock.ts` to provide `room.find()` results for colony context tests and integrated kernel tests.
- Use local fake Screeps objects for behavior tests. `test/unit/spawnPrimitives.test.ts` defines `createSpawn()` with `spawnCreep()` call recording; `test/unit/behaviorPrimitives.test.ts` defines `createActionCreep()` with action call recording.

**What to Mock:**
- Mock `Game`, `Memory`, Screeps constants, rooms, spawns, creeps, controller/source targets, and console output.
- Mock CPU values through a provider function or `Game.cpu.getUsed`, as in `test/unit/observability.test.ts` and `test/unit/kernel.test.ts`.
- Stub `Logger.warn` or `console.log` when asserting observability behavior, as in `test/unit/simBootstrap.test.ts` and `test/unit/observability.test.ts`.
- Mock command global state (`cmd`, `__cmdApiVersion`) only in tests for `src/commands/installer.ts` and integrated kernel command installation.

**What NOT to Mock:**
- Do not mock pure planning logic in `src/strategy/planner.ts`; build a `ColonyContext` fixture and assert the resulting `StrategyPlanMemory`.
- Do not mock Memory migrations when testing lifecycle integration; `test/unit/kernel.test.ts` runs real `runMemoryMigrations()` through `Kernel.run()`.
- Do not mock command registries when testing namespace behavior; use `createCommandRegistry()` or `createDefaultCommandRegistry()` from `src/commands/registry.ts`.
- Do not use the integration server for unit-level behavior that can be expressed with small object fixtures.

## Fixtures and Factories

**Test Data:**
```typescript
function createMemoryWithDefaults(): Memory {
  return {
    ...createDefaultProjectMemorySections(),
    creeps: {},
    flags: {},
    powerCreeps: {},
    rooms: {},
    spawns: {}
  };
}
```

**Location:**
- Shared Screeps helpers: `test/unit/mock.ts`.
- Memory defaults in tests: local `createMemoryWithDefaults()` helpers in `test/unit/spawnPrimitives.test.ts` and `test/unit/observability.test.ts`, or `createDefaultProjectMemorySections()` from `src/memory/schema.ts`.
- Strategy fixtures: `createProjectMemory()`, `createProjectMemoryWithExistingPlan()`, and `createStrategyContext()` in `test/unit/strategyPlanner.test.ts`.
- Spawn fixtures: `createContext()` and `createSpawn()` in `test/unit/spawnPrimitives.test.ts`.
- Behavior fixtures: `createRoleContext()`, `createActionCreep()`, `createNoopCreep()`, and `createIdentifiedTarget()` in `test/unit/behaviorPrimitives.test.ts`.
- Kernel fixtures: `createMockGame()`, `createMockMemory()`, and domain-specific helpers inside `test/unit/kernel.test.ts`.

**Guidelines:**
- Create fresh objects per test to avoid nested Memory/Game leakage. `test/unit/mock.ts` documents this explicitly near `createMockGame()`.
- Use `createDefaultProjectMemorySections()` for tests that need valid current Memory shape.
- Use partial Memory only when testing migration/repair behavior in `test/unit/memory.test.ts` or fail-fast lifecycle behavior in `test/unit/kernel.test.ts`.
- Keep fixture data JSON-compatible when asserting persistent state.

## Coverage

**Requirements:** No numeric coverage threshold is configured in `package.json`, `test/mocha.opts`, or visible project config.

**View Coverage:**
```bash
# Not configured. Add a coverage tool before relying on coverage reports.
npm run test-unit
```

**Practical Coverage Expectations:**
- New `src/memory/schema.ts` fields require tests for default shape in `test/unit/memorySchema.test.ts` and migration/repair in `test/unit/memory.test.ts`.
- New lifecycle stages in `src/runtime/lifecycle.ts` require order and failure behavior tests in `test/unit/kernel.test.ts`.
- New command namespaces or commands under `src/commands/` require formatter/help/history/argument tests in `test/unit/commandCore.test.ts`, installation tests in `test/unit/commandInstall.test.ts`, and namespace tests in `test/unit/commandInspection.test.ts` or `test/unit/commandConfig.test.ts`.
- New strategy behavior under `src/strategy/` requires plan content, cadence/signature refresh, and runner persistence tests in `test/unit/strategyPlanner.test.ts`.
- New spawn behavior under `src/spawning/` requires queue mutation, dry-run, real spawn, retry, and terminal failure tests in `test/unit/spawnPrimitives.test.ts`.
- New task or role behavior under `src/tasks/` or `src/roles/` requires task memory validation and action-state tests in `test/unit/behaviorPrimitives.test.ts`.

## Test Types

**Unit Tests:**
- Primary test type. Mocha runs `test/unit/**/*.ts`.
- Tests import `src` modules directly through source-root aliases or explicit relative entry paths.
- Unit tests cover Memory schema/migrations, kernel lifecycle, command system, observability, environment detection, sim bootstrap, colony context, strategy planning, spawning, bootstrap execution, task execution, and role/process dispatch.

**Integration Tests:**
- Present but not active through `npm run test-integration`; that script prints documentation guidance.
- `test/integration/helper.ts` uses `screeps-server-mockup`, reads built `dist/main.js`, starts a local Screeps server, and adds a bot.
- `test/integration/integration.test.ts` exercises the built main module against the helper when optional integration dependencies and build output are available.
- `screeps-server-mockup` is referenced by `test/integration/helper.ts` but is not listed in `package.json`; treat integration tests as manually enabled.

**E2E Tests:**
- Not used. There is no browser E2E runner or Screeps live-server deployment test in current project configuration.

## Common Patterns

**Async Testing:**
```typescript
beforeEach(async () => {
  await helper.beforeEach();
});

afterEach(async () => {
  await helper.afterEach();
});
```
- Async setup is limited to the integration harness in `test/integration/helper.ts`.
- Unit tests are synchronous and should stay synchronous unless the `src` contract becomes asynchronous.

**Error Testing:**
```typescript
it("blocks later stages when migration fails", () => {
  mockMemory().version = 999;
  const result = new Kernel().run();

  assert.isFalse(result.ok);
  assert.deepEqual(result.executedStages, ["migrate"]);
  assert.include(result.failures[0].message, "Unsupported Memory.version");
});
```
- Prefer asserting structured failure records instead of expecting thrown exceptions.
- For lifecycle errors, assert `ok`, `executedStages`, `failures`, Memory side effects, and log output.
- For validation errors, assert exact `{ ok: false, reason }` results, as in `test/unit/commandCore.test.ts` and `test/unit/behaviorPrimitives.test.ts`.
- For command errors, assert exact `CommandResult` shape: `ok`, `status`, `message`, and `effect`.
- For spawn/task failures, assert both returned status and persistent Memory mutation.

**State-Mutation Testing:**
```typescript
markSpawnRequestError(memory, "W1N1", "spawn-worker-2", "-6", 16);

assert.equal(memory.colonies.W1N1.spawnQueue[0].status, "queued");
assert.equal(memory.colonies.W1N1.spawnQueue[0].attempts, 1);
assert.equal(memory.colonies.W1N1.spawnQueue[0].lastError, "-6");
```
- When a `src` function mutates Memory, assert the returned result and the mutated Memory record.
- For multi-tick behavior, call the runner repeatedly with increasing ticks and assert each state transition, as in `test/unit/spawnPrimitives.test.ts`.

**Verification Commands:**
```bash
npm run lint
npm run test-unit
npm run build
```
- Use `npm run lint` after changing `src/**/*.ts`.
- Use `npm run test-unit` after changing any `src` behavior covered by `test/unit/`.
- Use `npm run build` after changes that affect Rollup bundling, source aliases, imports, or Screeps runtime entry points.

---

*Testing analysis: 2026-05-07*
