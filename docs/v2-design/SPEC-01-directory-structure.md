# SPEC-01: 项目目录结构规范

> **状态：** v2.0 权威文档 | **日期：** 2026-05-10
> **关联决策：** D-01、D-02、D-03、D-04、D-05
> **后续规范：** SPEC-03（模块边界规则，含 ESLint 配置）

---

## 1. 总体原则

### 1.1 架构镜像原则（D-01）

`src/` 目录结构完全镜像 HighCommand 架构层级，深度为 4 层：

```
HighCommand（顶级域）
  └── Intel / Garrison（子域）
        └── Facilities / TaskForces（三级域）
              └── 具体模块文件（叶文件）
```

目录树直接反映包含关系，文件系统结构即是架构文档。代价是较长的 import 路径，但这是为了架构清晰度而接受的权衡。

### 1.2 Import 路径管理

`tsconfig.json` 中配置 `baseUrl: "src/"`，使别名形式的 import 优于相对路径：

- **推荐（别名）：** `import type { IGarrison } from "highCommand/garrison"`
- **不推荐（相对）：** `import type { IGarrison } from "../../../garrison/index"`

### 1.3 不采用 Monorepo（D-04）

不引入 workspace 工具链（如 npm workspaces、Turborepo）。使用 ESLint `no-restricted-imports` 规则 + barrel files 实现模块边界隔离，详见 SPEC-03。

---

## 2. src/ 目录结构（规范树）

以下为 v2.0 完整目录树（`...` 表示同类型的其他文件，按同一模式创建）：

```
src/
├── main.ts                                   # Screeps loop 入口，委托给 HighCommand
│
├── shared/                                   # 依赖免区域：全局共享，不得 import 自 src/highCommand/
│   ├── constants/
│   │   ├── index.ts                          # barrel：同时 export 值和类型（因常量是运行时值）
│   │   ├── taskForces.ts                     # TaskForceType as const 对象
│   │   ├── runtime.ts                        # RuntimeEnvironment、ShardName 等
│   │   └── memory.ts                         # Memory 键名常量
│   ├── interfaces/
│   │   ├── index.ts                          # barrel：export type { IGarrison, IFacility, ... }
│   │   ├── IGarrison.ts                      # 跨域接口契约
│   │   ├── IFacility.ts
│   │   ├── ITaskForce.ts
│   │   └── IIntelProvider.ts
│   ├── events/
│   │   ├── index.ts                          # barrel：export type { EventBus, EventTypes }
│   │   └── EventBus.ts                       # tick 内同步事件总线
│   └── types/
│       └── screeps-profiler.d.ts             # ambient 类型声明（从 src/types/ 迁移）
│
├── highCommand/
│   ├── index.ts                              # barrel：export { HighCommand }（例外：允许导出具体类）
│   ├── HighCommand.ts                        # 顶级单例，Build/Refresh 生命周期协调者
│   ├── intel/
│   │   ├── index.ts                          # barrel：export type { IIntelProvider, ThreatLevel }
│   │   └── Intel.ts                          # Intel 模块实现
│   └── garrison/
│       ├── index.ts                          # barrel：export type { IGarrison, GarrisonStage }
│       ├── Garrison.ts                       # Garrison 类：管理单个 owned room
│       ├── types.ts                          # Garrison 域内私有类型（不通过 barrel 导出）
│       ├── facilities/
│       │   ├── Barracks/
│       │   │   ├── index.ts                  # barrel：export type { IBarracks }
│       │   │   └── Barracks.ts               # 兵营设施：Spawn + Extension 管理
│       │   ├── HQ/
│       │   │   ├── index.ts
│       │   │   └── HQ.ts                     # 总部设施：RCL、Storage、Terminal 管理
│       │   ├── Watchtower/
│       │   │   ├── index.ts
│       │   │   └── Watchtower.ts             # 瞭望塔：Tower 和防御管理
│       │   ├── Arsenal/
│       │   │   ├── index.ts
│       │   │   └── Arsenal.ts                # 军火库：Lab 管理
│       │   └── Foundry/
│       │       ├── index.ts
│       │       └── Foundry.ts                # 冶炼厂：Link 和 Factory 管理
│       └── taskForces/
│           ├── MiningTF/
│           │   ├── index.ts                  # barrel：export type { IMiningTF }
│           │   └── MiningTF.ts               # 采矿任务组
│           ├── LogisticsTF/
│           │   ├── index.ts
│           │   └── LogisticsTF.ts            # 物流任务组
│           ├── EngineerTF/
│           │   ├── index.ts
│           │   └── EngineerTF.ts             # 建筑任务组
│           └── ...                           # 其他 TaskForce 按同一模式创建
│
├── environment/                              # 保留 v1.0（D-17）
│   ├── detection.ts                          # 环境检测（sim/world/private/unknown）
│   └── simBootstrap.ts                       # sim 引导和手动放置提示
│
├── logging/                                  # 保留 v1.0（D-19）
│   └── Logger.ts                             # 命名空间日志器
│
├── profiling/                                # 保留 v1.0（D-19）
│   ├── Profiler.ts                           # 轻量 CPU profiler
│   └── ScreepsProfilerAdapter.ts             # 可选深度 profiler 适配器
│
├── memory/                                   # v2.0 重写（D-20）
│   ├── index.ts                              # barrel
│   ├── schema.ts                             # ProjectMemoryShape 类型定义
│   └── migrations.ts                         # 版本迁移函数
│
├── utils/                                    # 保留 v1.0（D-19）
│   └── ErrorMapper.ts                        # source-map 错误边界
│
└── runtime/                                  # 保留骨架（v2.0 委托给 HighCommand）
    └── Kernel.ts                             # Kernel：生命周期驱动（Build/Refresh/Init/Run）
```

