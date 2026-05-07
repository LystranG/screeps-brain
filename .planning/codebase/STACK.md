# Technology Stack

**Analysis Date:** 2026-05-07

## Languages

**Primary:**
- TypeScript 4.8.4 - Screeps bot source under `src/`, with the runtime entry point in `src/main.ts` and strict compiler settings in `tsconfig.json`.

**Secondary:**
- JavaScript ES2018/CommonJS - Rollup emits `dist/main.js` from `src/main.ts` for the Screeps runtime; build and test configuration live in `rollup.config.js`, `.eslintrc.js`, and `test/setup-mocha.js`.
- JSON/JSONC - Project configuration uses `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `screeps.sample.json`, and local ignored `screeps.json`.
- Markdown - Starter and project documentation lives in `README.md` and `docs/`.

## Runtime

**Environment:**
- Node.js v16.17.0 - Local development runtime pinned by `.nvmrc`.
- npm 11.12.1 - Local package manager observed from `npm --version`; scripts are defined in `package.json`.
- Screeps JavaScript runtime - Production execution environment for the bundled CommonJS module exported from `dist/main.js`; source code uses Screeps globals in `src/main.ts`, `src/runtime/Kernel.ts`, `src/runtime/services.ts`, `src/environment/detection.ts`, `src/environment/simBootstrap.ts`, `src/cleanup/creepMemory.ts`, and `src/utils/ErrorMapper.ts`.

**Package Manager:**
- npm - Primary package manager for scripts and dependency installation in `package.json`.
- Lockfile: present locally at `package-lock.json` with lockfileVersion 3.
- Repository ignore status: `.gitignore` lists `/package-lock.json`, so the local lockfile is not intended to be committed unless ignore rules are changed.
- Yarn support is documented in `README.md` and `docs/getting-started/installation.md`, but no `yarn.lock` is present.

## Frameworks

**Core:**
- Screeps World API via `@types/screeps` ^3.2.3 - Provides ambient declarations for `Game`, `Memory`, `CreepMemory`, `Room`, `StructureSpawn`, `Source`, and related globals used throughout `src/`.
- Rollup ^2.56.2 - Bundles `src/main.ts` into `dist/main.js` using `rollup.config.js`.
- TypeScript ^4.8.4 - Compiles the `src/` tree with strict type checking from `tsconfig.json`.
- Custom tick kernel - `src/main.ts` delegates each tick to `src/runtime/Kernel.ts`, which runs lifecycle stages for migration, services, console commands, environment bootstrap, colony/process execution, spawning, cleanup, and stats flushing.
- Versioned Memory schema - `src/memory/schema.ts` defines `CURRENT_MEMORY_VERSION = 5` and the persistent JSON shape; `src/memory/migrations.ts` migrates Screeps `Memory` before runtime behavior proceeds.
- Console command framework - `src/commands/installer.ts` installs a global `cmd` tree into the Screeps global VM, with namespaces under `src/commands/namespaces/`.
- Runtime observability - `src/logging/Logger.ts`, `src/profiling/Profiler.ts`, `src/stats/Stats.ts`, and `src/runtime/services.ts` provide log filtering, CPU stage profiling, and persistent stats summaries.

**Testing:**
- Mocha ^5.2.0 - Unit test runner invoked by `npm test` and `npm run test-unit` from `package.json`.
- Chai ^4.2.0 - Assertion library configured through `test/setup-mocha.js`.
- Sinon ^6.3.5 and sinon-chai ^3.2.0 - Test double and assertion helpers configured through `test/setup-mocha.js`.
- ts-node ^10.2.0 - Executes TypeScript tests through `ts-node/register` in `test/mocha.opts`.
- tsconfig-paths ^3.10.1 - Resolves `baseUrl` imports such as `runtime/Kernel` and `utils/ErrorMapper` during tests through `test/mocha.opts`.
- screeps-server-mockup - Optional integration-test dependency referenced by `test/integration/helper.ts` and `docs/in-depth/testing.md`; it is not installed in `package.json`, and `npm run test-integration` only prints guidance.

**Build/Dev:**
- rollup-plugin-typescript2 ^0.31.0 - Compiles TypeScript through Rollup in `rollup.config.js`.
- rollup-plugin-screeps ^1.0.1 - Uploads `dist/main.js` to Screeps destinations selected from local `screeps.json` by `DEST` in `rollup.config.js`.
- @rollup/plugin-node-resolve ^13.0.4 - Resolves source-root imports with `rootDir: "src"` in `rollup.config.js`.
- @rollup/plugin-commonjs ^20.0.0 - Converts CommonJS dependencies for Rollup bundling.
- rollup-plugin-clear ^2.0.7 - Clears `dist` before builds.
- ESLint ^8.24.0 with @typescript-eslint ^5.38.1 - Lints `src/**/*.ts` through `npm run lint`.
- Prettier ^2.7.1 - Formats source using `.prettierrc`.
- Graphify knowledge graph - `graphify-out/GRAPH_REPORT.md` maps the local code graph; core nodes include `Kernel`, `createDefaultProjectMemorySections()`, `buildStrategyPlan()`, and `createDefaultCommandRegistry()`.

## Key Dependencies

**Critical:**
- `@types/screeps` ^3.2.3 - Enables typed Screeps globals and project-specific `Memory`/`CreepMemory` augmentation in `src/memory/schema.ts`.
- `source-map` ~0.6.1 - Runtime dependency used by `src/utils/ErrorMapper.ts` to remap bundled `main` stack traces to TypeScript source positions from `main.js.map`.
- `screeps-profiler` ^3.0.0 - Optional runtime profiler loaded lazily by `src/profiling/ScreepsProfilerAdapter.ts` only when `Memory.config.observability.deepProfiler.enabled === true` in `src/main.ts`.
- `rollup-plugin-screeps` ^1.0.1 - Deployment bridge from local build output to Screeps official, seasonal, simulator, or private-server branches through `rollup.config.js`.

**Infrastructure:**
- `rollup` ^2.56.2 - Produces the single Screeps-compatible bundle `dist/main.js`.
- `typescript` ^4.8.4 - Enforces `strict`, `noImplicitReturns`, and `allowUnreachableCode: false` from `tsconfig.json`.
- `lodash` ^3.10.1 and `@types/lodash` 3.10.2 - Screeps-era lodash global support; `src/utils/ErrorMapper.ts` uses global `_` for escaped console HTML.
- `@types/node` ^13.13.1 - Node typings for build and test configuration.
- `mocha`, `chai`, `sinon`, `sinon-chai`, and their `@types/*` packages - Unit test infrastructure declared in `package.json`.
- `eslint`, `@typescript-eslint/*`, `eslint-plugin-import`, `eslint-import-resolver-typescript`, and `eslint-config-prettier` - Type-aware linting and import validation for `src/**/*.ts`.

## Configuration

**Environment:**
- `DEST` selects the upload destination in `rollup.config.js`; valid script-backed values in `package.json` are `main`, `pserver`, `season`, and `sim`.
- If `DEST` is omitted, `rollup.config.js` performs a dry-run build and does not upload.
- Screeps upload credentials live in local `screeps.json`; `.gitignore` marks this file ignored because it contains credentials.
- `screeps.sample.json` documents destination shapes for `main`, `sim`, `season`, and `pserver`.
- No `.env` files are detected in the repository.
- Runtime feature flags and policies live in Screeps `Memory.config`, defined by `src/memory/schema.ts` and repaired by `src/memory/migrations.ts`.
- `Memory.config.observability.profiler.enabled` controls lightweight CPU stage profiling in `src/profiling/Profiler.ts` and `src/runtime/Kernel.ts`.
- `Memory.config.observability.deepProfiler.enabled` controls lazy loading of `screeps-profiler` in `src/main.ts` and `src/profiling/ScreepsProfilerAdapter.ts`.

**Build:**
- `rollup.config.js` is the primary build pipeline and uses `src/main.ts` as input, `dist/main.js` as output, CommonJS format, and source maps.
- `tsconfig.json` compiles ESNext modules targeting ES2018 with `moduleResolution: "Node"`, `outDir: "dist"`, `baseUrl: "src/"`, `sourceMap: true`, `strict: true`, `experimentalDecorators: true`, `noImplicitReturns: true`, and `allowUnreachableCode: false`.
- `tsconfig.test.json` extends `tsconfig.json` and switches tests to `module: "CommonJs"`.
- `.eslintrc.js` defines type-aware linting for `src/**/*.ts`.
- `.prettierrc` sets semicolons, 2-space indentation, 120-character print width, double quotes, no trailing commas, arrow parens omitted when possible, and `endOfLine: auto`.
- `test/mocha.opts` registers `test/setup-mocha.js`, `ts-node/register`, and `tsconfig-paths/register`.
- `npm run build` runs `rollup -c`.
- `npm run lint` runs `eslint "src/**/*.ts"`.
- `npm test` and `npm run test-unit` run `mocha test/unit/**/*.ts`.
- `npm run push-main`, `npm run push-pserver`, `npm run push-season`, and `npm run push-sim` build and upload with the corresponding `DEST`.
- `npm run watch-main`, `npm run watch-pserver`, `npm run watch-season`, and `npm run watch-sim` watch-build and upload with the corresponding `DEST`.

## Platform Requirements

**Development:**
- Use Node.js `v16.17.0` from `.nvmrc` for local development.
- Install dependencies from `package.json` with npm.
- Keep source imports compatible with `tsconfig.json` `baseUrl: "src/"` and Rollup `resolve({ rootDir: "src" })`; examples include `runtime/Kernel`, `memory/schema`, and `utils/ErrorMapper`.
- Do not read or commit local `screeps.json`; use `screeps.sample.json` as the credential shape.
- Integration tests require installing `screeps-server-mockup` separately as described by `docs/in-depth/testing.md`.

**Production:**
- Deployment target is Screeps World, Screeps seasonal path, Screeps simulator branch, or a compatible Screeps private server via `rollup-plugin-screeps`.
- Official-host destinations use token-style authentication fields in `screeps.sample.json` for `main`, `sim`, and `season`.
- Private-server destination uses email/password-style fields in `screeps.sample.json` for `pserver`.
- Runtime artifact is `dist/main.js`; `src/utils/ErrorMapper.ts` expects the bundled `main.js.map` module to exist for source-map stack trace mapping.
- Runtime persistence is Screeps `Memory`, with project sections defined in `src/memory/schema.ts` and migrated by `src/memory/migrations.ts` before other lifecycle stages.

---

*Stack analysis: 2026-05-07*
