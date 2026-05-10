# SPEC-05: 测试策略

**决策来源：** D-15、D-16、D-17（08-CONTEXT.md）
**适用范围：** v2.0 HighCommand 架构的全部测试分层策略

---

## 1. 三层测试策略（D-15）

| 层级 | 工具 | 测试范围 | 运行时机 | 命令 |
|------|------|---------|---------|------|
| 单元测试 | Mocha + Chai + mock.ts | 纯逻辑、状态机、算法、声明式池排序、工具函数 | 每次提交（`npm test`） | `npm test` |
| 集成测试 | screeps-server-mockup@1.5.1 | 完整 tick 执行、Memory 持久化、spawn 执行、多 tick 断言 | 功能完成后（`npm run test-integration`） | `npm run test-integration` |
| 私服可视化测试 | Screeps 客户端 + 本地私服 | 行为观察、调试、手动放置设施确认 | 开发过程中按需 | 手动 |

---

## 2. 单元测试规范

### 框架与工具

- **框架：** Mocha + Chai + Sinon
- **Mock 工具：** `test/unit/mock.ts` 提供 `createMockGame`、`createMockMemory`

### 覆盖目标

- 声明式池排序算法（Barracks.enqueue 的优先级排序）
- 状态机转换（GarrisonStage 转换条件）
- 算法逻辑（spawn body 生成、路径权重计算等）
- EventBus 事件分发（注册 → emit → handler 调用链）
- 工具函数（shared/constants 导出值的正确性）

### 不适合单元测试的场景

- 涉及 `Game.*` 对象的行为（须通过集成测试验证）
- 多 tick 内存持久化（须通过集成测试验证）
- spawn 执行（须通过集成测试验证）

### 测试文件结构示例

```typescript
describe("domain|subject", () => {
  beforeEach(() => {
    global.Game = createMockGame();
    global.Memory = createMockMemory();
  });
  it("describes expected behavior in plain language", () => {
    // arrange → act → assert
  });
});
```

---

## 3. 集成测试规范

### 框架与工具

- **框架：** screeps-server-mockup@1.5.1（已在 devDependencies 中）
- **工作原理：** `IntegrationTestHelper` 管理 ScreepsServer 生命周期（start/tick/close）
- **Node 22 兼容性：** `tick()` 内部调用 `driver.makeRuntime()` 绕过不稳定的 engine_runner（已在 `test/integration/helper.ts` 实现）

### 集成测试文件结构（`test/integration/`）

- `helper.ts` — 保留现有，管理服务器生命周期。提供 `IntegrationTestHelper` 类和 `IntegrationScenario` 接口
- `scenarios.ts` — 定义 `IntegrationScenario` 对象，描述测试前置状态（v2.0 新建）
- `assertions.ts` — 导出断言辅助函数，检查 Memory 状态（v2.0 新建）
- `highCommand.test.ts` — v2.0 主集成测试，组合 scenarios + assertions 使用（v2.0 新建）

### `IntegrationTestHelper` 关键接口（来自 `helper.ts`）

```typescript
export interface IntegrationScenario {
  name: string;
  roomName: string;
  shardName?: string;
  setup(helper: IntegrationTestHelper): Promise<void>;
}

export class IntegrationTestHelper {
  public async start(): Promise<void>;
  public async close(): Promise<void>;
  public async tick(count?: number): Promise<void>;
  public async tickUntil(
    predicate: () => Promise<boolean> | boolean,
    maxTicks: number,
    label: string
  ): Promise<void>;
  public async readMemory(): Promise<ProjectMemoryShape>;
  public async runCommand(command: string): Promise<string>;
  public async setupOwnedRoom(roomName: string, options?: object): Promise<void>;
}
```

### 集成测试用例模式

```typescript
it("ticks until HighCommand initializes Garrison", async function () {
  this.timeout(60000);
  const helper = new IntegrationTestHelper();
  await helper.start();
  try {
    await helper.tickUntil(
      async () => {
        const memory = await helper.readMemory();
        return memory.highCommand?.garrisons?.["W0N1"] !== undefined;
      },
      50,
      "garrison initialized"
    );
    const memory = await helper.readMemory();
    assert.isDefined(memory.highCommand.garrisons["W0N1"]);
  } finally {
    await helper.close();
  }
});
```

---

## 4. Sim 环境保留策略（D-16、D-17）

### Sim 的定位（D-16）

- Sim 保留为**轻量快速验证手段**（快速迭代、手动放置设施观察）
- 不作为主要测试环境，原因：
  - 无 CPU 计量（无法验证性能限制）
  - global reset 不稳定（难以可重复断言）
  - Memory 断言不可靠
- Sim 不在 CI 管道中运行

### 保留文件（D-17）

- `src/environment/simBootstrap.ts` — sim 引导和手动放置提示
- `src/environment/detection.ts` — 环境检测（sim/world/private）

**保留原因：** sim 仍用于快速迭代和手动放置设施测试，是开发过程中的辅助验证手段。

---

## 5. 测试文件目录结构（D-02）

测试目录完全镜像 `src/` 结构（每个源文件对应同路径的 `.test.ts` 文件）：

```
test/
├── unit/
│   ├── mock.ts                                        ← 保留现有
│   ├── highCommand/
│   │   ├── highCommand.test.ts
│   │   └── garrison/
│   │       ├── garrison.test.ts
│   │       └── facilities/
│   │           └── barracks.test.ts
│   └── shared/
│       └── eventBus.test.ts
└── integration/
    ├── helper.ts                                      ← 保留现有
    ├── scenarios.ts                                   ← v2.0 新建
    ├── assertions.ts                                  ← v2.0 新建
    └── highCommand.test.ts                            ← v2.0 新建
```

**规则：** 每个 `src/` 源文件对应 `test/unit/` 中的同路径 `.test.ts` 文件。

---

## 6. 私服可视化测试（D-15 第三层）

### 适用场景

- 调试复杂的多 tick 行为（路径规划、spawn 序列）
- 观察建筑规划的视觉结果（BasePlanner、BarrierPlanner）
- 确认 Screeps 视觉效果和客户端行为
- 验证 Garrison 状态机在实际游戏环境下的表现

### 私服搭建方式

**方式 A：screeps-server-mockup 本地私服模式**

`screeps-server-mockup` 可作为持久化本地私服使用，通过 Screeps 客户端连接到 localhost：

```bash
# 启动 screeps-server-mockup 私服
node -e "const { ScreepsServer } = require('screeps-server-mockup'); const server = new ScreepsServer(); server.start().then(() => console.log('Server started'));"
```

**方式 B：官方 Screeps Private Server（screeps-launcher）**

```bash
# 使用 screeps-launcher 启动官方私服
npx screeps-launcher
```

### 连接步骤

1. 启动私服（方式 A 或 B）
2. 打开 Screeps 客户端
3. 在 Steam 版选择「Connect to custom server」→ 填写 `localhost`
4. 观察游戏循环行为

### 私服测试说明

- 私服测试不纳入 CI，仅作为开发过程中的行为确认工具
- 私服测试结果不作为发布判断依据，集成测试（screeps-server-mockup）才是自动化验收标准
