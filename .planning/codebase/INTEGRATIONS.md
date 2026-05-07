# External Integrations

**Analysis Date:** 2026-05-07

## APIs & External Services

**Screeps Runtime API:**
- Screeps game globals - Core runtime API for each tick.
  - SDK/Client: Ambient runtime globals typed by `@types/screeps` in `package.json`.
  - Auth: Not used inside `src/`; deployment credentials are supplied by local `screeps.json` through `rollup.config.js`.
  - Source usage: `src/main.ts` reads `Memory.config`, `src/runtime/Kernel.ts` reads and writes `Memory` and `Game`, `src/runtime/services.ts` reads `Game.cpu`, `Game.time`, and `Game.shard`, `src/environment/detection.ts` reads `Game.shard`, `Game.rooms`, and `Game.spawns`, `src/environment/simBootstrap.ts` reads `Game.rooms`, `Game.creeps`, and `Game.flags`, and `src/cleanup/creepMemory.ts` reads `Game.creeps` and `Memory.creeps`.

**Screeps Deployment API:**
- Screeps official/private upload endpoint - Local build upload for branches configured in `screeps.json`.
  - SDK/Client: `rollup-plugin-screeps` from `package.json`, configured in `rollup.config.js`.
  - Auth: Token-style entries for `main`, `sim`, and `season`; email/password-style entry for `pserver`, following `screeps.sample.json`.
  - Source usage: Runtime code under `src/` does not call the upload API; `rollup.config.js` reads local `screeps.json` when `DEST` is set.

**Screeps Console Commands:**
- Screeps console global `cmd` - Manual command surface installed into the persistent Screeps global VM.
  - SDK/Client: Screeps global object support; no external package.
  - Auth: Screeps account/session access to the game console, outside runtime code.
  - Implementation: `src/commands/installer.ts` installs `cmd.help`, `cmd.env`, `cmd.sim`, `cmd.config`, `cmd.debug`, `cmd.colony`, `cmd.strategy`, and `cmd.spawn` namespaces.

**Screeps Profiler:**
- `screeps-profiler` - Optional deep profiler integration for runtime function wrapping.
  - SDK/Client: `screeps-profiler` ^3.0.0 from `package.json`.
  - Auth: Not applicable.
  - Implementation: `src/profiling/ScreepsProfilerAdapter.ts` calls `require("screeps-profiler")` lazily, then `enable()` and `wrap()` only when enabled by `Memory.config.observability.deepProfiler.enabled` in `src/main.ts`.

**Source Map Module:**
- Bundled `main.js.map` - Local runtime artifact used to map Screeps stack traces back to TypeScript.
  - SDK/Client: `source-map` ~0.6.1 from `package.json`.
  - Auth: Not applicable.
  - Implementation: `src/utils/ErrorMapper.ts` loads `require("main.js.map")`, constructs `SourceMapConsumer`, caches mapped stack traces, and logs mapped errors to the Screeps console.

**HTTP or Cloud APIs:**
- Not detected in scoped source analysis.
  - SDK/Client: No `fetch`, `axios`, `WebSocket`, Stripe, Supabase, Firebase, AWS, Redis, SQL, MongoDB, or similar external client usage detected under `src/`.
  - Auth: Not applicable.

## Data Storage

**Databases:**
- Screeps `Memory` - Primary persistent JSON store.
  - Connection: Provided by the Screeps runtime; no network connection string.
  - Client: Global `Memory` object typed and extended in `src/memory/schema.ts`.
  - Schema: `src/memory/schema.ts` defines versioned sections for `runtime`, `config`, `colonies`, `processes`, `commands`, `stats`, and `creeps`.
  - Migration: `src/memory/migrations.ts` migrates from existing `Memory.version` to `CURRENT_MEMORY_VERSION = 5` before the kernel continues.
- Not detected: SQL database, document database, local embedded database, hosted database provider, or ORM client.

**File Storage:**
- Runtime: Screeps `Memory` only; runtime code under `src/` does not read or write local files.
- Build artifact: `dist/main.js` and source map output from `rollup.config.js`.
- Configuration template: `screeps.sample.json` is committed as a non-secret sample; local `screeps.json` exists and is ignored.

**Caching:**
- In-memory static cache for source-mapped stack traces in `src/utils/ErrorMapper.ts`.
- In-memory module-level `Kernel` instance in `src/main.ts`.
- Screeps global command cache in `src/commands/installer.ts`, keyed by `__cmdApiVersion`.
- Screeps `Memory.stats.cpu.stages` stores rolling CPU stage summaries through `src/stats/Stats.ts`.
- Not detected: Redis, Memcached, CDN cache, or external cache service.

## Authentication & Identity

**Auth Provider:**
- Screeps account/token authentication for deployment.
  - Implementation: Local `screeps.json` supplies credentials to `rollup-plugin-screeps` through `rollup.config.js`; sample credential fields are documented in `screeps.sample.json`.
  - Runtime code: Not used under `src/`; bot code authenticates implicitly by running inside Screeps after upload.

