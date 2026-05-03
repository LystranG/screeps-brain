# Codebase Structure

**Analysis Date:** 2026-05-03

## Directory Layout

```text
screeps/
├── src/                 # TypeScript source bundled for Screeps
│   ├── main.ts          # Screeps runtime entry and exported loop
│   └── utils/           # Shared runtime utilities
├── test/                # Mocha tests and test runtime setup
│   ├── unit/            # Direct loop tests with mocked Screeps globals
│   ├── integration/     # Screeps server mockup integration tests
│   ├── mocha.opts       # Mocha CLI configuration
│   └── setup-mocha.js   # Test globals and ts-node setup
├── docs/                # GitBook documentation source
│   ├── getting-started/ # Install, auth, and deploy docs
│   ├── in-depth/        # Bundling, testing, TypeScript, deploy docs
│   ├── README.md        # Docs introduction
│   └── SUMMARY.md       # GitBook table of contents
├── dist/                # Generated Rollup output consumed by Screeps
├── .planning/           # GSD planning and codebase maps
├── .codex/              # Project Codex/GSD skills and local agent metadata
├── .claude/             # Local Claude/GSD metadata
├── .opencode/           # Local OpenCode metadata
├── .devcontainer/       # Development container configuration
├── .vscode/             # Editor workspace configuration
├── package.json         # npm scripts and dependencies
├── package-lock.json    # npm lockfile
├── rollup.config.js     # Build, bundle, and Screeps upload pipeline
├── tsconfig.json        # Main TypeScript compiler configuration
├── tsconfig.test.json   # Test compiler override
├── screeps.sample.json  # Checked-in deployment config template
├── screeps.json         # Local deployment config with credentials; do not read or commit values
├── README.md            # Project overview and usage
├── CONTRIBUTING.md      # Contribution guidance
├── book.json            # GitBook configuration
└── LICENSE              # Project license
```

## Directory Purposes

**`src/`:**
- Purpose: Contains all TypeScript source code that Rollup can bundle into Screeps runtime output.
- Contains: Runtime entry module and application/runtime helpers.
- Key files: `src/main.ts`, `src/utils/ErrorMapper.ts`.

**`src/utils/`:**
- Purpose: Holds shared helper code that supports runtime behavior without owning Screeps strategy decisions.
- Contains: Utility classes and functions imported by runtime modules.
- Key files: `src/utils/ErrorMapper.ts`.

**`test/unit/`:**
- Purpose: Tests TypeScript source directly with mocked Screeps globals.
- Contains: Mocha/Chai test files and local test doubles.
- Key files: `test/unit/main.test.ts`, `test/unit/mock.ts`.

**`test/integration/`:**
- Purpose: Tests built Screeps bundle behavior in a local mock server when integration dependencies are available.
- Contains: Mock server helper and integration suites.
- Key files: `test/integration/helper.ts`, `test/integration/integration.test.ts`.

**`test/`:**
- Purpose: Central test setup shared by unit and integration tests.
- Contains: Mocha options, global test registration, TypeScript runtime setup.
- Key files: `test/mocha.opts`, `test/setup-mocha.js`.

**`docs/`:**
- Purpose: Stores GitBook documentation for users of the starter.
- Contains: Getting-started guides, in-depth guides, cookbook entries, images, and navigation.
- Key files: `docs/README.md`, `docs/SUMMARY.md`, `docs/getting-started/deploying.md`, `docs/in-depth/testing.md`.

**`dist/`:**
- Purpose: Stores generated Rollup bundle output for Screeps.
- Contains: `dist/main.js` and generated source map files after builds.
- Key files: Generated `dist/main.js`.

