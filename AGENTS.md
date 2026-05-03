<!-- GSD:project-start source:PROJECT.md -->
## Project

**lystran-brain**

lystran-brain is a TypeScript Screeps World control system built on the existing Screeps TypeScript starter. The project will turn the current starter loop into a modular, extensible automation framework with clear runtime infrastructure, colony abstractions, strategy planning, command controls, and an eventual single-room bootstrap loop.

The initial work focuses on foundations first: low-coupling, high-cohesion modules, typed persistent memory, observability, environment detection, simulation support, and extensible command and decision systems. Gameplay automation is built on top of those foundations rather than embedded directly in `src/main.ts`.

**Core Value:** The system must provide a maintainable, extensible Screeps control architecture where long-term automation can grow safely from a tested, observable, low-coupling foundation.

### Constraints

- **Tech stack**: Continue using the TypeScript/Rollup Screeps starter unless a later phase proves a change is necessary - this preserves the current working build and deployment flow.
- **Runtime**: Screeps code executes inside the per-tick game loop and must keep CPU usage visible and bounded - long-running or expensive behavior needs profiling and cadence controls.
- **Persistence**: Screeps `Memory` is persistent JSON state and must be schema-versioned - new persistent structures require migration and tests.
- **Simulation**: Official sim detection uses `Game.shard.name === "sim"` - sim-specific behavior must be isolated behind environment/bootstrap modules.
- **API limits**: Bot runtime code cannot create sources, spawn structures, or arbitrary initial creeps - sim setup must separate API-permitted initialization from external/manual world seeding.
- **Secrets**: `screeps.json` contains credentials and must remain ignored and unread by runtime code - deployment safety is part of the infrastructure baseline.
- **Maintainability**: New code should be low-coupling and high-cohesion - modules should depend on abstractions such as context, services, plans, and queues rather than global scans where practical.
- **Extensibility**: Stable strings for shards, environments, roles, processes, commands, and memory keys should be centralized - business logic should not hardcode these values ad hoc.
- **Manual control**: Human commands should modify policies, request plans, or enqueue safe actions - commands should not bypass core scheduling and execution layers except for explicit debug utilities.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 4.8.4 - Screeps bot source in `src/main.ts` and `src/utils/ErrorMapper.ts`, compiled with `tsconfig.json`.
- JavaScript ES2018/CommonJS output - Rollup bundles `src/main.ts` into `dist/main.js` for the Screeps runtime via `rollup.config.js`.
- JavaScript - Build and test configuration in `rollup.config.js`, `.eslintrc.js`, `test/setup-mocha.js`, and `.devcontainer/Dockerfile`.
- Markdown - Project and starter documentation in `README.md` and `docs/`.
- JSON/JSONC - Package, TypeScript, Screeps upload, GitBook, and devcontainer configuration in `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `screeps.json`, `screeps.sample.json`, `book.json`, and `.devcontainer/devcontainer.json`.
## Runtime
- Node.js v16.17.0 - Local project runtime pinned by `.nvmrc`.
- Node.js 12 Bullseye container - Optional VS Code remote/container runtime defined by `.devcontainer/Dockerfile`.
- Screeps JavaScript runtime - Production execution environment for the bundled CommonJS module exported from `dist/main.js`; source code uses Screeps globals such as `Game`, `Memory`, `Game.creeps`, `Game.rooms`, and `console` in `src/main.ts` and `src/utils/ErrorMapper.ts`.
- npm - Scripts and dependencies are defined in `package.json`.
- Lockfile: present locally at `package-lock.json` with lockfileVersion 3.
- Repository ignore status: `.gitignore` lists `/package-lock.json`, so the local npm lockfile is not intended to be committed unless ignore rules are changed.
- Yarn support is documented in `README.md` and `docs/getting-started/installation.md`, but no `yarn.lock` is present.
## Frameworks
- Screeps World API via `@types/screeps` ^3.2.3 - Provides ambient TypeScript declarations for Screeps globals used in `src/main.ts`.
- Rollup ^2.56.2 - Bundles TypeScript source from `src/main.ts` into `dist/main.js` using `rollup.config.js`.
- TypeScript ^4.8.4 - Strict TypeScript compilation configured in `tsconfig.json`.
- Mocha ^5.2.0 - Unit test runner invoked by `npm run test-unit` from `package.json`; configured by `test/mocha.opts` and `test/setup-mocha.js`.
- Chai ^4.2.0 - Assertion library used in `test/unit/main.test.ts` and `test/integration/integration.test.ts`.
- Sinon ^6.3.5 and sinon-chai ^3.2.0 - Test double and assertion helpers registered globally in `test/setup-mocha.js`.
- ts-node ^10.2.0 - Executes TypeScript tests through `ts-node/register` in `test/mocha.opts`.
- tsconfig-paths ^3.10.1 - Resolves `baseUrl` imports such as `utils/ErrorMapper` during tests via `test/mocha.opts`.
- screeps-server-mockup - Optional integration-test dependency referenced by `test/integration/helper.ts` and `docs/in-depth/testing.md`; it is not installed in `package.json`.
- rollup-plugin-typescript2 ^0.31.0 - Compiles TypeScript through Rollup in `rollup.config.js`.
- rollup-plugin-screeps ^1.0.1 - Uploads bundled code to Screeps destinations selected from `screeps.json` in `rollup.config.js`.
- @rollup/plugin-node-resolve ^13.0.4 - Resolves modules with `rootDir: "src"` in `rollup.config.js`.
- @rollup/plugin-commonjs ^20.0.0 - Converts CommonJS dependencies for Rollup bundling in `rollup.config.js`.
- rollup-plugin-clear ^2.0.7 - Clears `dist` before builds in `rollup.config.js`.
- ESLint ^8.24.0 with @typescript-eslint ^5.38.1 - Lints `src/**/*.ts` via `npm run lint` from `package.json`.
- Prettier ^2.7.1 - Formatting configuration is present in `.prettierrc`.
- GitBook tooling - Documentation metadata exists in `book.json` and `docs/SUMMARY.md`; local docs server usage is described in `docs/in-depth/contributing.md`.
- VS Code Dev Containers - Optional development container configured by `.devcontainer/devcontainer.json` and `.devcontainer/Dockerfile`.
## Key Dependencies
- `@types/screeps` ^3.2.3 - Enables typed Screeps globals and interface augmentation in `src/main.ts`.
- `rollup-plugin-screeps` ^1.0.1 - Performs deploy/upload to Screeps using `screeps.json` destination objects from `rollup.config.js`.
- `rollup` ^2.56.2 - Produces the single CommonJS Screeps bundle `dist/main.js`.
- `typescript` ^4.8.4 - Enforces strict static typing with `strict`, `noImplicitReturns`, and `allowUnreachableCode: false` in `tsconfig.json`.
- `source-map` ~0.6.1 - Runtime stack trace remapping dependency used by `src/utils/ErrorMapper.ts` through `SourceMapConsumer`.
- `@rollup/plugin-node-resolve` ^13.0.4 - Resolves source-root imports and node modules during bundling.
- `@rollup/plugin-commonjs` ^20.0.0 - Allows CommonJS dependency compatibility in Rollup bundles.
- `rollup-plugin-typescript2` ^0.31.0 - Integrates TypeScript compilation with Rollup.
- `rollup-plugin-clear` ^2.0.7 - Removes previous `dist` output before each build.
- `lodash` ^3.10.1 - Exposed as global `_` in tests via `test/setup-mocha.js`; Screeps runtime commonly provides lodash globally, and `src/utils/ErrorMapper.ts` uses `_.escape`.
- `@types/lodash` 3.10.2 - Type declarations matching the Screeps-era lodash global.
- `@types/node` ^13.13.1 - Node typings for build and test configuration.
- `mocha`, `chai`, `sinon`, `sinon-chai`, and related `@types/*` packages - Unit test infrastructure declared in `package.json`.
## Configuration
- Node version is pinned in `.nvmrc` as `v16.17.0`.
- Build destination is selected with the `DEST` environment variable consumed by `rollup.config.js`.
- If `DEST` is omitted, `rollup.config.js` performs a dry-run build and does not upload.
- Valid configured destination names are `main`, `pserver`, `season`, and `sim`, matching `package.json` scripts and top-level keys in `screeps.json` and `screeps.sample.json`.
- Screeps upload configuration lives in `screeps.json`; `.gitignore` marks `screeps.json` as ignored because it contains credentials.
- Sample upload configuration lives in `screeps.sample.json`.
- `rollup.config.js` is the primary build pipeline:
- `tsconfig.json` compiles ESNext modules targeting ES2018 with `moduleResolution: "Node"`, `outDir: "dist"`, `baseUrl: "src/"`, `sourceMap: true`, `strict: true`, `experimentalDecorators: true`, `noImplicitReturns: true`, and `allowUnreachableCode: false`.
- `tsconfig.test.json` extends `tsconfig.json` and switches tests to `module: "CommonJs"`.
- `.eslintrc.js` defines TypeScript linting behavior.
- `.prettierrc` defines formatter behavior.
- `.editorconfig` defines editor-level formatting defaults.
- `npm run build` - Runs `rollup -c` and produces `dist/main.js` without upload when no `DEST` is set.
- `npm run push-main` - Builds and uploads with `DEST:main`.
- `npm run push-pserver` - Builds and uploads with `DEST:pserver`.
- `npm run push-season` - Builds and uploads with `DEST:season`.
- `npm run push-sim` - Builds and uploads with `DEST:sim`.
- `npm run watch-main`, `npm run watch-pserver`, `npm run watch-season`, and `npm run watch-sim` - Watch builds with upload destinations.
- `npm run lint` - Runs ESLint over `src/**/*.ts`.
- `npm test` / `npm run test-unit` - Runs Mocha unit tests under `test/unit/**/*.ts`.
- `npm run test-integration` - Prints documentation guidance rather than running integration tests, per `package.json`.
## Platform Requirements
- Use Node.js `v16.17.0` from `.nvmrc` for the local repository state.
- Install dependencies with npm using `package.json`; `package-lock.json` is present locally but ignored by `.gitignore`.
- Rollup CLI can be invoked through local npm scripts; `.devcontainer/Dockerfile` also installs Rollup globally for the optional container.
- Optional remote/container development requires Docker and VS Code Dev Containers using `.devcontainer/devcontainer.json` and `.devcontainer/Dockerfile`.
- Do not commit `screeps.json`; use `screeps.sample.json` as the template and keep credentials local.
- Deployment target is Screeps World or compatible Screeps private server via `rollup-plugin-screeps`.
- Official-host destinations use token-style authentication fields in `screeps.json` for `main`, `season`, and `sim`.
- Private-server destination uses account/password-style fields in `screeps.json` for `pserver`; README and docs note that private upload requires a private server with authentication support such as `screepsmod-auth`.
- Runtime artifact is `dist/main.js` plus source map support configured by `rollup.config.js`.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use PascalCase for class-like utility files that export a matching class, such as `src/utils/ErrorMapper.ts`.
- Use lowercase descriptive names for entry points and test helpers, such as `src/main.ts`, `test/unit/mock.ts`, `test/setup-mocha.js`, and `test/integration/helper.ts`.
- Name executable test files with `.test.ts`; Mocha discovers `test/unit/**/*.ts` through `package.json`, and project docs require `.test.ts` naming in `docs/in-depth/testing.md`.
- Use camelCase for functions and methods, enforced by `camelcase` and `id-match` in `.eslintrc.js`.
- Export the Screeps tick entry point as `loop` from `src/main.ts`; keep new tick orchestration reachable from that exported function.
- Use Mocha BDD names `describe`, `it`, `before`, `beforeEach`, `afterEach`, and `before` in test files under `test/unit/` and `test/integration/`.
- Use camelCase local variables such as `outStack`, `persistValue`, `notPersistValue`, and `memory` in `src/utils/ErrorMapper.ts` and `test/unit/main.test.ts`.
- Use uppercase constants for fixed test/build configuration values such as `DIST_MAIN_JS` in `test/integration/helper.ts`.
- Avoid blacklisted identifiers `any`, `Number`, `number`, `String`, `string`, `Boolean`, `boolean`, and `Undefined`; `.eslintrc.js` enforces this through `id-blacklist`.
- Use PascalCase for classes and interfaces, such as `ErrorMapper` in `src/utils/ErrorMapper.ts`, `Memory` and `CreepMemory` in `src/main.ts`, and `IntegrationTestHelper` in `test/integration/helper.ts`.
- Prefer `interface` for object shape declarations; `.eslintrc.js` enables `@typescript-eslint/consistent-type-definitions`.
- Extend Screeps ambient globals inside `declare global` in `src/main.ts` when adding game memory types or game-specific global interfaces.
## Code Style
- Use Prettier settings from `.prettierrc`: semicolons enabled, 2-space indentation, 120-character print width, double quotes, no trailing commas, arrow parens omitted when possible, and `endOfLine: auto`.
- Format TypeScript and JavaScript source before linting; `docs/in-depth/prettier.md` documents editor format-on-save support and the project Prettier settings.
- Keep import and object formatting consistent with Prettier. Existing files show both double-quoted TypeScript imports in `src/main.ts` and single-quoted JavaScript requires in `test/setup-mocha.js`; new TypeScript should follow `.prettierrc`.
- Run `npm run lint` for source linting; `package.json` maps it to `eslint "src/**/*.ts"`.
- ESLint config lives in `.eslintrc.js` and extends `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:@typescript-eslint/recommended-requiring-type-checking`, `plugin:import/*`, and `prettier`.
- Type-aware linting uses `parserOptions.project: "tsconfig.json"` in `.eslintrc.js`; new linted TypeScript must be included by `tsconfig.json`.
- Keep explicit member accessibility on class members; `.eslintrc.js` enforces `@typescript-eslint/explicit-member-accessibility`, as shown by `private static`, `public static`, and `public static get` in `src/utils/ErrorMapper.ts`.
- Avoid multiple classes per file; `.eslintrc.js` enforces `max-classes-per-file: 1`.
- Avoid bitwise operations, `eval`, wrapper constructors, `var`, literal throws, and missing radix arguments; `.eslintrc.js` enforces these rules.
- `console.log` is permitted for Screeps runtime output by `.eslintrc.js` and documented in `docs/in-depth/typescript.md`.
## Import Organization
- Use `tsconfig.json` `baseUrl: "src/"` for source imports. Import shared source modules as `utils/ErrorMapper` rather than reaching through relative paths from `src/main.ts`.
- Tests load `tsconfig-paths/register` through `test/mocha.opts`, so the same `src/` base URL aliases work during Mocha runs.
- Rollup resolves modules from `src` through `resolve({ rootDir: "src" })` in `rollup.config.js`; keep source aliases compatible with both TypeScript and Rollup.
## Error Handling
- Wrap the exported Screeps loop with `ErrorMapper.wrapLoop` in `src/main.ts`; new top-level game logic should run inside that wrapper so runtime errors get mapped through source maps.
- Catch `unknown` runtime values in wrappers, narrow to `Error`, and rethrow non-`Error` values. `src/utils/ErrorMapper.ts` catches `e`, handles `e instanceof Error`, and rethrows anything else.
- Throw `Error` objects, not literals; `.eslintrc.js` enforces `no-throw-literal`, and `rollup.config.js` throws `new Error("Invalid upload destination")`.
- Escape stack traces before logging HTML into Screeps console output. `src/utils/ErrorMapper.ts` uses `_.escape` before printing mapped or simulator stack traces.
- Cache expensive source-map results in a static object before returning them; `src/utils/ErrorMapper.ts` stores mapped stacks in `ErrorMapper.cache`.
## Logging
- Use `console.log` for Screeps runtime status and error output. `src/main.ts` logs the current tick, and `src/utils/ErrorMapper.ts` logs source-mapped stack traces.
- Build scripts may log operational status; `rollup.config.js` logs when no `DEST` is specified and upload is skipped.
- Keep logs concise because Screeps console output is runtime-visible and CPU-sensitive.
## Comments
- Add comments around Screeps-specific runtime constraints, source-map limitations, and test global injection. Examples live in `src/main.ts`, `src/utils/ErrorMapper.ts`, and `test/setup-mocha.js`.
- Use comments to explain why a lint or type escape is required. `test/unit/main.test.ts` documents `@ts-ignore` when assigning `Game` and `Memory` onto `global`.
- Avoid comments that restate obvious assignments. Existing useful comments explain source-map CPU cost in `src/utils/ErrorMapper.ts` and game memory typing caveats in `src/main.ts`.
- Use JSDoc for public utility APIs with non-obvious behavior, parameters, returns, and warnings. `src/utils/ErrorMapper.ts` documents `sourceMappedStackTrace(error: Error | string): string`.
- Ambient Screeps type declarations in `src/main.ts` use block comments instead of formal TSDoc because they document global merge behavior rather than exported APIs.
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Screeps runtime integration is centered on one exported `loop` symbol from `src/main.ts`.
- Runtime behavior currently uses Screeps global objects (`Game`, `Memory`, `_`) rather than dependency-injected services.
- Utility code lives under `src/utils/` and is imported through the TypeScript `baseUrl` path alias.
- Rollup compiles the TypeScript source tree into a CommonJS bundle at `dist/main.js` for Screeps.
- Tests split between direct unit tests for `src/main.ts` and optional integration tests against `dist/main.js`.
## Layers
- Purpose: Provide the callable Screeps tick function expected by the game environment.
- Location: `src/main.ts`
- Contains: Ambient global type extensions, global declarations, and the exported `loop`.
- Depends on: `src/utils/ErrorMapper.ts`, Screeps globals from `@types/screeps`.
- Used by: Screeps runtime after upload, unit tests in `test/unit/main.test.ts`, Rollup input in `rollup.config.js`.
- Purpose: Hold per-tick AI behavior inside the wrapped loop body.
- Location: `src/main.ts`
- Contains: Current tick logging and dead-creep memory cleanup.
- Depends on: `Game.time`, `Game.creeps`, and `Memory.creeps` from the Screeps runtime.
- Used by: `ErrorMapper.wrapLoop` callback and tests that call `loop()`.
- Purpose: Provide shared runtime helpers that should not own game strategy.
- Location: `src/utils/`
- Contains: `ErrorMapper` source-map stack trace support in `src/utils/ErrorMapper.ts`.
- Depends on: `source-map`, bundled `main.js.map`, Screeps globals `Game.rooms`, `console`, and lodash global `_`.
- Used by: `src/main.ts`.
- Purpose: Transform TypeScript into the Screeps-compatible JavaScript bundle and optionally upload it.
- Location: `rollup.config.js`, `tsconfig.json`, `screeps.sample.json`, local `screeps.json`.
- Contains: Rollup input/output, plugin chain, TypeScript compiler configuration, and Screeps destination configuration.
- Depends on: `rollup-plugin-typescript2`, `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `rollup-plugin-screeps`.
- Used by: npm scripts in `package.json`.
- Purpose: Verify the exported loop and, when enabled, a local Screeps server flow.
- Location: `test/unit/`, `test/integration/`, `test/setup-mocha.js`, `test/mocha.opts`.
- Contains: Mocha setup, Screeps global mocks, direct loop tests, and mock server helper.
- Depends on: `mocha`, `chai`, `sinon`, `ts-node`, `tsconfig-paths`, and optional `screeps-server-mockup`.
- Used by: npm scripts in `package.json`.
## Data Flow
### Primary Request Path
### Build and Upload Flow
### Unit Test Flow
### Integration Test Flow
- Persistent game state is the Screeps-provided `Memory` object, with creep memory under `Memory.creeps`.
- Runtime world state is the Screeps-provided `Game` object, especially `Game.time`, `Game.creeps`, and `Game.rooms`.
- Type extensions for `Memory` and `CreepMemory` are declared in `src/main.ts` and merge with `@types/screeps`.
- `ErrorMapper` owns module-level static caches in `src/utils/ErrorMapper.ts` for the source map consumer and previously mapped traces.
## Key Abstractions
- Purpose: The single runtime contract consumed by Screeps.
- Examples: `src/main.ts`, `test/unit/main.test.ts`.
- Pattern: Export a named `loop` constant wrapping a synchronous callback with `ErrorMapper.wrapLoop`.
- Purpose: Declare project-specific additions to Screeps `Memory` and `CreepMemory`.
- Examples: `src/main.ts`.
- Pattern: Use `declare global` inside a module file so interfaces merge with `@types/screeps`.
- Purpose: Convert generated bundle stack traces back to original TypeScript source locations.
- Examples: `src/utils/ErrorMapper.ts`.
- Pattern: Static utility class with lazy `SourceMapConsumer`, trace cache, and a wrapper function for loop callbacks.
- Purpose: Select local or remote Screeps upload target.
- Examples: `rollup.config.js`, `screeps.sample.json`, local `screeps.json`.
- Pattern: Use `DEST` environment value to select one top-level config entry; omit `DEST` for compile-only dry run.
## Entry Points
- Location: `src/main.ts`
- Triggers: Screeps game runtime calls exported `loop` every tick after deployment.
- Responsibilities: Execute per-tick logic and clean up memory for missing creeps.
- Location: `rollup.config.js`
- Triggers: `npm run build`, `npm run push-main`, `npm run push-pserver`, `npm run push-season`, `npm run push-sim`, and watch variants in `package.json`.
- Responsibilities: Clear `dist/`, resolve imports from `src/`, compile TypeScript, bundle CommonJS output, and optionally upload to Screeps.
- Location: `test/mocha.opts`, `test/setup-mocha.js`, `test/unit/main.test.ts`
- Triggers: `npm test` or `npm run test-unit`.
- Responsibilities: Register TypeScript runtime compilation, install test globals, mock Screeps objects, and call `loop()` directly.
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
### Putting Strategy Logic in Utilities
### Reading Secret Deployment Config in Application Code
### Relying on Built Output as Source
## Error Handling
- Use `ErrorMapper.wrapLoop` for the exported `loop` in `src/main.ts`.
- For regular runtime errors, call `ErrorMapper.sourceMappedStackTrace` and escape the output before logging in `src/utils/ErrorMapper.ts`.
- In the Screeps simulator room, log the original stack because source maps are not supported there.
- Re-throw non-`Error` throws from `src/utils/ErrorMapper.ts` so unsupported values do not disappear silently.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