---

## 3. 测试目录结构（镜像规则，D-02）

`test/` 目录完全镜像 `src/` 结构。测试文件路径可直接反推出被测模块路径。

```
test/
├── unit/
│   ├── mock.ts                               # 保留现有：Screeps 全局 mock
│   ├── shared/
│   │   ├── eventBus.test.ts                  # EventBus 单元测试
│   │   └── constants.test.ts                 # 常量对象测试
│   └── highCommand/
│       ├── highCommand.test.ts               # HighCommand 单元测试
│       └── garrison/
│           ├── garrison.test.ts              # Garrison 单元测试
│           ├── facilities/
│           │   ├── barracks.test.ts          # Barracks 单元测试
│           │   ├── hq.test.ts
│           │   └── watchtower.test.ts
│           └── taskForces/
│               └── miningTF.test.ts          # MiningTF 单元测试
└── integration/
    ├── helper.ts                             # 保留现有：IntegrationTestHelper
    ├── scenarios.ts                          # v2.0 重建：场景构建器
    ├── assertions.ts                         # v2.0 重建：断言辅助函数
    └── highCommand.test.ts                   # 集成测试：完整 tick 行为
```

**镜像规则说明：**
- 被测文件 `src/highCommand/garrison/facilities/Barracks/Barracks.ts` → 测试文件 `test/unit/highCommand/garrison/facilities/barracks.test.ts`
- 测试文件名使用**类名小写**（`barracks.test.ts`），不含路径中间层的大写
- Mocha glob `test/unit/**/*.test.ts` 自动覆盖所有深度的测试文件

---

## 4. src/shared/ 子结构规范（D-03）

`src/shared/` 是整个项目的**依赖免区域**，所有其他模块可引用它，但它自身不能 import 自 `src/highCommand/` 或任何架构层级模块。

### 4.1 constants/ — 运行时常量

用途：所有稳定字符串集合（`as const` 对象），禁止在业务代码中重复定义字符串字面量（D-13）。

包含：
- `TaskForceType`：任务组类型标识符
- `RuntimeEnvironment`：运行时环境（sim/world/private/unknown）
- `ShardName`：分片名称常量
- `MemoryKey`：顶级 Memory 键名