**`.planning/`:**
- Purpose: Stores GSD planning artifacts and codebase maps.
- Contains: Codebase mapping documents under `.planning/codebase/`.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`.

**`.codex/skills/`:**
- Purpose: Stores project-specific Codex/GSD skills.
- Contains: Skill directories, each with `SKILL.md` and optional supporting rules.
- Key files: `.codex/skills/gsd-map-codebase/SKILL.md`.

## Key File Locations

**Entry Points:**
- `src/main.ts`: Screeps runtime entry; exports the `loop` function expected by the game environment.
- `rollup.config.js`: Build entry; reads `src/main.ts`, emits `dist/main.js`, and handles optional upload.
- `test/unit/main.test.ts`: Unit test entry for direct loop behavior.
- `test/integration/integration.test.ts`: Integration test entry for mock server behavior.

**Configuration:**
- `package.json`: npm scripts for lint, build, push, watch, and tests.
- `package-lock.json`: Locked npm dependency graph.
- `tsconfig.json`: Main TypeScript configuration; sets `baseUrl` to `src/`.
- `tsconfig.test.json`: Test configuration extending `tsconfig.json` and using CommonJS modules.
- `rollup.config.js`: Rollup plugin chain and Screeps destination selection.
- `test/mocha.opts`: Mocha runner options.
- `test/setup-mocha.js`: Test globals and `TS_NODE_PROJECT` setup.
- `.eslintrc.js`: ESLint configuration.
- `.prettierrc`: Prettier configuration.
- `.editorconfig`: Editor formatting defaults.
- `.nvmrc`: Node version hint.
- `book.json`: GitBook configuration.
- `screeps.sample.json`: Template for Screeps upload destinations.
- `screeps.json`: Local Screeps deployment credentials; note existence only.

**Core Logic:**
- `src/main.ts`: Current per-tick logic and memory cleanup.
- `src/utils/ErrorMapper.ts`: Source-map-aware top-level error handling for the loop.

**Testing:**
- `test/unit/main.test.ts`: Tests loop export, void return, and creep memory cleanup.
- `test/unit/mock.ts`: Mock `Game` and `Memory` objects for unit tests.
- `test/integration/helper.ts`: Creates `ScreepsServer`, loads `dist/main.js`, and manages server lifecycle.
- `test/integration/integration.test.ts`: Exercises mock server ticking and memory persistence.

**Documentation:**
- `README.md`: Root project overview, setup, and Rollup deployment notes.
- `docs/SUMMARY.md`: Documentation navigation.
- `docs/getting-started/authenticating.md`: Screeps authentication documentation.
- `docs/getting-started/deploying.md`: Deployment flow documentation.
- `docs/in-depth/module-bundling.md`: Rollup and module bundling details.
- `docs/in-depth/testing.md`: Integration testing guidance.

## Naming Conventions

**Files:**
- Source entry files use lowercase names: `src/main.ts`.
- Utility class files use PascalCase matching the exported class: `src/utils/ErrorMapper.ts`.
- Unit and integration test files use `*.test.ts`: `test/unit/main.test.ts`, `test/integration/integration.test.ts`.
- Test support files use descriptive lowercase names: `test/unit/mock.ts`, `test/integration/helper.ts`.
- Root configuration files use standard tool names: `tsconfig.json`, `rollup.config.js`, `.eslintrc.js`, `.prettierrc`.
- Screeps deployment template uses `.sample.json`: `screeps.sample.json`.

**Directories:**
- Application source directories use lowercase names: `src/`, `src/utils/`.
- Test directories are grouped by test type: `test/unit/`, `test/integration/`.
- Documentation directories use lowercase or hyphenated names: `docs/getting-started/`, `docs/in-depth/`.
- Generated build output uses `dist/`.
- Planning artifacts live under `.planning/`.

## Where to Add New Code

**New Screeps Behavior:**
- Primary code: Add domain modules under `src/`, then call them from the callback in `src/main.ts`.
- Tests: Add direct behavior tests under `test/unit/` and mock Screeps globals in `test/unit/mock.ts` as needed.

**New Creep Role:**
- Implementation: Add a role module under a new domain directory such as `src/roles/`.
- Entry wiring: Import the role module into `src/main.ts` or into a coordinator module called by `src/main.ts`.
- Tests: Add `test/unit/*.test.ts` files covering the role behavior with mocked `Game` and `Memory`.

**New Room, Spawn, or Colony System:**
- Implementation: Add domain modules under `src/rooms/`, `src/spawns/`, or `src/colony/` when the system grows beyond one file.
- Entry wiring: Keep `src/main.ts` as the thin per-tick orchestrator.
- Tests: Add unit tests in `test/unit/` and integration coverage in `test/integration/` when behavior depends on server simulation.

**New Component/Module:**
- Implementation: Place runtime modules under `src/` with imports resolved from `src/` through `tsconfig.json` `baseUrl`.
- Utilities: Place cross-cutting helpers in `src/utils/` only when they are not strategy-specific.
- Generated output: Do not add source code to `dist/`.

**Utilities:**
- Shared helpers: `src/utils/`.
- Error handling utilities: Extend or add beside `src/utils/ErrorMapper.ts`.
- Avoid importing local deployment config such as `screeps.json` from any `src/` utility.

**Tests:**
- Unit tests: `test/unit/`.
- Test doubles: `test/unit/mock.ts` or additional support files beside the relevant tests.
- Integration tests: `test/integration/`, using `test/integration/helper.ts` when built bundle behavior matters.

**Documentation:**
- User setup docs: `docs/getting-started/`.
- Technical implementation docs: `docs/in-depth/`.
- Navigation updates: `docs/SUMMARY.md`.

## Special Directories

**`dist/`:**
- Purpose: Generated JavaScript bundle and source maps produced by Rollup.
- Generated: Yes.
- Committed: Present in the working tree; treat as generated output and prefer editing `src/`.

**`node_modules/`:**
- Purpose: Installed npm dependencies.
- Generated: Yes.
- Committed: No.

**`.planning/`:**
- Purpose: GSD workflow state and codebase analysis.
- Generated: Yes.
- Committed: Project-dependent; do not overwrite unrelated planning files.

**`.codex/`:**
- Purpose: Project-local Codex skills and automation metadata.
- Generated: Project tooling.
- Committed: Present in the working tree; preserve unrelated files.

**`.claude/`:**
- Purpose: Local Claude/GSD metadata.
- Generated: Project tooling.
- Committed: Present in the working tree; preserve unrelated files.

**`.opencode/`:**
- Purpose: Local OpenCode metadata.
- Generated: Project tooling.
- Committed: Present in the working tree; preserve unrelated files.

**`.devcontainer/`:**
- Purpose: Development container setup.
- Generated: No.
- Committed: Present in the working tree; use for containerized development settings.

**`.vscode/`:**
- Purpose: Editor workspace settings.
- Generated: No.
- Committed: Present in the working tree; use for editor-only configuration.

**`docs/getting-started/img/`:**
- Purpose: Static images used by documentation pages.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-05-03*
