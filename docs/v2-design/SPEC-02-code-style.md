# SPEC-02: TypeScript 代码风格规范

> **状态：** v2.0 权威文档 | **日期：** 2026-05-10
> **关联决策：** D-11、D-12、D-13、D-14
> **配套规范：** SPEC-01（目录结构）、SPEC-03（模块边界 ESLint 规则）

---

## 1. 格式化工具配置（D-14）

### 1.1 Prettier 配置（`.prettierrc`，v1.0 验证通过，v2.0 继续使用）

| 配置项 | 值 | 含义 |
|-------|---|------|
| `printWidth` | `120` | 每行最多 120 字符 |
| `tabWidth` | `2` | 2 空格缩进 |
| `singleQuote` | `false` | 使用双引号 |
| `trailingComma` | `none` | 无尾逗号 |
| `semi` | `true` | 语句末尾加分号 |
| `arrowParens` | `avoid` | 单参数箭头函数省略括号 |
| `endOfLine` | `auto` | 行尾符跟随平台 |

**强制执行：** 不允许手动覆盖这些格式化规则。CI 检查命令：`npm run prettier`。代码提交前必须通过 Prettier 检查。

### 1.2 工具链版本（不允许升级，除非明确决策）

| 工具 | 版本 | 配置文件 |
|-----|------|---------|
| TypeScript | `^4.8.4` | `tsconfig.json` |
| ESLint | `^8.24.0` | `.eslintrc.js` |
| Prettier | `^2.7.1` | `.prettierrc` |
| Mocha | `^5.2.0` | `test/mocha.opts` |

版本升级需要明确的团队决策并更新工具链，禁止在开发工作中顺带升级。

---

## 2. 命名约定（D-14）

所有命名必须精确遵守以下规则，ESLint 规则 `camelcase: error` 和 `@typescript-eslint/consistent-type-definitions: error` 已启用进行部分强制。

| 元素 | 命名规则 | 示例 |
|-----|---------|------|
| 类（Class） | PascalCase | `class Barracks`、`class Garrison` |
| 接口（Interface） | 大写 I 前缀 + PascalCase（v2.0 新规范） | `interface IGarrison`、`interface IFacility` |
| 类型别名（Type Alias） | PascalCase | `type GarrisonStage`、`type SpawnRequest` |
| 枚举（Enum） | PascalCase | `enum ThreatLevel`、`enum MemoryVersion` |
| 函数/方法 | camelCase | `enqueueSpawn()`、`getThreatLevel()` |
| 变量/参数 | camelCase | `spawnQueue`、`roomName`、`garrison` |
| 常量对象（as const） | PascalCase | `TaskForceType`、`RuntimeEnvironment` |
| 标量常量 | SCREAMING_SNAKE_CASE | `MAX_SPAWN_QUEUE_SIZE`、`DEFAULT_TIMEOUT` |
| 类文件 | PascalCase.ts | `Barracks.ts`、`Garrison.ts`、`HighCommand.ts` |
| 模块文件 | camelCase.ts 或 lowercase.ts | `types.ts`、`lifecycle.ts`、`schema.ts` |
| 测试文件 | `[类名小写].test.ts` | `barracks.test.ts`、`garrison.test.ts` |

**v2.0 新增规范：接口 I 前缀（I-prefix）**

v1.0 未一致使用 I 前缀。v2.0 标准化：所有域接口（IGarrison、IFacility、ITaskForce、IIntelProvider 等）必须以大写字母 `I` 开头，以便从 import 语句中直接辨别接口契约与具体实现类。

```typescript
// 正确
interface IGarrison { ... }
class Garrison implements IGarrison { ... }

// 错误（v1.0 旧风格，v2.0 禁止）
interface Garrison { ... }
```

---

## 3. 注释规范（D-11、D-12）

### 3.1 JSDoc 覆盖要求（D-11）

**规则：** 所有从 barrel 文件（`index.ts`）导出的函数、类、接口必须有 JSDoc 注释，注释语言为**中文**。

**JSDoc 模板示例：**

```typescript
/**
 * 兵营设施，负责管理 Spawn 和 Extension 群。
 * 在 Init 阶段收集所有 TaskForce 的孵化请求，在 Run 阶段按优先级统一执行。
 */
export class Barracks implements IFacility {
  /**
   * 将孵化请求加入队列（仅在 Init 阶段调用）。
   * @param request - 孵化请求，包含优先级和 CreepSetup
   */
  public enqueue(request: SpawnRequest): void { ... }

  /**
   * 按优先级执行孵化队列中的所有请求（仅在 Run 阶段调用）。
   */
  public run(): void { ... }
}
```

**接口示例：**

```typescript
/**
 * Garrison 的公共接口契约，供 HighCommand 和 Intel 模块依赖反转使用。
 * 外部只能通过此接口访问 Garrison，不能依赖实现类。
 */
export interface IGarrison {
  /** 当前 Garrison 管辖的房间名 */
  readonly roomName: string;

  /**
   * 查询当前 Garrison 的阶段状态。
   * @returns 当前阶段枚举值
   */
  getStage(): GarrisonStage;
}
```