**例外：** `src/shared/constants/index.ts` 同时 export 值和类型（因为常量是运行时值，不能只用 `export type`）。

### 4.2 interfaces/ — 跨域接口契约

用途：定义所有跨模块依赖反转所使用的接口，是实现低耦合的技术基础（D-08）。

包含：
- `IGarrison`：Garrison 的公共接口（供 Intel 和 HighCommand 使用）
- `IFacility`：所有 Facility 共享的接口（init/run 两阶段）
- `ITaskForce`：所有 TaskForce 共享的接口
- `IIntelProvider`：Intel 模块暴露给 Garrison 的只读查询接口

**规则：** 接口文件只含 `interface` / `type` 声明，不含实现代码。

### 4.3 events/ — EventBus 及事件类型定义

用途：提供 tick 内同步事件总线，用于威胁检测、Creep 死亡等状态变化通知（D-08 Pattern 4）。

包含：
- `EventBus`：同步事件总线（Map-based dispatcher，无 async）
- 事件类型定义（如 `ThreatDetectedEvent`、`CreepDiedEvent`）

### 4.4 types/ — Ambient 类型声明

用途：放置 `.d.ts` 类型声明文件，主要是第三方库的类型补充。

包含：
- `screeps-profiler.d.ts`（从 `src/types/` 迁移）

---

## 5. Barrel File 规则（D-05、D-10）

每个域目录有且仅有**一个** `index.ts` 作为唯一对外导出口。外部模块只能 import 该 barrel，不能绕过它直接引用内部文件（ESLint `no-restricted-imports` 强制执行，见 SPEC-03）。

### 5.1 标准 barrel 模式（接口优先，D-10）

barrel 只使用 `export type`，不做运行时 import，防止循环依赖：

```typescript
// src/highCommand/garrison/index.ts
// 仅导出接口和类型，不导出实现细节（D-10）
export type { IGarrison } from "./Garrison";
export type { GarrisonStage, GarrisonMemory } from "./types";
// 不导出：Garrison 类的实现、内部辅助函数
```

```typescript
// src/highCommand/garrison/facilities/Barracks/index.ts
export type { IBarracks } from "./Barracks";
// 外部看到接口契约，不看到实现类
```

### 5.2 例外情况

**例外 1：** `src/shared/constants/index.ts` 需同时 export 值和类型（因常量是运行时值）：

```typescript
// src/shared/constants/index.ts
export { TaskForceType } from "./taskForces";             // 运行时值
export type { TaskForceType } from "./taskForces";        // 类型（同名，TypeScript 声明合并）
export { RuntimeEnvironment } from "./runtime";
```

**例外 2：** 顶级 `src/highCommand/index.ts` 可导出具体类（作为 `main.ts` 的入口点）：

```typescript
// src/highCommand/index.ts
export { HighCommand } from "./HighCommand";              // 具体类（main.ts 需要实例化）
```

### 5.3 防止 barrel 诱导的循环依赖

常见失败模式：`garrison/index.ts` 导出 Garrison → Garrison 导入某文件 → 该文件又 import 自 `garrison/index.ts`，形成循环。

**预防规则：**
1. barrel 只用 `export type { ... } from "./file"` — 无运行时 side effect
2. `src/shared/` 零 import 自 `src/highCommand/`（foundation 层）
3. `garrison/types.ts` 只 import 自 `src/shared/` — 不引用兄弟 facilities/taskForces
4. Facility 和 TaskForce 的 barrel 只导出自身接口 — 不 import 兄弟 barrel

---

## 6. 文件命名规则（D-14）

