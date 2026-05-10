# SPEC-04: 接口契约规范

**版本:** v2.0
**状态:** 生效
**依赖:** SPEC-03（模块边界规则）

---

## 1. 总体原则（D-10）

**接口优先，隐藏实现：**
- 每个域的 barrel (`index.ts`) 只导出接口和类型，**不导出内部实现类**。
- 外部模块只能看到接口契约，不能依赖实现细节。
- 接口定义位置：
  - **跨域接口**（供多个 Garrison 或 Facility 类型使用）→ `src/shared/interfaces/`（通过 barrel re-export）
  - **域私有接口**（只在本域内使用）→ 域内 `types.ts`（如 `src/highCommand/garrison/types.ts`）

---

## 2. 五种通信模式（D-08）

### 模式 1：声明式池（Declarative Pool）

**适用场景：** Spawn 请求、logistics 请求、resource 请求（需要跨多方公平分配的资源）

**机制：** 每个 TaskForce 在 Init 阶段调用 `barracks.enqueue(request)` 声明需求；Barracks 在 Run 阶段按优先级统一执行所有请求。声明式池每 tick 重建，无跨 tick 持久化。

**TypeScript 代码示例：**

```typescript
// src/shared/interfaces/ISpawnRequest.ts
/** Spawn 请求接口：TaskForce 向 Barracks 声明孵化需求 */
export interface ISpawnRequest {
  /** 优先级，数值越高越先执行 */
  priority: number;
  /** 请求方 TaskForce 的标识符 */
  taskForce: string;
  /** 目标 body 配置和角色 */
  setup: ICreepSetup;
}

// src/highCommand/garrison/facilities/Barracks/Barracks.ts
export class Barracks implements IFacility {
  /** 当前 tick 的孵化请求队列，每 tick 重建 */
  private spawnQueue: ISpawnRequest[] = [];

  /** 将孵化请求加入队列（Init 阶段调用）*/
  public enqueue(request: ISpawnRequest): void {
    this.spawnQueue.push(request);
  }

  /** 按优先级执行所有孵化请求（Run 阶段调用）*/
  public run(): void {
    // 按优先级从高到低排序
    this.spawnQueue.sort((a, b) => b.priority - a.priority);
    for (const request of this.spawnQueue) {
      // 找到可用的 spawn 执行孵化
      this.trySpawn(request);
    }
  }
}
```

**备注：** 每 tick 开始时须调用 `init()` 清空队列，保证声明式语义。

---

### 模式 2：共享接口 + 依赖反转（Shared Interface + Dependency Inversion）

**适用场景：** 跨模块只读查询（Garrison 查询威胁等级、TaskForce 查询资源状态）

**机制：** 在 `src/shared/interfaces/` 定义查询接口；实现类实现该接口；使用方在构造时接收接口类型的参数（而非具体实现类），从而实现依赖反转。

**TypeScript 代码示例：**

```typescript
// src/shared/interfaces/IIntelProvider.ts
/** 情报查询接口：提供只读的威胁信息 */
export interface IIntelProvider {
  /** 获取指定房间的威胁等级（0 = 安全，5 = 极度危险）*/
  getThreatLevel(roomName: string): number;
  /** 获取指定房间的敌对单位数量 */
  getHostileCount(roomName: string): number;
}

// src/highCommand/garrison/Garrison.ts
import type { IIntelProvider } from "shared/interfaces";

/** 守备队：管理单个房间的所有 Facility 和 TaskForce */
export class Garrison implements IGarrison {
  public constructor(
    private readonly roomName: string,
    private readonly intelProvider: IIntelProvider // 接收接口，不依赖 Intel 实现类
  ) {}

  public run(): void {
    // 通过接口查询威胁等级，无需知道 Intel 的实现细节
    const threatLevel = this.intelProvider.getThreatLevel(this.roomName);
    if (threatLevel > 3) {
      this.activateDefense();
    }
  }
}
```

**备注：** 这种模式使 Garrison 可以在单元测试中接收 mock 的 `IIntelProvider`，无需启动完整的 Intel 模块。

---

### 模式 3：构造时注入引用（Constructor Injection）

**适用场景：** 稳定的父子关系（Facility 持有 Garrison 引用、TaskForce 持有 Garrison 引用）

