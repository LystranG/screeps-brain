# Coding Conventions

**Analysis Date:** 2026-05-03

## Naming Patterns

**Files:**
- Use PascalCase for class-like utility files that export a matching class, such as `src/utils/ErrorMapper.ts`.
- Use lowercase descriptive names for entry points and test helpers, such as `src/main.ts`, `test/unit/mock.ts`, `test/setup-mocha.js`, and `test/integration/helper.ts`.
- Name executable test files with `.test.ts`; Mocha discovers `test/unit/**/*.ts` through `package.json`, and project docs require `.test.ts` naming in `docs/in-depth/testing.md`.

**Functions:**
- Use camelCase for functions and methods, enforced by `camelcase` and `id-match` in `.eslintrc.js`.
- Export the Screeps tick entry point as `loop` from `src/main.ts`; keep new tick orchestration reachable from that exported function.
- Use Mocha BDD names `describe`, `it`, `before`, `beforeEach`, `afterEach`, and `before` in test files under `test/unit/` and `test/integration/`.

**Variables:**
- Use camelCase local variables such as `outStack`, `persistValue`, `notPersistValue`, and `memory` in `src/utils/ErrorMapper.ts` and `test/unit/main.test.ts`.
- Use uppercase constants for fixed test/build configuration values such as `DIST_MAIN_JS` in `test/integration/helper.ts`.
- Avoid blacklisted identifiers `any`, `Number`, `number`, `String`, `string`, `Boolean`, `boolean`, and `Undefined`; `.eslintrc.js` enforces this through `id-blacklist`.

**Types:**
- Use PascalCase for classes and interfaces, such as `ErrorMapper` in `src/utils/ErrorMapper.ts`, `Memory` and `CreepMemory` in `src/main.ts`, and `IntegrationTestHelper` in `test/integration/helper.ts`.
- Prefer `interface` for object shape declarations; `.eslintrc.js` enables `@typescript-eslint/consistent-type-definitions`.
- Extend Screeps ambient globals inside `declare global` in `src/main.ts` when adding game memory types or game-specific global interfaces.

## Code Style

**Formatting:**
- Use Prettier settings from `.prettierrc`: semicolons enabled, 2-space indentation, 120-character print width, double quotes, no trailing commas, arrow parens omitted when possible, and `endOfLine: auto`.
- Format TypeScript and JavaScript source before linting; `docs/in-depth/prettier.md` documents editor format-on-save support and the project Prettier settings.
- Keep import and object formatting consistent with Prettier. Existing files show both double-quoted TypeScript imports in `src/main.ts` and single-quoted JavaScript requires in `test/setup-mocha.js`; new TypeScript should follow `.prettierrc`.

**Linting:**
- Run `npm run lint` for source linting; `package.json` maps it to `eslint "src/**/*.ts"`.
- ESLint config lives in `.eslintrc.js` and extends `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:@typescript-eslint/recommended-requiring-type-checking`, `plugin:import/*`, and `prettier`.
- Type-aware linting uses `parserOptions.project: "tsconfig.json"` in `.eslintrc.js`; new linted TypeScript must be included by `tsconfig.json`.
- Keep explicit member accessibility on class members; `.eslintrc.js` enforces `@typescript-eslint/explicit-member-accessibility`, as shown by `private static`, `public static`, and `public static get` in `src/utils/ErrorMapper.ts`.
- Avoid multiple classes per file; `.eslintrc.js` enforces `max-classes-per-file: 1`.
- Avoid bitwise operations, `eval`, wrapper constructors, `var`, literal throws, and missing radix arguments; `.eslintrc.js` enforces these rules.
- `console.log` is permitted for Screeps runtime output by `.eslintrc.js` and documented in `docs/in-depth/typescript.md`.

## Import Organization

**Order:**
1. External dependencies first, such as `import { SourceMapConsumer } from "source-map";` in `src/utils/ErrorMapper.ts`.
2. Project absolute imports from the `src/` base URL, such as `import { ErrorMapper } from "utils/ErrorMapper";` in `src/main.ts`.
3. Relative test imports, such as `import {Game, Memory} from "./mock"` in `test/unit/main.test.ts` and `import {helper} from "./helper";` in `test/integration/integration.test.ts`.

