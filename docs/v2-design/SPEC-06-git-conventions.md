# SPEC-06: Git 提交与分支规范

**决策来源：** D-21（08-CONTEXT.md）、branching_strategy: "none"（.planning/config.json）
**适用范围：** v2.0 HighCommand 架构开发期间（Phase 8-19）的所有提交

---

## 1. .planning/ 目录管理（D-21）

- `.planning/` 目录已在 `.gitignore` 中排除（第 102 行），**不纳入版本控制**。
- 规划文档（ROADMAP.md、REQUIREMENTS.md、CONTEXT.md、PLAN.md 等）仅存在于本地工作环境。
- **原因：** 规划文档会频繁修改且无需共享，纳入 git 会污染提交历史，增加无意义的 diff 噪音。
- **禁止：** `git add .planning/` 或 `git add -f .planning/`。

---

## 2. 分支策略

- **策略：** 无功能分支（branching_strategy: "none"）。
- **工作流：** 在 `dev` 分支直接开发 → 合并到 `master`（阶段里程碑发布时）。
- 不使用 feature branch、hotfix branch 等 Git Flow 模式。
- **适用原因：** 单人开发，复杂分支策略增加认知负担，不带来收益。

---

## 3. Conventional Commits 格式

采用 Conventional Commits 规范（精简版），格式：

```
<type>(<scope>): <subject>

[body（可选，解释 why 而非 what）]
```

### 提交类型（type）完整清单

| type | 含义 | 示例场景 |
|------|------|---------|
| feat | 新功能或新设计文档 | 实现 Garrison Build 生命周期 |
| fix | bug 修复 | 修复 spawn queue 优先级排序错误 |
| docs | 纯文档变更 | 更新操作手册 |
| refactor | 代码重构（无行为变化） | 提取公共方法 |
| test | 测试添加或修正 | 新增 Barracks 单元测试 |
| chore | 工具、配置、构建、清理 | 删除 v1.0 业务模块 |
| design | v2.0 设计文档提交（Phase 8-19 专用） | 新增 SPEC-01 目录结构设计文档 |

### 范围（scope，可选）

使用架构层级名称：`kernel`、`garrison`、`intel`、`barracks`、`taskForce`、`shared`、`memory`、`testing`、`toolchain`、`spec`

### 提交示例

```
design(spec): add SPEC-01 directory structure document
design(kern): add KERN-01 HighCommand singleton design
feat(garrison): implement Garrison Build/Refresh lifecycle
chore(cleanup): remove v1.0 colony/ processes/ strategy/ modules
test(barracks): add unit tests for spawn queue priority sorting
fix(navigation): fix CostMatrix cache invalidation on room ownership change
refactor(shared): extract SpawnRequest interface to shared/interfaces
```

---

## 4. Subject 行书写规则

- 使用**祈使句**（动词开头）：`add`、`implement`、`fix`、`remove`、`update`、`refactor`
- 不超过 72 字符
- 不以句号结尾
- **英文**（提交信息保持英文，代码注释/文档用中文）

---

## 5. Body 书写规则（可选）

当 subject 无法说明 why 时，添加 body：

- 空一行后写 body
- 解释**为什么**做这个改动（不是解释做了什么）
- 可以引用决策 ID（如 `"per D-18: v2.0 full rewrite strategy"`）

**示例：**

```
chore(cleanup): remove v1.0 colony/ processes/ strategy/ modules

per D-18: v2.0 full rewrite strategy supersedes v1.0 business modules.
Keeping them would confuse the v2.0 architecture's clean slate.
```

---

## 6. 提交粒度建议

| 操作类型 | 建议粒度 |
|---------|---------|
| 设计文档 | 每份 SPEC 文档一个提交 |
| 代码功能 | 每个完整的模块/类一个提交 |
| 大范围清理 | 相关文件合并为一个 chore 提交 |
| 测试 | 与对应功能代码同一提交，或单独 test 提交 |

- **不要**把无关的改动放入同一提交（混合 feat + chore）。
- **不要**拆得过细（一个文件的两处改动不需要两个提交）。