**机制：** 父模块在 Build 阶段创建子模块时，将自身引用（或其接口）作为构造参数传入。引用存储为 `readonly` 字段，跨 tick 持久存在，不需要每 tick 重新获取。

**TypeScript 代码示例：**

```typescript
// src/highCommand/garrison/facilities/Barracks/Barracks.ts
import type { IGarrison } from "highCommand/garrison";

/** 兵营设施：负责管理 Spawn 和 Extension，执行孵化请求 */
export class Barracks implements IFacility {
  /**
   * 构造时接收 Garrison 引用（Build 阶段注入，跨 tick 持久）
   * @param garrison - 所属 Garrison 的接口引用
   */
  public constructor(private readonly garrison: IGarrison) {}

  public run(): void {
    // 通过注入的引用读取父级状态，不需要全局扫描
    const energyAvailable = this.garrison.getAvailableEnergy();
    // ...
  }
}
```

**备注：** 构造时注入只适用于父子关系稳定的场景。如果引用关系动态变化，应改用声明式池或事件通知。

---

### 模式 4：事件通知（Event Bus）

**适用场景：** 状态变化通知（威胁检测触发防御响应、creep 死亡触发补充请求）

**机制：** `EventBus` 是一个纯同步的 Map-based 分发器，由 HighCommand 单例持有。事件处理器在 Build 阶段注册（跨 tick 持久），在 Run 阶段同步分发（`emit`）。

**TypeScript 代码示例：**

```typescript
// src/shared/events/EventBus.ts
export type EventHandler<T> = (payload: T) => void;

/**
 * Tick 作用域同步事件总线。
 * 事件处理器在 Build 阶段注册，在 Run 阶段同步调用，无 async/Promise/setTimeout。
 * HighCommand 单例持有此总线并注入到需要的模块。
 */
export class EventBus {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  /**
   * 注册事件处理器（Build 阶段调用，跨 tick 持久化）。
   * @param event - 事件名称
   * @param handler - 同步处理函数
   */
  public on<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(event, list);
  }

  /**
   * 同步分发事件（Run 阶段调用）。
   * @param event - 事件名称
   * @param payload - 事件载荷
   */
  public emit<T>(event: string, payload: T): void {
    const list = this.handlers.get(event) ?? [];
    for (const handler of list) {
      handler(payload);
    }
  }
}

// Intel 模块在 Run 阶段检测到威胁时发出事件：
eventBus.emit("threatDetected", { roomName: "W1N1", level: 4 });

// Defense 模块在 Build 阶段注册处理器（跨 tick 持久）：
eventBus.on("threatDetected", ({ roomName, level }) => {
  if (level >= 3) defense.activateSafeMode(roomName);
});
```

**重要约束：**
- 纯同步，无 `async`/`Promise`/`setTimeout`
- 处理器必须在 Build 阶段注册，不能在 Run 阶段注册（见禁止模式 5）
- 避免循环事件（事件 A 触发的处理器中不能再 emit 事件 A）

---

### 模式 5：shared/ 只读接口（Shared Read-Only Config）

**适用场景：** 全局配置读取、策略参数读取（不同 RCL 下的参数、DEFCON 阈值）

**机制：** `src/shared/constants/` 存放 `as const` 配置对象，`src/shared/interfaces/` 存放纯接口定义。所有模块可以 import 这些内容，没有运行时副作用。

**TypeScript 代码示例：**

```typescript
// src/shared/constants/strategy.ts
/** 战略配置：DEFCON 等级阈值和资源预算 */
export const DEFCON = {
  peaceful: 0,
  elevated: 1,
  guarded: 2,
  high: 3,
  severe: 4,
  maximum: 5
} as const;

export type DefconLevel = typeof DEFCON[keyof typeof DEFCON];

// 任意模块可以直接 import：
import { DEFCON } from "shared/constants/strategy";
if (threatLevel >= DEFCON.high) { /* 高威胁响应 */ }
```

**备注：** `src/shared/` 是依赖链最底层，它不能 import 任何 `src/highCommand/` 内容。

---

## 3. 通信模式选择指南

| 场景 | 推荐模式 |
|-----|---------|
| 多方竞争同一资源（spawn、energy、lab time） | 声明式池（模式 1） |
| 跨层读取状态（查询威胁等级、资源余量） | 共享接口 + 依赖反转（模式 2） |
| 父子关系（Facility 需要读 Garrison 状态） | 构造时注入（模式 3） |
| 一对多异步通知（威胁→多个响应模块） | 事件通知（模式 4） |
| 读取全局策略配置或常量 | shared/ 只读接口（模式 5） |

