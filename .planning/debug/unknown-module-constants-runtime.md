---
status: resolved
trigger: "集成测试有问题吧，我推到screeps服务器，在sim中console一直报错：Unknown module 'constants/runtime'"
created: "2026-05-07T07:55:00Z"
updated: "2026-05-07T08:04:22Z"
---

# Debug Session: unknown-module-constants-runtime

## Symptoms

- Expected behavior: 上传到 Screeps sim 后，bundle 在真实 Screeps runtime 中正常启动，不应缺失内部模块。
- Actual behavior: sim console 一直报错 `Unknown module 'constants/runtime'`。
- Error messages: `Unknown module 'constants/runtime'`。
- Timeline: Phase 07 集成测试完成后，用户推送到 Screeps 服务器并在 sim 中观察到。
- Reproduction: 构建/上传当前代码到 Screeps sim，进入 sim console 观察运行时报错。

## Current Focus

- hypothesis: Phase 07 集成 helper 通过给 mock server 额外注入 `src/**/*.ts` transpiled module map 掩盖了真实 Screeps bundle 仍包含 `require("constants/runtime")` 的问题；真实 Screeps 只上传 `main` 模块，因此找不到内部模块。
- test: 检查 `dist/main.js` 是否仍包含 `require("constants/runtime")` 或其他未被 Rollup 打包的 src alias require；检查 Rollup/TypeScript module 配置和 integration helper 的 module-map fallback。
- expecting: 如果假设成立，`dist/main.js` 会保留对 `constants/runtime` 等 src alias 的 CommonJS require，integration helper 由于 `loadSourceModules()` 额外提供模块而测试误通过。
- next_action: resolved; deploy rebuilt `dist/main.js` to Screeps sim

## Evidence

- timestamp: 2026-05-07T08:04:22Z
  command: `rtk npm run build`
  result: Build succeeded and generated `dist/main.js`.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk rg -n "require\\([\\\"'][^\\\"']+[\\\"']\\)|constants/runtime|constants/roles|constants/processes|constants/strategy|constants/commands" dist/main.js`
  result: Before the Rollup fix, `dist/main.js` began with `require('constants/runtime')`, `require('constants/roles')`, `require('constants/processes')`, `require('constants/strategy')`, and `require('constants/commands')`.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk sed -n '220,320p' test/integration/helper.ts`
  result: Integration helper loaded `...this.loadSourceModules()` before `main`, and `loadSourceModules()` transpiled `src/**/*.ts` into Screeps module names such as `constants/runtime`.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk npm run build` after setting `resolve({ rootDir: "src", preferBuiltins: false })`
  result: Build succeeded.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk rg -n "require\\([\\\"'][^\\\"']+[\\\"']\\)|constants/runtime|constants/roles|constants/processes|constants/strategy|constants/commands" dist/main.js`
  result: After the fix, no `constants/*` source alias requires remained; only expected runtime `require("main.js.map")` and lazy `require("screeps-profiler")` remained.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk rg -n "require\\(['\\\"](?:cleanup|colony|commands|constants|environment|logging|memory|processes|profiling|roles|spawning|stats|strategy|tasks|utils|validation)/" dist/main.js`
  result: No source-path module requires remained in the built Screeps bundle.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk npm run lint`
  result: Passed.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk npm run test-unit`
  result: Passed, 195 tests.
- timestamp: 2026-05-07T08:04:22Z
  command: `rtk npm run test-integration`
  result: Passed, 6 integration tests, including new bundle no-source-alias-require test and mock runtime with only `main` loaded.

## Eliminated

- Not a missing source file: `src/constants/runtime.ts` exists and unit tests can import it through tsconfig path aliases.
- Not a Screeps sim object/setup issue: the bundle failed before gameplay logic because the uploaded module set did not include `constants/runtime`.
- Not caused by ordinary Rollup inability to bundle all source aliases: after disabling built-in preference, the same imports inline correctly.
- Not caused by the expected `require("main.js.map")` boundary or lazy `require("screeps-profiler")`; those are separate known runtime module boundaries and no `constants/*` alias requires remain.

## Resolution

- root_cause: Rollup node-resolve preferred Node built-ins by default, so source aliases under `constants/*` collided with the Node `constants` built-in family and were left as external CommonJS `require('constants/...')` calls in `dist/main.js`; Phase 07 integration helper masked this by injecting transpiled `src/**/*.ts` as extra Screeps modules.
- fix: Set `@rollup/plugin-node-resolve` to `preferBuiltins: false`, remove `loadSourceModules()` from the integration helper so mock runtime loads only `main`, and add an integration bundle test that fails if source-path module requires leak into `dist/main.js`.
- verification: `rtk npm run build`; source-alias require scan returned no matches; `rtk npm run lint`; `rtk npm run test-unit` (195 passing); `rtk npm run test-integration` (6 passing).
- files_changed: `rollup.config.js`; `test/integration/helper.ts`; `test/integration/bundle.test.ts`; `.planning/debug/unknown-module-constants-runtime.md`.
