# Technology Stack

**Analysis Date:** 2026-05-03

## Languages

**Primary:**
- TypeScript 4.8.4 - Screeps bot source in `src/main.ts` and `src/utils/ErrorMapper.ts`, compiled with `tsconfig.json`.
- JavaScript ES2018/CommonJS output - Rollup bundles `src/main.ts` into `dist/main.js` for the Screeps runtime via `rollup.config.js`.

**Secondary:**
- JavaScript - Build and test configuration in `rollup.config.js`, `.eslintrc.js`, `test/setup-mocha.js`, and `.devcontainer/Dockerfile`.
- Markdown - Project and starter documentation in `README.md` and `docs/`.
- JSON/JSONC - Package, TypeScript, Screeps upload, GitBook, and devcontainer configuration in `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `screeps.json`, `screeps.sample.json`, `book.json`, and `.devcontainer/devcontainer.json`.

## Runtime

**Environment:**
- Node.js v16.17.0 - Local project runtime pinned by `.nvmrc`.
- Node.js 12 Bullseye container - Optional VS Code remote/container runtime defined by `.devcontainer/Dockerfile`.
- Screeps JavaScript runtime - Production execution environment for the bundled CommonJS module exported from `dist/main.js`; source code uses Screeps globals such as `Game`, `Memory`, `Game.creeps`, `Game.rooms`, and `console` in `src/main.ts` and `src/utils/ErrorMapper.ts`.

**Package Manager:**
- npm - Scripts and dependencies are defined in `package.json`.
- Lockfile: present locally at `package-lock.json` with lockfileVersion 3.
- Repository ignore status: `.gitignore` lists `/package-lock.json`, so the local npm lockfile is not intended to be committed unless ignore rules are changed.
- Yarn support is documented in `README.md` and `docs/getting-started/installation.md`, but no `yarn.lock` is present.

## Frameworks

**Core:**
- Screeps World API via `@types/screeps` ^3.2.3 - Provides ambient TypeScript declarations for Screeps globals used in `src/main.ts`.
- Rollup ^2.56.2 - Bundles TypeScript source from `src/main.ts` into `dist/main.js` using `rollup.config.js`.
- TypeScript ^4.8.4 - Strict TypeScript compilation configured in `tsconfig.json`.

**Testing:**
- Mocha ^5.2.0 - Unit test runner invoked by `npm run test-unit` from `package.json`; configured by `test/mocha.opts` and `test/setup-mocha.js`.
- Chai ^4.2.0 - Assertion library used in `test/unit/main.test.ts` and `test/integration/integration.test.ts`.
- Sinon ^6.3.5 and sinon-chai ^3.2.0 - Test double and assertion helpers registered globally in `test/setup-mocha.js`.
- ts-node ^10.2.0 - Executes TypeScript tests through `ts-node/register` in `test/mocha.opts`.
- tsconfig-paths ^3.10.1 - Resolves `baseUrl` imports such as `utils/ErrorMapper` during tests via `test/mocha.opts`.
- screeps-server-mockup - Optional integration-test dependency referenced by `test/integration/helper.ts` and `docs/in-depth/testing.md`; it is not installed in `package.json`.

**Build/Dev:**
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

**Critical:**
- `@types/screeps` ^3.2.3 - Enables typed Screeps globals and interface augmentation in `src/main.ts`.
- `rollup-plugin-screeps` ^1.0.1 - Performs deploy/upload to Screeps using `screeps.json` destination objects from `rollup.config.js`.
- `rollup` ^2.56.2 - Produces the single CommonJS Screeps bundle `dist/main.js`.
- `typescript` ^4.8.4 - Enforces strict static typing with `strict`, `noImplicitReturns`, and `allowUnreachableCode: false` in `tsconfig.json`.
- `source-map` ~0.6.1 - Runtime stack trace remapping dependency used by `src/utils/ErrorMapper.ts` through `SourceMapConsumer`.

**Infrastructure:**
- `@rollup/plugin-node-resolve` ^13.0.4 - Resolves source-root imports and node modules during bundling.
- `@rollup/plugin-commonjs` ^20.0.0 - Allows CommonJS dependency compatibility in Rollup bundles.
- `rollup-plugin-typescript2` ^0.31.0 - Integrates TypeScript compilation with Rollup.
- `rollup-plugin-clear` ^2.0.7 - Removes previous `dist` output before each build.
- `lodash` ^3.10.1 - Exposed as global `_` in tests via `test/setup-mocha.js`; Screeps runtime commonly provides lodash globally, and `src/utils/ErrorMapper.ts` uses `_.escape`.
- `@types/lodash` 3.10.2 - Type declarations matching the Screeps-era lodash global.
- `@types/node` ^13.13.1 - Node typings for build and test configuration.
- `mocha`, `chai`, `sinon`, `sinon-chai`, and related `@types/*` packages - Unit test infrastructure declared in `package.json`.

## Configuration

**Environment:**
- Node version is pinned in `.nvmrc` as `v16.17.0`.
- Build destination is selected with the `DEST` environment variable consumed by `rollup.config.js`.
- If `DEST` is omitted, `rollup.config.js` performs a dry-run build and does not upload.
- Valid configured destination names are `main`, `pserver`, `season`, and `sim`, matching `package.json` scripts and top-level keys in `screeps.json` and `screeps.sample.json`.
- Screeps upload configuration lives in `screeps.json`; `.gitignore` marks `screeps.json` as ignored because it contains credentials.
- Sample upload configuration lives in `screeps.sample.json`.

**Build:**
- `rollup.config.js` is the primary build pipeline:
  - input: `src/main.ts`
  - output file: `dist/main.js`
  - output format: CommonJS (`cjs`)
  - sourcemap: enabled
  - plugins: clear, node-resolve, commonjs, TypeScript, Screeps upload
- `tsconfig.json` compiles ESNext modules targeting ES2018 with `moduleResolution: "Node"`, `outDir: "dist"`, `baseUrl: "src/"`, `sourceMap: true`, `strict: true`, `experimentalDecorators: true`, `noImplicitReturns: true`, and `allowUnreachableCode: false`.
- `tsconfig.test.json` extends `tsconfig.json` and switches tests to `module: "CommonJs"`.
- `.eslintrc.js` defines TypeScript linting behavior.
- `.prettierrc` defines formatter behavior.
- `.editorconfig` defines editor-level formatting defaults.

**Scripts:**
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

**Development:**
- Use Node.js `v16.17.0` from `.nvmrc` for the local repository state.
- Install dependencies with npm using `package.json`; `package-lock.json` is present locally but ignored by `.gitignore`.
- Rollup CLI can be invoked through local npm scripts; `.devcontainer/Dockerfile` also installs Rollup globally for the optional container.
- Optional remote/container development requires Docker and VS Code Dev Containers using `.devcontainer/devcontainer.json` and `.devcontainer/Dockerfile`.
- Do not commit `screeps.json`; use `screeps.sample.json` as the template and keep credentials local.

**Production:**
- Deployment target is Screeps World or compatible Screeps private server via `rollup-plugin-screeps`.
- Official-host destinations use token-style authentication fields in `screeps.json` for `main`, `season`, and `sim`.
- Private-server destination uses account/password-style fields in `screeps.json` for `pserver`; README and docs note that private upload requires a private server with authentication support such as `screepsmod-auth`.
- Runtime artifact is `dist/main.js` plus source map support configured by `rollup.config.js`.

---

*Stack analysis: 2026-05-03*