### 3.2 行内注释要求（D-12）

**规则：** 复杂逻辑块、较长函数（超过 15 行）内部须有行内中文注释，解释**意图（why）**而非代码本身（what）。

```typescript
public run(): void {
  // 按优先级降序排序，确保高优先级 TaskForce 的 Spawn 请求先执行
  this.spawnQueue.sort((a, b) => b.priority - a.priority);

  for (const request of this.spawnQueue) {
    // 找到第一个可用的 Spawn（不在冷却中，能量足够）
    const availableSpawn = this.findAvailableSpawn(request.body);
    if (!availableSpawn) {
      // 本 tick 无可用 Spawn，剩余请求将在下 tick 重新声明（声明式范式）
      break;
    }
    availableSpawn.spawnCreep(request.body, request.name);
  }
}
```

### 3.3 注释豁免情形

以下情形**不需要** JSDoc：
- 私有方法（`private` 修饰的方法）
- 内部辅助函数（不从 barrel 导出的函数）
- 测试文件的 `describe` / `it` 块

以下情形**允许使用英文注释**：
- 引用 Screeps API 文档原文时（保留原文术语）
- 其余一律使用中文

---

## 4. 字符串常量规范（D-13）

### 4.1 核心规则

**禁止在业务代码中使用字符串字面量。** 所有稳定字符串集合使用 `as const` 对象或 `enum`，集中在 `src/shared/constants/`。

### 4.2 as const 对象模式（推荐）

```typescript
// src/shared/constants/taskForces.ts

/**
 * 任务组类型标识符，所有任务组类型使用此常量，禁止散落的字符串字面量。
 */
export const TaskForceType = {
  Mining: "mining",
  Logistics: "logistics",
  Engineer: "engineer",
} as const;

/**
 * 从常量对象派生联合类型，避免字符串重复定义（TypeScript 声明合并）。
 */
export type TaskForceType = typeof TaskForceType[keyof typeof TaskForceType];
```

**使用方式：**

```typescript
// 正确：使用常量引用
import { TaskForceType } from "shared/constants";
const type: TaskForceType = TaskForceType.Mining;

// 错误：直接使用字符串字面量
const type = "mining";  // 禁止
```

### 4.3 允许直接使用字符串字面量的情形

以下情形**允许**使用字符串字面量（不需要提取为常量）：
- 日志消息：`console.log("初始化 Garrison 完成")`
- 错误描述：`throw new Error("Garrison 未找到 owned room")`
- 测试断言的说明文字：`assert.isTrue(result.ok, "spawn 请求应当成功入队")`

---

## 5. 类成员可访问性（D-14）

### 5.1 强制规则

**ESLint 规则 `@typescript-eslint/explicit-member-accessibility: error` 已启用，所有类成员须显式标注 `public` / `private` / `protected`。**

禁止省略可访问性修饰符（即禁止「隐式 public」）。

### 5.2 完整示例

```typescript
export class Garrison implements IGarrison {
  /** 当前管辖的房间名，构建后不变 */
  public readonly roomName: string;

  /** Garrison 当前阶段，由 refresh() 每 tick 更新 */
  private _stage: GarrisonStage;

  /** Barracks 设施引用，构造时注入 */
  private readonly barracks: IBarracks;

  /**
   * 构造 Garrison，仅在 Build 阶段调用。
   * @param roomName - 所管辖的房间名
   * @param barracks - 兵营设施引用（构造时注入）
   */
  public constructor(roomName: string, barracks: IBarracks) {
    this.roomName = roomName;
    this.barracks = barracks;
    this._stage = GarrisonStage.Bootstrap;
  }

  public getStage(): GarrisonStage {
    return this._stage;
  }

  /** 刷新 Garrison 状态（每 tick Refresh 阶段调用）。 */
  public refresh(): void {
    // 更新阶段判断...
  }

  private determineStage(): GarrisonStage {
    // 私有辅助方法
    return GarrisonStage.Bootstrap;
  }
}
```

### 5.3 readonly 规则

不会在构造后被重新赋值的字段**必须**标注 `readonly`：

```typescript
public readonly roomName: string;    // 构造后不变 → readonly
private readonly barracks: IBarracks; // 构造时注入，不替换 → readonly
private _stage: GarrisonStage;       // 每 tick 更新 → 不加 readonly
```

### 5.4 max-classes-per-file 规则

ESLint 规则 `max-classes-per-file: error, 1` 已启用。每个 `.ts` 文件只能包含一个类声明。

---

## 6. 导入顺序规范（D-14）

### 6.1 三层导入顺序

ESLint 规则 `sort-imports: warn` + 手动规范（v2.0 执行，SPEC-03 可配置自动检查）：

