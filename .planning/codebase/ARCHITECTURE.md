<!-- refreshed: 2026-05-03 -->
# Architecture

**Analysis Date:** 2026-05-03

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Screeps Runtime                         │
│  Game environment calls exported `loop` once per game tick    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Game Loop Entry Module                    │
│                    `src/main.ts`                             │
│  Extends Screeps memory typings and exports `loop`            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cross-Cutting Runtime Utilities             │
│                  `src/utils/ErrorMapper.ts`                  │
│  Wraps the game loop and maps bundled stack traces            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Rollup Build and Screeps Upload              │
│                 `rollup.config.js`                           │
│  Bundles `src/main.ts` to `dist/main.js` and optionally pushes │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Game loop entry | Export the Screeps `loop`, declare project-specific global memory interfaces, and run per-tick behavior. | `src/main.ts` |
| Memory cleanup | Remove `Memory.creeps` entries for creeps missing from `Game.creeps` during each tick. | `src/main.ts` |
| Error mapper | Catch loop errors, source-map stack traces back to TypeScript sources, cache mapped traces, and log red HTML output in Screeps console. | `src/utils/ErrorMapper.ts` |
| Rollup bundle | Resolve TypeScript modules from `src/`, compile with `tsconfig.json`, emit `dist/main.js`, and configure optional Screeps upload. | `rollup.config.js` |
| Unit test harness | Mock Screeps globals and exercise the exported `loop` directly. | `test/unit/main.test.ts`, `test/unit/mock.ts` |
| Integration harness | Load built `dist/main.js` into `screeps-server-mockup` and tick a local Screeps world. | `test/integration/helper.ts`, `test/integration/integration.test.ts` |
| Documentation | Explain starter usage, authentication, deployment, testing, and module bundling. | `README.md`, `docs/` |

## Pattern Overview

**Overall:** Minimal Screeps game-loop module with Rollup bundling and utility wrappers.

**Key Characteristics:**
- Screeps runtime integration is centered on one exported `loop` symbol from `src/main.ts`.
- Runtime behavior currently uses Screeps global objects (`Game`, `Memory`, `_`) rather than dependency-injected services.
- Utility code lives under `src/utils/` and is imported through the TypeScript `baseUrl` path alias.
- Rollup compiles the TypeScript source tree into a CommonJS bundle at `dist/main.js` for Screeps.
- Tests split between direct unit tests for `src/main.ts` and optional integration tests against `dist/main.js`.

## Layers

**Runtime Entry Layer:**
- Purpose: Provide the callable Screeps tick function expected by the game environment.
- Location: `src/main.ts`
- Contains: Ambient global type extensions, global declarations, and the exported `loop`.
- Depends on: `src/utils/ErrorMapper.ts`, Screeps globals from `@types/screeps`.
- Used by: Screeps runtime after upload, unit tests in `test/unit/main.test.ts`, Rollup input in `rollup.config.js`.

**Game Logic Layer:**
- Purpose: Hold per-tick AI behavior inside the wrapped loop body.
- Location: `src/main.ts`
- Contains: Current tick logging and dead-creep memory cleanup.
- Depends on: `Game.time`, `Game.creeps`, and `Memory.creeps` from the Screeps runtime.
- Used by: `ErrorMapper.wrapLoop` callback and tests that call `loop()`.

**Utility Layer:**
- Purpose: Provide shared runtime helpers that should not own game strategy.
- Location: `src/utils/`
- Contains: `ErrorMapper` source-map stack trace support in `src/utils/ErrorMapper.ts`.
- Depends on: `source-map`, bundled `main.js.map`, Screeps globals `Game.rooms`, `console`, and lodash global `_`.
- Used by: `src/main.ts`.

