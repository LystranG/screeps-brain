# SPEC-03: 模块边界规则与依赖方向

**版本:** v2.0
**状态:** 生效
**依赖:** SPEC-01（目录结构）

---

## 1. 高内聚低耦合策略

v2.0 HighCommand 架构将代码组织为有明确边界的模块，每个模块负责单一关注点。明确的模块边界带来以下好处：

- **防止 spaghetti imports**：任意模块互相引用会导致代码变成意大利面条，修改一处影响全局。明确的导入规则让变更范围可预测。
- **控制变更传播范围**：当一个 Facility 内部重构时，只要保持接口不变，调用方无需修改。
- **使模块可独立测试**：模块只依赖接口（而非实现），测试时可以注入 mock 实现。

**核心原则：**
- 模块的内部实现细节对外不可见——外部只能看到 barrel (`index.ts`) 导出的内容。
- 模块间通信只通过定义好的契约（接口）进行，不允许直接引用对方的实现类。

---

## 2. 依赖方向规则（D-06）

以下 ASCII 图展示允许的依赖方向（箭头表示"可以引用"）：

```
src/main.ts
    ↓
src/highCommand/          ← 可引用 garrison、intel、shared；不能被下层引用
    ↓
src/highCommand/garrison/ ← 可引用 facilities、taskForces、shared；不能引用 highCommand 顶层
    ↓
src/highCommand/garrison/facilities/  ← 可引用 shared；不能引用 garrison、sibling facilities
src/highCommand/garrison/taskForces/  ← 可引用 shared；不能引用 garrison、sibling taskForces
    ↓
src/shared/               ← 基础层，不引用任何上层模块
```

### 依赖方向规则表

| 关系 | 允许/禁止 | 示例 |
|-----|---------|------|
| 上层引用下层 | 允许 | Garrison 引用 Barracks |
| 下层引用上层 | 禁止 | Barracks 引用 Garrison 类 |
| 同层直接引用 | 禁止 | Barracks 直接引用 HQ |
| 同层通过 shared 通信 | 允许 | Barracks 和 HQ 共享 IResourcePool 接口 |
| 任意层引用 shared | 允许 | Garrison 引用 shared/constants |
| shared 引用上层 | 禁止 | shared 引用 highCommand（永远禁止）|

---

## 3. Barrel File 规则（D-05）

每个域目录有且仅有一个 `index.ts` 作为唯一导出口（barrel file）。

**规则：**
- 外部代码只能 `import from "highCommand/garrison"`，**不能** `import from "highCommand/garrison/Garrison"`。
- barrel 只使用 `export type { ... } from "./File"` —— 不做运行时 import（防止 barrel-induced 循环依赖）。
- 例外：`src/shared/constants/index.ts` 需同时导出值和类型（`as const` 对象是运行时值）。

**barrel 文件示例：**

```typescript
// src/highCommand/garrison/index.ts
// 仅导出接口和类型，不导出实现细节（D-10）

export type { IGarrison } from "./Garrison";
export type { GarrisonStage, GarrisonMemory } from "./types";
// 不导出：Garrison 实现类、内部辅助函数
```

---

## 4. ESLint 强制规则（D-05、D-07）

以下两条规则已在 `.eslintrc.js` 中启用，违规会导致 lint 报错。

### 规则 1：`import/no-cycle`

**配置：**
```javascript
"import/no-cycle": ["error", { "maxDepth": 10, "ignoreExternal": true }]
```

**作用：** 检测任何循环导入路径。`maxDepth: 10` 限制遍历深度，覆盖 4 层架构中所有实际路径；`ignoreExternal: true` 忽略 `node_modules` 中的第三方库。

**触发场景：** barrel A 重新导出 X，X 又从 barrel A 导入 —— 常见于不规范的 barrel 文件。

**修复方式：**
- 将被循环引用的内容移入 `src/shared/`，或
- 使用构造时注入替代直接 import（参见 SPEC-04 模式 3）

### 规则 2：`no-restricted-imports`

**配置：**
```javascript
"no-restricted-imports": [
  "error",
  {
    "patterns": [
      {
        "group": [
          "highCommand/*/!(index)",
          "highCommand/*/*/!(index)",
          "highCommand/*/*/*/!(index)"
        ],
        "message": "Import from the domain barrel (index.ts) only. Direct internal imports are forbidden."
      }
    ]
  }
]
```

**作用：** 禁止绕过 barrel 直接引用 `highCommand` 内部文件。

**触发示例：**
```typescript
import { Garrison } from "highCommand/garrison/Garrison"; // ❌ ESLint error
```

**正确用法：**
```typescript
import type { IGarrison } from "highCommand/garrison"; // ✅ barrel import
```

**注意：** 这些模式依赖 `tsconfig.json` 中 `baseUrl: "src/"` 将 `highCommand/*` 解析为 `src/highCommand/*`。模块内部的相对路径 import（如 `"./Garrison"`）不受此规则影响。

---

## 5. 循环依赖防范规则

防范 barrel-induced 循环依赖的 4 条规则：

1. **barrel `index.ts` 只使用 `export type`**，不做运行时 `import`
2. **`src/shared/` 不 import 任何 `src/highCommand/` 内容**（shared 是基础层）
3. **`types.ts` 文件只 import 自 `src/shared/`**，不引用同级 `facilities/taskForces`
4. **Facility 和 TaskForce barrel 只导出自身接口**，不 import 兄弟 barrel

---

## 6. 禁止模式清单（D-05、D-06）

以下是明确禁止的导入模式和对应的修正方式：

```typescript
// 禁止 1：绕过 barrel 直接引用内部文件
import { Garrison } from "highCommand/garrison/Garrison"; // ❌ ESLint no-restricted-imports
// 修正：
import type { IGarrison } from "highCommand/garrison"; // ✅ 使用 barrel

// 禁止 2：下层引用上层（破坏依赖方向）
// 在 Barracks.ts 内：
import { Garrison } from "highCommand/garrison"; // ❌ 禁止（Barracks 是 Garrison 的子模块，不能引用父层）
// 修正：通过构造时注入接收 IGarrison 引用（参见 SPEC-04 模式 3）

// 禁止 3：同层模块直接引用
// 在 Barracks.ts 内：
import type { IWatchtower } from "highCommand/garrison/facilities/Watchtower"; // ❌ 禁止同层引用
// 修正：通过 src/shared/interfaces/ 定义共享接口并注入

// 禁止 4：在 barrel 中做运行时 import（会引发循环）
// 在 garrison/index.ts 内：
import { Garrison } from "./Garrison"; // ❌ 运行时 import 可能导致循环
export { Garrison };                   // ❌ 应改为 export type

// 正确示范：
export type { IGarrison } from "./Garrison"; // ✅ 只导出类型，无运行时 import
```

---

## 7. 关联规范

- **SPEC-01**：目录结构定义，barrel file 规则在 SPEC-01 中已定义各层目录结构
- **SPEC-04**：接口契约规范，定义允许的模块间通信模式
- **`.eslintrc.js`**：`import/no-cycle` 和 `no-restricted-imports` 规则的实际配置

---

*文档创建：2026-05-10 | Phase 08-development-standards*
