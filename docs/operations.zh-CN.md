# lystran-brain 中文运维手册

这份手册面向日常操作者和开发者，用来判断本地集成证据、官方 sim、普通房间和私服启动状态是否正常。它只描述现有验证、部署和 `global.cmd` 巡检流程，不是贡献指南，也不新增运行时能力。

## 使用边界

- 本地自动化证据以 `screeps-server-mockup@1.5.1` 为主：它能逐 tick 运行私服式环境、读取 `Memory`、执行 `player.console(...)`，并复现多数启动路径。
- 官方 sim、MMO 普通房间和私服仍需要人工分层验证。mock-server 与官方环境的 shard、房间对象、账户状态、CPU bucket、tick 调度和部分引擎细节可能不同。
- 运行时代码不能创建 source、spawn、controller 或初始 creep。缺少这些对象时，应按 `cmd.sim.guidance()` 和本手册排查，而不是在 runtime 中绕过 Screeps API 限制。
- 控制台操作优先使用只读 `cmd` 巡检命令。部署脚本只负责上传 bundle，不应直接改写核心调度、Memory schema 或任务状态。

## 本地验证

在任何 sim、MMO 或私服上传前，先在本地运行这些门禁：

```bash
npm run build
npm run lint
npm test
npm run test-integration
```

当前集成测试入口是 `npm run test-integration`。该脚本会进入 Node 22 包装路径，先执行原生依赖/运行时 snapshot bootstrap，然后执行等价的 `npm run build && mocha test/integration/**/*.ts`，所以它会先构建 `dist/main.js` 再运行 Mocha 集成套件，避免测试旧 bundle。

正常信号：

- `npm run build` 输出 Rollup 构建成功，并在未设置 `DEST` 时提示只编译不上传。
- `npm run lint` 无错误退出。
- `npm test` 运行单元测试并全部通过。
- `npm run test-integration` 报告集成套件通过，覆盖 smoke、普通 owned-room bootstrap、ready sim 和 degraded sim 场景。

异常信号：

- build 失败：先修复 TypeScript/Rollup 错误，不要上传旧 bundle。
- lint 失败：按 lint 定位修复源码或测试，不要用配置绕过。
- integration 启动失败：见 `## 故障排查` 的集成服务器条目。

## 本地集成测试

集成测试使用 `screeps-server-mockup@1.5.1`，并通过项目脚本固定当前可用路径：

```bash
npm run test-integration
```

脚本链路：

```text
npm run test-integration
  -> mise x node@22 -- npm run test-integration:node22 --
  -> npm run test-integration:bootstrap
  -> npm run build && mocha test/integration/**/*.ts
```

判读方式：

- 本地 mock-server 是自动化主证据，适合检查 `Memory` 初始化、command 输出、spawn queue 消费、worker 采集/升级进展和 degraded guidance。
- 如果 mock-server 不能可靠表达官方 sim 或 MMO 行为，应保留稳定自动化覆盖，并在官方 sim 或普通房间中按本手册手动复核。
- 集成测试中的 `MaxListenersExceededWarning` 若出现在全部测试通过之后，通常是 mock-server driver 生命周期噪音；若同时有断言失败或进程退出，再按启动失败处理。

## 官方 sim 启动检查

上传前先确认本地门禁通过，然后使用：

```bash
npm run push-sim
```

配置形状参考 `screeps.sample.json` 的 `sim` 目标；真实 token 只放在本地忽略的 `screeps.json`。

部署后在 Screeps sim 控制台检查：

1. 运行 `cmd.env.status()`：正常应显示 shard/environment 已识别，sim 环境应能看到 `sim` 或对应环境字段。
2. 运行 `cmd.sim.status()`：正常应包含 sim bootstrap 状态、ready 或 degraded 判断、最近 tick 信息。
3. 运行 `cmd.sim.guidance()`：ready sim 应没有阻断性 missing code；degraded sim 会显示 `missing-spawn`、`missing-source`、`missing-controller` 等原因和人工 setup 指引。
4. 运行 `cmd.colony.status()`：ready 房间应能看到 colony ready、process 状态和房间名；缺对象时应显示 degraded，而不是 kernel 崩溃。
5. 运行 `cmd.spawn.queue()` 和 `cmd.spawn.status()`：有 spawn 且能量/需求满足时，队列应从 queued/validating/validated 逐步变成 spawning/spawned，或进入 blocked/failed 等可解释状态。

官方 sim 与本地 mock-server 的已知差异：

- 官方 sim 的初始世界可能缺少 source、spawn 或初始 creep；mock 场景会显式构造 ready/degraded 条件。
- 官方 sim 的房间对象和 UI setup 依赖人工操作，runtime 只能记录 guidance，不能创建缺失对象。
- 官方 sim 的 tick、CPU 和控制台输出节奏可能不同；判断时以稳定 `cmd` token 和 `Memory` 状态为准，不以完整日志快照为准。