**Build and Deployment Layer:**
- Purpose: Transform TypeScript into the Screeps-compatible JavaScript bundle and optionally upload it.
- Location: `rollup.config.js`, `tsconfig.json`, `screeps.sample.json`, local `screeps.json`.
- Contains: Rollup input/output, plugin chain, TypeScript compiler configuration, and Screeps destination configuration.
- Depends on: `rollup-plugin-typescript2`, `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `rollup-plugin-screeps`.
- Used by: npm scripts in `package.json`.

**Test Layer:**
- Purpose: Verify the exported loop and, when enabled, a local Screeps server flow.
- Location: `test/unit/`, `test/integration/`, `test/setup-mocha.js`, `test/mocha.opts`.
- Contains: Mocha setup, Screeps global mocks, direct loop tests, and mock server helper.
- Depends on: `mocha`, `chai`, `sinon`, `ts-node`, `tsconfig-paths`, and optional `screeps-server-mockup`.
- Used by: npm scripts in `package.json`.

## Data Flow

### Primary Request Path

1. Screeps environment loads the uploaded CommonJS module generated from `src/main.ts` (`rollup.config.js:17`).
2. Screeps invokes the exported `loop` once per tick (`src/main.ts:32`).
3. `ErrorMapper.wrapLoop` enters a try/catch wrapper around the loop callback (`src/utils/ErrorMapper.ts:72`).
4. The loop logs the current tick from `Game.time` (`src/main.ts:33`).
5. The loop iterates `Memory.creeps` and checks each name against `Game.creeps` (`src/main.ts:36`).
6. Missing creep memory entries are deleted from `Memory.creeps` (`src/main.ts:38`).
7. If the callback throws an `Error`, `ErrorMapper` logs either the raw simulator stack or a source-mapped stack trace (`src/utils/ErrorMapper.ts:77`).

### Build and Upload Flow

1. npm scripts invoke Rollup, optionally with `DEST` such as `main`, `sim`, `season`, or `pserver` (`package.json`).
2. `rollup.config.js` reads `process.env.DEST` and resolves a matching destination from local `screeps.json` (`rollup.config.js:9`).
3. Rollup reads `src/main.ts` as the only configured input (`rollup.config.js:18`).
4. TypeScript compiles using `tsconfig.json` and `baseUrl: "src/"` (`rollup.config.js:29`, `tsconfig.json`).
5. Rollup writes CommonJS output and source map to `dist/main.js` (`rollup.config.js:19`).
6. `rollup-plugin-screeps` uploads when destination config exists, or performs a dry run when config is absent (`rollup.config.js:30`).

### Unit Test Flow

1. Mocha loads `test/setup-mocha.js` and registers `ts-node` plus `tsconfig-paths` from `test/mocha.opts`.
2. `test/unit/main.test.ts` imports `loop` from `src/main.ts` (`test/unit/main.test.ts:2`).
3. `beforeEach` clones mock `Game` and `Memory` into globals (`test/unit/main.test.ts:10`).
4. Tests call `loop()` directly and assert export shape, void return, and missing-creep memory deletion (`test/unit/main.test.ts:18`).

### Integration Test Flow

1. `test/integration/helper.ts` creates a `ScreepsServer` instance (`test/integration/helper.ts:23`).
2. The helper resets and stubs a local world (`test/integration/helper.ts:27`).
3. The helper reads built `dist/main.js` and adds it as the bot's `main` module (`test/integration/helper.ts:33`).
4. Integration tests tick the server and inspect game time or player memory (`test/integration/integration.test.ts`).

**State Management:**
- Persistent game state is the Screeps-provided `Memory` object, with creep memory under `Memory.creeps`.
- Runtime world state is the Screeps-provided `Game` object, especially `Game.time`, `Game.creeps`, and `Game.rooms`.
- Type extensions for `Memory` and `CreepMemory` are declared in `src/main.ts` and merge with `@types/screeps`.
- `ErrorMapper` owns module-level static caches in `src/utils/ErrorMapper.ts` for the source map consumer and previously mapped traces.

## Key Abstractions

**Exported Loop:**
- Purpose: The single runtime contract consumed by Screeps.
- Examples: `src/main.ts`, `test/unit/main.test.ts`.
- Pattern: Export a named `loop` constant wrapping a synchronous callback with `ErrorMapper.wrapLoop`.

**Memory Type Extensions:**
- Purpose: Declare project-specific additions to Screeps `Memory` and `CreepMemory`.
- Examples: `src/main.ts`.
- Pattern: Use `declare global` inside a module file so interfaces merge with `@types/screeps`.

**ErrorMapper:**
- Purpose: Convert generated bundle stack traces back to original TypeScript source locations.
- Examples: `src/utils/ErrorMapper.ts`.
- Pattern: Static utility class with lazy `SourceMapConsumer`, trace cache, and a wrapper function for loop callbacks.

**Build Destination:**
- Purpose: Select local or remote Screeps upload target.
- Examples: `rollup.config.js`, `screeps.sample.json`, local `screeps.json`.
- Pattern: Use `DEST` environment value to select one top-level config entry; omit `DEST` for compile-only dry run.

## Entry Points

**Screeps Runtime Loop:**
- Location: `src/main.ts`
- Triggers: Screeps game runtime calls exported `loop` every tick after deployment.
- Responsibilities: Execute per-tick logic and clean up memory for missing creeps.

**Rollup Build:**
- Location: `rollup.config.js`
- Triggers: `npm run build`, `npm run push-main`, `npm run push-pserver`, `npm run push-season`, `npm run push-sim`, and watch variants in `package.json`.
- Responsibilities: Clear `dist/`, resolve imports from `src/`, compile TypeScript, bundle CommonJS output, and optionally upload to Screeps.

**Unit Test Runner:**
- Location: `test/mocha.opts`, `test/setup-mocha.js`, `test/unit/main.test.ts`
- Triggers: `npm test` or `npm run test-unit`.
- Responsibilities: Register TypeScript runtime compilation, install test globals, mock Screeps objects, and call `loop()` directly.

**Integration Test Runner:**
- Location: `test/integration/helper.ts`, `test/integration/integration.test.ts`
- Triggers: Manual integration test command after installing and building required mock server dependencies.
- Responsibilities: Start a mock Screeps server, load `dist/main.js`, tick the world, and inspect server state.

## Architectural Constraints

- **Threading:** Screeps code runs in the single-threaded game tick environment; the loop body should stay synchronous unless a future library explicitly supports Screeps-safe scheduling.
- **Global state:** Runtime logic reads and writes Screeps globals in `src/main.ts`; tests provide mock globals in `test/unit/main.test.ts` and `test/unit/mock.ts`.
- **Module resolution:** Application imports may use root-relative paths from `src/` because `tsconfig.json` sets `baseUrl` to `src/` and Rollup uses `resolve({ rootDir: "src" })`.
- **Bundle output:** Screeps consumes `dist/main.js`; source-map error mapping expects `main.js.map` at runtime through `require("main.js.map")` in `src/utils/ErrorMapper.ts`.
- **Secrets:** Local `screeps.json` is a deployment credential file and must be treated as secret configuration; use `screeps.sample.json` for shape only.
- **Circular imports:** No circular dependency chain is detected in the current `src/` graph; `src/main.ts` imports only `src/utils/ErrorMapper.ts`.
- **Runtime APIs:** `Game`, `Memory`, and `_` are globals provided by Screeps or the test setup, not imported application modules.

## Anti-Patterns

### Bypassing the Wrapped Loop

**What happens:** New per-tick code is exported separately or run outside the callback passed to `ErrorMapper.wrapLoop`.
**Why it's wrong:** Errors skip the source-map logging path and can produce generated bundle line numbers that are harder to debug.
**Do this instead:** Keep the exported Screeps contract in `src/main.ts` as `export const loop = ErrorMapper.wrapLoop(() => { ... })` and call new game modules from inside that callback.

### Putting Strategy Logic in Utilities

**What happens:** Game AI behavior is added to `src/utils/ErrorMapper.ts` or future files under `src/utils/`.
**Why it's wrong:** Utility files become coupled to room, creep, or spawn decisions and stop being reusable cross-cutting helpers.
**Do this instead:** Put strategy modules under a domain directory in `src/` and keep `src/utils/` for infrastructure helpers such as `ErrorMapper`.

### Reading Secret Deployment Config in Application Code

**What happens:** Runtime source under `src/` imports or reads local `screeps.json`.
**Why it's wrong:** The Screeps bundle can accidentally include credentials or local-only deployment configuration.
**Do this instead:** Keep Screeps destination handling in `rollup.config.js` and use `screeps.sample.json` only as a checked-in template.

### Relying on Built Output as Source

**What happens:** Code changes are made in `dist/main.js`.
**Why it's wrong:** `dist/` is generated by Rollup and can be overwritten on every build.
**Do this instead:** Change TypeScript source under `src/`; integration tests can load `dist/main.js` after a build through `test/integration/helper.ts`.

## Error Handling

**Strategy:** Wrap the game loop with a top-level try/catch and render Screeps-console-friendly error output.

**Patterns:**
- Use `ErrorMapper.wrapLoop` for the exported `loop` in `src/main.ts`.
- For regular runtime errors, call `ErrorMapper.sourceMappedStackTrace` and escape the output before logging in `src/utils/ErrorMapper.ts`.
- In the Screeps simulator room, log the original stack because source maps are not supported there.
- Re-throw non-`Error` throws from `src/utils/ErrorMapper.ts` so unsupported values do not disappear silently.

## Cross-Cutting Concerns

**Logging:** Use Screeps `console.log` in runtime code, as shown in `src/main.ts` and `src/utils/ErrorMapper.ts`.
**Validation:** Compile-time validation comes from TypeScript strict mode in `tsconfig.json`; runtime validation is not centralized.
**Authentication:** Deployment authentication is handled outside application source by `rollup-plugin-screeps` using local `screeps.json` selected in `rollup.config.js`.
**Testing:** Direct loop behavior is covered by `test/unit/main.test.ts`; mock server behavior is isolated under `test/integration/`.
**Documentation:** Operational guidance lives in `README.md` and `docs/`, with GitBook navigation in `docs/SUMMARY.md`.

---

*Architecture analysis: 2026-05-03*