**Path Aliases:**
- Use `tsconfig.json` `baseUrl: "src/"` for source imports. Import shared source modules as `utils/ErrorMapper` rather than reaching through relative paths from `src/main.ts`.
- Tests load `tsconfig-paths/register` through `test/mocha.opts`, so the same `src/` base URL aliases work during Mocha runs.
- Rollup resolves modules from `src` through `resolve({ rootDir: "src" })` in `rollup.config.js`; keep source aliases compatible with both TypeScript and Rollup.

## Error Handling

**Patterns:**
- Wrap the exported Screeps loop with `ErrorMapper.wrapLoop` in `src/main.ts`; new top-level game logic should run inside that wrapper so runtime errors get mapped through source maps.
- Catch `unknown` runtime values in wrappers, narrow to `Error`, and rethrow non-`Error` values. `src/utils/ErrorMapper.ts` catches `e`, handles `e instanceof Error`, and rethrows anything else.
- Throw `Error` objects, not literals; `.eslintrc.js` enforces `no-throw-literal`, and `rollup.config.js` throws `new Error("Invalid upload destination")`.
- Escape stack traces before logging HTML into Screeps console output. `src/utils/ErrorMapper.ts` uses `_.escape` before printing mapped or simulator stack traces.
- Cache expensive source-map results in a static object before returning them; `src/utils/ErrorMapper.ts` stores mapped stacks in `ErrorMapper.cache`.

## Logging

**Framework:** `console`

**Patterns:**
- Use `console.log` for Screeps runtime status and error output. `src/main.ts` logs the current tick, and `src/utils/ErrorMapper.ts` logs source-mapped stack traces.
- Build scripts may log operational status; `rollup.config.js` logs when no `DEST` is specified and upload is skipped.
- Keep logs concise because Screeps console output is runtime-visible and CPU-sensitive.

## Comments

**When to Comment:**
- Add comments around Screeps-specific runtime constraints, source-map limitations, and test global injection. Examples live in `src/main.ts`, `src/utils/ErrorMapper.ts`, and `test/setup-mocha.js`.
- Use comments to explain why a lint or type escape is required. `test/unit/main.test.ts` documents `@ts-ignore` when assigning `Game` and `Memory` onto `global`.
- Avoid comments that restate obvious assignments. Existing useful comments explain source-map CPU cost in `src/utils/ErrorMapper.ts` and game memory typing caveats in `src/main.ts`.

**JSDoc/TSDoc:**
- Use JSDoc for public utility APIs with non-obvious behavior, parameters, returns, and warnings. `src/utils/ErrorMapper.ts` documents `sourceMappedStackTrace(error: Error | string): string`.
- Ambient Screeps type declarations in `src/main.ts` use block comments instead of formal TSDoc because they document global merge behavior rather than exported APIs.

## Function Design

**Size:** Keep tick orchestration small in `src/main.ts` and move reusable logic into focused modules under `src/`. `ErrorMapper.wrapLoop` isolates error handling from game behavior.

**Parameters:** Use explicit parameter types for exported/public utility methods, such as `sourceMappedStackTrace(error: Error | string)` and `wrapLoop(loop: () => void)` in `src/utils/ErrorMapper.ts`.

**Return Values:** Rely on inference for simple callbacks when clear, but keep public/static utility return types explicit. `tsconfig.json` enables `noImplicitReturns`, so all code paths in non-void functions must return or throw consistently.

## Module Design

**Exports:** Use named exports. `src/main.ts` exports `loop`, `src/utils/ErrorMapper.ts` exports `ErrorMapper`, `test/unit/mock.ts` exports `Game` and `Memory`, and `test/integration/helper.ts` exports `helper`.

**Barrel Files:** Not detected. Import directly from implementation modules such as `utils/ErrorMapper` and `./mock`.

**Planning Artifacts:** Codebase map documents live under `.planning/codebase/` and use uppercase Markdown filenames, as defined by `.codex/skills/gsd-map-codebase/SKILL.md`. Keep future quality-map updates in `.planning/codebase/CONVENTIONS.md` and `.planning/codebase/TESTING.md`.

---

*Convention analysis: 2026-05-03*