## 普通房间/私服启动检查

普通 MMO 房间上传前使用：

```bash
npm run push-main
```

私服上传前使用：

```bash
npm run push-pserver
```

Season 目标如需使用：

```bash
npm run push-season
```

配置形状参考 `screeps.sample.json` 的 `main`、`pserver` 和 `season`；真实凭据留在本地 `screeps.json`。

部署后按顺序检查：

1. `cmd.help()`：确认 `cmd.env`、`cmd.sim`、`cmd.colony`、`cmd.spawn`、`cmd.strategy`、`cmd.debug` 命名空间存在。
2. `cmd.env.status()`：普通 MMO 应显示 world/normal 类环境；私服可能显示 private/server 相关环境，不应误判为 official sim。
3. `cmd.colony.list()`：应列出可见 owned room。若为空，检查是否真的拥有房间、代码是否在正确 branch、房间是否可见。
4. `cmd.colony.detail("W1N1")`：把 `W1N1` 换成真实房间名；正常应包含 controller、source、spawn、missing reasons 和 process/colony 状态。
5. `cmd.spawn.status()` 与 `cmd.spawn.queue()`：正常应能看到 spawn lifecycle、队列长度、请求状态和失败原因。
6. `cmd.strategy.status()`、`cmd.strategy.plan("W1N1")`、`cmd.strategy.explain("W1N1")`：正常应显示策略计划已生成或等待刷新；高风险计划应显示 policy gate，而不是直接执行。
7. `cmd.debug.stats()` 和 `cmd.debug.observability()`：用于确认 tick、CPU/stats、日志/profiler 状态可见。

## 常用 cmd 巡检

| 场景 | 何时运行 | 命令 | 正常输出 token | 异常信号 |
| ---- | -------- | ---- | --------------- | -------- |
| 查看命令入口 | 部署后第一步 | `cmd.help()` | `cmd.env.status()`、`cmd.colony.status()`、`read-only` | 缺少命名空间，说明 bundle 不是当前版本或命令安装失败 |
| 环境识别 | 每次切换 sim/MMO/私服后 | `cmd.env.status()` | environment/shard/version/tick | sim 被识别为普通环境，或 shard 信息为空 |
| sim 状态 | 官方 sim 启动或 degraded 排查 | `cmd.sim.status()` | `ready=`、`completed=`、`lastSeenTick=` | completed=false 且缺少 guidance，或 tick 长时间不变 |
| sim 指引 | sim 缺对象或无进展 | `cmd.sim.guidance()` | `missing-spawn`、`missing-source`、`missing-controller`、flag/setup 提示 | 没有列出缺失对象但房间仍 degraded |
| colony 总览 | 每次部署后 | `cmd.colony.status()` | `ready` 或 `degraded`、房间名、process 状态 | `degraded`、missing reasons、没有 primary room |
| colony 列表 | 多房间或看不到房间时 | `cmd.colony.list()` | owned room 名称、status | 列表为空或目标房间缺失 |
| 单房间细节 | 排查指定房间 | `cmd.colony.detail("W1N1")` | controller/source/spawn/intel/process | `missing-spawn`、`missing-source`、`missing-controller` |
| spawn 生命周期 | worker 没出现时 | `cmd.spawn.status()` | spawn 名称、room、busy/idle、last result | spawn 不存在、busy 长期不释放、错误码反复出现 |
| spawn 队列 | 需求不消费时 | `cmd.spawn.queue()` / `cmd.spawn.status()` | queue length、request status、role | queued/validated 长期不变，blocked/failed 原因不可解释 |
| spawn 试算 | 上传后不确定能否生成 | `cmd.spawn.dryRun("W1N1")` | body/cost/ok 或可解释错误 | 能量足够却持续 dry-run 失败 |
| 策略状态 | 验证策略层不直接执行高风险动作 | `cmd.strategy.status()` | active/refresh/gated policy | 高风险 intent 未被 gate，或状态长期 missing |
| 策略计划 | 查看单房间计划 | `cmd.strategy.plan("W1N1")` | room、intent、reason、gate | 无计划且 refresh 原因不可见 |
| 策略解释 | 操作者判断为什么这么做 | `cmd.strategy.explain("W1N1")` | explanation、reason、policy | 输出空白或缺少 gate/理由 |
| stats 巡检 | 判断 CPU/进程健康 | `cmd.debug.stats()` | tick、cpu、process stats | CPU/stats 缺失或 tick 不更新 |
| observability 巡检 | 查看日志/profiler 状态 | `cmd.debug.observability()` | logger/profiler/stats status | observability 未初始化 |
| 有界 Memory 查看 | 只在排查时使用 | `cmd.debug.dump("Memory.runtime", 1000)` | runtime JSON 片段，长度受限 | 输出过长、路径错误、或包含不应暴露的凭据 |