---

## 4. 禁止通信模式（D-09）

以下通信模式明确禁止，违反时须重构为上述 5 种合规模式之一：

```typescript
// 禁止 1：同层模块直接调用对方 run() 方法
// 在 Barracks.run() 内：
this.garrison.hq.run(); // ❌ 禁止直接调用 HQ 的 run（同层直接耦合）
// 修正：通过 EventBus 发出事件，让 HQ 在自己的 run 中响应

// 禁止 2：跨层写入对方状态
// 在 Barracks 内：
this.garrison.energyBudget = 500; // ❌ 禁止子模块写父模块状态
// 修正：通过声明式池向 Garrison 提交资源请求，由 Garrison 统一决策

// 禁止 3：绕过声明式池直接 spawn
// 在 MiningTF 内：
mySpawn.spawnCreep(body, name, {}); // ❌ 必须通过 Barracks.enqueue() 声明请求
// 修正：在 init() 阶段调用 barracks.enqueue({ priority, setup, taskForce: "miningTF" })

// 禁止 4：跨域 import 实现类（只能 import 接口）
import { Garrison } from "highCommand/garrison/Garrison"; // ❌ 导入实现类，违反封装
import type { IGarrison } from "highCommand/garrison";     // ✅ 导入接口（barrel 导出）

// 禁止 5：在 Run 阶段注册事件处理器（应在 Build 阶段注册）
// 在 garrison.run() 内：
garrison.run() {
  eventBus.on("threatDetected", this.handleThreat); // ❌ Run 阶段注册会导致重复注册，处理器越积越多
}
// 修正：在构造函数或 build() 方法中注册一次，永久持有
```

---

## 5. 接口命名与位置规则

| 接口类型 | 位置 | 命名规则 | 示例 |
|---------|------|---------|------|
| 跨域接口（多个域共用） | `src/shared/interfaces/I{Name}.ts` | I 前缀 + PascalCase | `IIntelProvider.ts` |
| 域私有接口（仅本域内使用） | 域内 `types.ts` | I 前缀 + PascalCase | `types.ts` 中的 `IGarrisonState` |
| 跨域接口 barrel | `src/shared/interfaces/index.ts` | re-export all | `export type { IIntelProvider } from "./IIntelProvider"` |

**规则：**
- 接口文件名：`I{Name}.ts`（PascalCase，I 前缀）
- 接口内不包含实现方法，只包含类型声明
- 所有导出接口必须有中文 JSDoc（D-11）

---

## 6. 公共 API 设计原则（D-10）

**最小化公共 API 面：**
- barrel 只导出外部确实需要的接口，减少 API surface
- 内部辅助类型使用 `private type` 或不在 barrel 中导出

**接口依赖原则：**
- 方法参数使用接口类型，不使用具体类类型（提高可测试性）
- 构造函数参数优先使用接口（如 `IGarrison` 而非 `Garrison`）

**JSDoc 要求（D-11）：**
- 所有导出接口必须有中文 JSDoc 说明用途
- 所有接口方法必须有中文 JSDoc 说明参数和返回值

```typescript
// src/shared/interfaces/IFacility.ts
/**
 * 设施接口：定义所有 Facility 实现类必须满足的最小 API 契约。
 * Facility 由 Garrison 在 Build 阶段创建，在 Run 阶段执行。
 */
export interface IFacility {
  /**
   * 声明阶段（Init）：向共享池提交资源需求。
   * 必须在 run() 之前调用，每 tick 调用一次。
   */
  init(): void;

  /**
   * 执行阶段（Run）：消费资源，执行设施行为。
   * 在所有 init() 完成后统一调用。
   */
  run(): void;
}
```

---

## 7. 关联规范

- **SPEC-03**：模块边界规则，定义禁止的 import 模式（与禁止通信模式 4 直接关联）
- **SPEC-01**：目录结构，定义 `src/shared/interfaces/` 位置
- **SPEC-02**：代码风格，定义 I 前缀命名约定和中文 JSDoc 要求

---

*文档创建：2026-05-10 | Phase 08-development-standards*