| 文件类型 | 命名规则 | 示例 |
|---------|---------|------|
| 类文件 | PascalCase.ts | `Barracks.ts`、`Garrison.ts`、`HighCommand.ts` |
| 模块/配置文件 | camelCase.ts 或 lowercase.ts | `types.ts`、`lifecycle.ts`、`schema.ts` |
| barrel 文件 | index.ts（固定名） | `index.ts` |
| 测试文件 | `[类名小写].test.ts` | `barracks.test.ts`、`garrison.test.ts` |
| ambient 声明 | `*.d.ts` | `screeps-profiler.d.ts` |

**规则说明：**
- 每个 PascalCase 类独占一个文件（`class Barracks` → `Barracks.ts`）
- 同一域内的辅助类型使用小写（`types.ts`），不创建独立目录
- 测试文件名使用被测类名的小写（camelCase → lowercase），加 `.test.ts` 后缀

---

## 7. Import 路径规范（D-14、D-01）

### 7.1 路径风格优先级

| 优先级 | 风格 | 示例 | 适用场景 |
|--------|------|------|---------|
| 1（推荐） | baseUrl 别名 | `"highCommand/garrison"` | 跨目录 import |
| 2（允许） | 相对路径 `./` | `"./helper"` | 同目录内引用 |
| 3（禁止） | 多级相对路径 | `"../../garrison/index"` | 任何场景均禁止 |

**推荐（baseUrl 别名）：**
```typescript
import type { IGarrison } from "highCommand/garrison";
import { RuntimeEnvironment } from "shared/constants";
```

**不推荐（多级相对路径，即 ../../ 地狱）：**
```typescript
import type { IGarrison } from "../../garrison/index";   // 禁止
```

### 7.2 barrel import 优先

优先 import barrel（`index.ts`），只有引用同目录平级文件时使用相对路径 `./`：

```typescript
// 在 Garrison.ts 内部引用同目录的 types.ts：用相对路径
import type { GarrisonStage } from "./types";

// 引用跨域接口：用别名 barrel
import type { IIntelProvider } from "shared/interfaces";
```

### 7.3 `import type` 优先

纯类型导入必须使用 `import type`，不混入运行时 import：

```typescript
import type { IGarrison } from "highCommand/garrison";   // 类型：用 import type
import { RuntimeEnvironment } from "shared/constants";   // 值：用 import
```

---

## 8. 目录归属决策表

针对常见疑问场景的快速参考：

| 代码类型 | 归属目录 | 决策依据 |
|---------|---------|---------|
| Garrison 域内私有类型 | `src/highCommand/garrison/types.ts` | 域内私有，不在 barrel 中导出（D-03） |
| 跨域接口契约（IGarrison、IFacility、ITaskForce） | `src/shared/interfaces/` | 全局共享，防止循环依赖（D-03、D-06） |
| Screeps 运行时常量（TaskForceType、ShardName） | `src/shared/constants/` | 全局共享，禁止重复定义（D-13） |
| ErrorMapper 工具 | `src/utils/` | 保留 v1.0 工具（D-19） |
| HighCommand 单例 | `src/highCommand/HighCommand.ts` | 顶级域文件（D-01） |
| Tick 生命周期驱动 | `src/runtime/Kernel.ts` | 框架骨架（D-19 保留） |
| Memory 版本化 schema | `src/memory/schema.ts` | v2.0 重写（D-20） |
| 环境检测逻辑 | `src/environment/detection.ts` | 保留 v1.0（D-17） |
| 新建的 TaskForce | `src/highCommand/garrison/taskForces/XxxTF/` | 4 层架构镜像（D-01） |
| 新建的 Facility | `src/highCommand/garrison/facilities/Xxx/` | 4 层架构镜像（D-01） |

---

## 9. 关键链接

- **SPEC-02** — 代码风格规范（命名约定、JSDoc、常量模式、导入顺序）
- **SPEC-03** — 模块边界规则（ESLint `no-restricted-imports` + `import/no-cycle` 配置）
- **SPEC-04** — 接口契约规范（5 种通信模式，含 `src/shared/interfaces/` 使用方式）
- `tsconfig.json` — `baseUrl: "src/"` 配置，影响所有别名 import 路径