1. **外部包和 Node.js 内建模块**（生产代码中通常无此层，测试文件中可能有）
2. **src/ 别名路径**（tsconfig `baseUrl: "src/"` 解析的路径，如 `"highCommand/garrison"`）
3. **相对路径**（同目录内的 `./` 引用）

### 6.2 完整示例

```typescript
// 1. 外部包（仅测试文件中可能出现）
import { assert } from "chai";

// 2. src/ 别名路径（优先使用，避免 ../../ 地狱）
import type { IGarrison } from "highCommand/garrison";
import type { IIntelProvider } from "shared/interfaces";
import { RuntimeEnvironment } from "shared/constants";

// 3. 相对路径（同一域目录内）
import type { GarrisonStage } from "./types";
import { localHelper } from "./helper";
```

### 6.3 `import type` 优先规则

纯类型导入**必须**使用 `import type`，运行时值使用普通 `import`，不混用：

```typescript
import type { IGarrison } from "highCommand/garrison";       // 类型 → import type
import type { GarrisonStage } from "./types";                // 类型 → import type
import { RuntimeEnvironment } from "shared/constants";       // 运行时值 → import
```

---

## 7. 错误处理规范（延续 v1.0）

### 7.1 结构化返回值（可预期业务错误）

使用结构化返回值代替 `throw`，用于可预期的业务错误：

```typescript
// 推荐：结构化返回值
interface SpawnResult {
  ok: boolean;
  error?: string;
}

public trySpawn(request: SpawnRequest): SpawnResult {
  if (!this.hasEnoughEnergy(request.body)) {
    return { ok: false, error: "能量不足，无法执行孵化" };
  }
  // 执行孵化...
  return { ok: true };
}
```

### 7.2 throw 保留用途

`throw` 保留用于**不可恢复的编程错误**：

- null 解引用（违反非空前提）
- 不变量违反（状态机进入不可能的状态）
- 编程接口误用（在错误阶段调用了仅允许在特定阶段调用的方法）

```typescript
public enqueue(request: SpawnRequest): void {
  if (this.phase !== Phase.Init) {
    // 编程错误：enqueue 只能在 Init 阶段调用
    throw new Error(`Barracks.enqueue() 只能在 Init 阶段调用，当前阶段：${this.phase}`);
  }
  this.spawnQueue.push(request);
}
```

### 7.3 顶层错误边界

`ErrorMapper.wrapLoop` 作为顶层错误边界，在 `main.ts` 已配置，不在业务代码中重复包裹。

---

## 8. ESLint 规则速查

以下为已启用的关键 ESLint 规则（来自 `.eslintrc.js`，v2.0 继承 v1.0 完整配置）：

| 规则 | 级别 | 说明 |
|------|------|------|
| `@typescript-eslint/explicit-member-accessibility` | `error` | 所有类成员必须有显式访问修饰符 |
| `@typescript-eslint/consistent-type-definitions` | `error` | 统一使用 `interface` 或 `type`（配置为 `interface`） |
| `@typescript-eslint/consistent-type-assertions` | `error` | 类型断言必须使用 `as` 语法 |
| `@typescript-eslint/array-type` | `error` | 数组类型使用 `T[]` 而非 `Array<T>` |
| `@typescript-eslint/no-shadow` | `error` | 禁止变量遮蔽（shadow） |
| `@typescript-eslint/prefer-for-of` | `error` | 优先使用 `for...of` 而非索引遍历 |
| `@typescript-eslint/unified-signatures` | `error` | 合并可统一的函数重载签名 |
| `max-classes-per-file` | `error, 1` | 每文件只允许一个类 |
| `camelcase` | `error` | 标识符必须使用 camelCase |
| `eqeqeq` | `error, "smart"` | 必须使用严格相等 `===` |
| `no-var` | `error` | 禁止使用 `var`，使用 `const` / `let` |
| `no-bitwise` | `error` | 禁止位运算符 |
| `sort-imports` | `warn` | 导入顺序警告（手动维护 3 层顺序） |
| `no-underscore-dangle` | `warn` | 私有字段命名警告（前缀 `_` 触发） |

**v2.0 新增规则**（在 SPEC-03 中配置到 `.eslintrc.js`）：
- `import/no-cycle`：循环依赖检测（D-07）
- `no-restricted-imports`：barrel-only import 强制（D-05）

---

## 附录：D-11 ~ D-14 决策追溯

| 决策 | 对应章节 |
|------|---------|
| D-11：所有导出符号必须有中文 JSDoc 注释 | §3.1 JSDoc 覆盖要求 |
| D-12：复杂逻辑内部须有中文行内注释 | §3.2 行内注释要求 |
| D-13：禁止字符串硬编码，集中在 shared/constants/ | §4 字符串常量规范 |
| D-14：Prettier 2空格/120列/双引号/无尾逗号、PascalCase、camelCase、ESLint 类型检查 | §1 格式化工具配置、§2 命名约定、§5 类成员可访问性、§6 导入顺序 |