## 故障排查

### Symptom -> checks -> fix: 集成服务器启动失败

- Symptom：`npm run test-integration` 在 bootstrap、mock-server start、engine runner 或 snapshot 阶段失败。
- checks：确认命令走的是项目脚本而不是直接 `mocha`；查看是否进入 Node 22 包装；检查是否有原生依赖 rebuild、`runtime.snapshot.bin`、端口占用或 `engine_runner` crash 信息。
- fix：重新运行 `npm run test-integration` 让 bootstrap 重建依赖和 snapshot；若仍失败，先保留完整错误，再按最近一次通过证据比较，不要切回 Node 16 路径。

### Symptom -> checks -> fix: 官方 sim 缺少对象

- Symptom：`cmd.sim.guidance()` 或 `cmd.colony.detail("W1N1")` 显示 `missing-spawn`、`missing-source`、`missing-controller`。
- checks：确认 sim 房间中是否真的有 spawn/source/controller；查看 `cmd.sim.status()` 的 ready/completed/lastSeenTick；确认 runtime 没有尝试创建 Screeps API 不允许创建的对象。
- fix：按官方 sim UI 或测试环境设置补齐对象；如果对象无法补齐，接受 degraded 状态并用 guidance 判断哪些路径被阻断。

### Symptom -> checks -> fix: spawn queue 不消费

- Symptom：`cmd.spawn.queue()` 或 `cmd.spawn.status()` 中 spawn queue 长期停在 queued/validated/spawning，worker 没有生成。
- checks：运行 `cmd.spawn.status()` 查看 spawn 是否 busy 或缺失；运行 `cmd.spawn.dryRun("W1N1")` 看 body/cost/energy 是否可行；运行 `cmd.colony.detail("W1N1")` 看 missing reasons。
- fix：补齐 spawn 和能量前置条件；若 dry-run 给出明确错误，按错误处理；若条件满足但仍不消费，再把队列状态、spawn 状态和最近 tick 作为 runtime bug 证据。

### Symptom -> checks -> fix: worker 不升级 controller

- Symptom：worker 已存在，但 controller progress 长时间不变。
- checks：检查 `cmd.colony.detail("W1N1")` 是否有 source/controller；查看 worker task 状态是否从 harvest 转向 upgrade；确认 `cmd.debug.stats()` 的 tick 在推进。
- fix：补齐 source/controller/path 可达性和能量条件；如果 task 状态卡住，记录 creep memory、colony detail 和 bounded ticks 作为任务执行问题。

### Symptom -> checks -> fix: stale build output

- Symptom：控制台 `cmd.help()` 缺少新命令，或官方环境行为与本地源码明显不一致。
- checks：确认最近运行过 `npm run build`；确认 `npm run test-integration` 输出包含 `npm run build && mocha test/integration/**/*.ts`；确认上传脚本目标 branch 正确。
- fix：重新运行本地门禁，然后按目标运行 `npm run push-sim`、`npm run push-main` 或 `npm run push-pserver`；不要手工编辑 `dist/main.js`。

### Symptom -> checks -> fix: 命令输出显示 degraded room state

- Symptom：`cmd.colony.status()` 或 `cmd.colony.detail("W1N1")` 显示 degraded、missing reasons、不可用 controller 或没有 primary room。
- checks：逐项核对 `missing-spawn`、`missing-source`、`missing-controller`；确认房间是否 owned/visible；运行 `cmd.env.status()` 排除上传到错误环境。
- fix：修正房间 setup 或上传目标；如果是预期 degraded sim，按 `cmd.sim.guidance()` 执行人工 fallback；如果普通房间仍 degraded，先补齐房间对象和可见性。

## 部署安全

- 不要让运行时代码读取 screeps.json。`screeps.json` 是本地部署凭据文件，必须保持 ignored，不进入 runtime bundle，不进入测试断言，也不进入文档示例的真实值。
- 文档只使用 `screeps.sample.json` 描述配置形状。示例中的 `YOUR_TOKEN`、`username`、`Password` 都是占位符，不要提交真实凭据。
- `npm run push-sim`、`npm run push-main`、`npm run push-pserver`、`npm run push-season` 由 Rollup 部署配置读取本地目标；运行时代码只依赖 Screeps `Game`/`Memory` 和已上传 bundle。
- 排查时可以说明“检查本地部署配置是否存在”，但不要把 token、密码或 `screeps.json` 内容贴到 issue、SUMMARY、测试输出或控制台日志中。