**Runtime Identity:**
- Screeps ownership model.
  - Implementation: Runtime code checks room/controller ownership through Screeps game objects, for example `src/environment/detection.ts` counts owned rooms from `Game.rooms[roomName].controller?.my`.
  - Not detected: OAuth, JWT, sessions, user table, API keys inside runtime source, or third-party identity provider.

## Monitoring & Observability

**Error Tracking:**
- Custom Screeps console error mapping.
  - Implementation: `src/main.ts` wraps the tick loop with `ErrorMapper.wrapLoop`; `src/utils/ErrorMapper.ts` logs source-mapped stack traces with red HTML in the Screeps console.
  - External service: None detected.

**Logs:**
- Screeps console output.
  - Implementation: `src/logging/Logger.ts` writes filtered log lines with `console.log`, controlled by `Memory.config.observability`.
  - Runtime failures: `src/runtime/Kernel.ts` logs stage failures and continues except for migration failures.
  - Sim guidance: `src/environment/simBootstrap.ts` logs sim setup guidance through `Logger`.

**Metrics/Profiling:**
- CPU stage profiling.
  - Implementation: `src/runtime/Kernel.ts` starts and ends profiler stages; `src/profiling/Profiler.ts` samples `Game.cpu`; `src/stats/Stats.ts` persists summaries to `Memory.stats`.
- Optional deep profiling.
  - Implementation: `src/profiling/ScreepsProfilerAdapter.ts` integrates `screeps-profiler` when `Memory.config.observability.deepProfiler.enabled` is true.

## CI/CD & Deployment

**Hosting:**
- Screeps World and compatible Screeps private server.
  - Official destinations: `main`, `sim`, and `season` in `screeps.sample.json`.
  - Private destination: `pserver` in `screeps.sample.json`.
  - Bundle: `rollup.config.js` emits `dist/main.js` in CommonJS format.

**CI Pipeline:**
- Not detected.
  - No GitHub Actions, GitLab CI, CircleCI, or similar CI configuration was detected during this mapping.
  - Local verification commands are `npm run lint`, `npm test`, and `npm run build` from `package.json`.

## Environment Configuration

**Required env vars:**
- `DEST` - Optional local build-time selector consumed by `rollup.config.js`; when unset, build runs as dry-run without upload.

**Runtime config keys:**
- `Memory.version` - Persistent schema version defined by `src/memory/schema.ts`.
- `Memory.config.automation.enabled` - Automation policy flag defined in `src/memory/schema.ts`.
- `Memory.config.strategy.*` - Strategy policy flags and cadence defined in `src/memory/schema.ts`.
- `Memory.config.construction.*` - Construction policy flags defined in `src/memory/schema.ts`.
- `Memory.config.defense.*` - Defense policy flags defined in `src/memory/schema.ts`.
- `Memory.config.colony.primaryRoomName` and `Memory.config.colony.intelRefreshCadence` - Colony configuration defined in `src/memory/schema.ts`.
- `Memory.config.observability.logLevel` - Logger threshold used by `src/logging/Logger.ts` through `src/runtime/services.ts`.
- `Memory.config.observability.enabledNamespaces` and `Memory.config.observability.namespaceSampling` - Logging controls used by `src/runtime/services.ts`.
- `Memory.config.observability.profiler.enabled` - Lightweight profiler policy defined in `src/memory/schema.ts`.
- `Memory.config.observability.deepProfiler.enabled` - Deep profiler toggle used by `src/main.ts` and `src/profiling/ScreepsProfilerAdapter.ts`.

**Secrets location:**
- `screeps.json` - Local ignored deployment credential file; do not read or commit.
- `screeps.sample.json` - Committed non-secret sample showing destination shapes.
- `.env` files: Not detected.

## Webhooks & Callbacks

**Incoming:**
- Screeps tick callback - Screeps runtime calls exported `loop` from `src/main.ts` every tick after deployment.
- Screeps console commands - Human-initiated calls to global `cmd` functions installed by `src/commands/installer.ts`.
- Not detected: HTTP webhook endpoints, local server routes, or event receiver APIs.

**Outgoing:**
- Screeps upload during build - `rollup-plugin-screeps` uploads bundled code when `DEST` selects a configured destination in `rollup.config.js`.
- Screeps console output - Runtime logs and error traces are emitted with `console.log` in `src/logging/Logger.ts`, `src/runtime/Kernel.ts`, `src/cleanup/creepMemory.ts`, and `src/utils/ErrorMapper.ts`.
- Screeps world mutations - Runtime uses Screeps API calls such as sim guidance flag creation in `src/environment/simBootstrap.ts`, creep memory cleanup in `src/cleanup/creepMemory.ts`, and spawning/task behavior under `src/spawning/` and `src/tasks/`.
- Not detected: outbound HTTP callbacks, webhooks, email, message queues, or third-party telemetry exporters.

---

*Integration audit: 2026-05-07*
