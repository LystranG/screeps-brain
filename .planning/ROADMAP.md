# Roadmap: lystran-brain

**Created:** 2026-05-03
**Core Value:** The system must provide a maintainable, extensible Screeps control architecture where long-term automation can grow safely from a tested, observable, low-coupling foundation.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-05-09)
- ◆ **v2.0 HighCommand 系统详细设计** — Phases 8-19

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-05-09</summary>

- [x] Phase 1: Runtime and Memory Foundation (4 plans)
- [x] Phase 2: Observability and Environment Infrastructure (4 plans)
- [x] Phase 3: Console Command System (5 plans)
- [x] Phase 4: Colony and Behavior Primitives (6 plans)
- [x] Phase 5: Strategy and Policy Planning (5 plans)
- [x] Phase 6: Minimal RCL1 Bootstrap Loop (4 plans)
- [x] Phase 7: Integration Testing, Runtime Fixes, and Chinese Operations Guide (6 plans)

**Total:** 7 phases, 34 plans, 54/57 requirements validated
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v2.0 HighCommand 系统详细设计

**Foundation:** `.planning/notes/system-architecture-spec.md`

| Phase | Name | Goal | Requirements | 
|-------|------|------|--------------|
| 8 | 开发规范 | 定义代码风格、目录结构、模块边界、高内聚低耦合策略 | SPEC-01~06 |
| 9 | 内核层设计 | HighCommand 单例、Kernel 调度、生命周期、Cache 索引 | KERN-01~04 |
| 10 | Memory 与缓存层设计 | MemHack、三级缓存、Segmenter、$ 函数 | MEM-01~04 |
| 11 | 情报层设计 | IntelDB、ScanQueue、威胁感知、Observer 协调 | INTEL-01~04 |
| 12 | Garrison 与 Facility 设计 | Garrison 类、Facility 基类、Barracks、HQ、Watchtower、Arsenal、Foundry | GAR-01~07 |
| 13 | TaskForce 与 Creep 管理设计 | TaskForce 基类、CreepSetup、Trooper、Task 系统、所有 TF 子类 | TF-01~05 |
| 14 | Order 系统设计 | Order 基类、常规/战斗 Order、自动放置逻辑 | ORD-01~04 |
| 15 | 物流与经济设计 | SupplyLine、LinkNetwork、TerminalNetwork、Energetics、Broker | LOG-01~05 |
| 16 | 房间规划设计 | BasePlanner、BarrierPlanner、BuildPlanner、RoadLogistics | PLAN-01~04 |
| 17 | 导航与交通设计 | Navigation、TrafficManager、移动优先级 | NAV-01~03 |
| 18 | 战斗系统设计 | 防御响应、Rampart 战位、Duo 编队、Safe Mode、反击 | COMBAT-01~05 |
| 19 | 战略与扩张设计 | GHQ 扩张、Alchemist、PowerManager、Console 接口 | STRAT-01~04 |

**Phase 8 Plans:** 4 plans

Plans:
- [x] 08-01-PLAN.md — v1.0 代码清理：删除业务模块，迁移常量到 src/shared/，创建目录骨架
- [x] 08-02-PLAN.md — SPEC-01 目录结构规范 + SPEC-02 代码风格规范设计文档
- [x] 08-03-PLAN.md — SPEC-03 模块边界规则设计文档 + SPEC-04 接口契约规范 + ESLint 规则更新
- [x] 08-04-PLAN.md — SPEC-05 测试策略设计文档 + SPEC-06 Git 规范 + 集成测试骨架

**Phase 9 Plans:** 4 plans

Plans:
- [ ] 09-01-PLAN.md — KERN-01: HighCommand 全局单例设计（字段、tick() 方法、Kernel 集成、ITaskForceRegistry 实现）
- [ ] 09-02-PLAN.md — KERN-02: Kernel 调度器 CPU 预算基础设施（CpuBudgetLevel、ICpuBudgetConfig、computeBudgetLevel 签名、看门狗数据结构）
- [ ] 09-03-PLAN.md — KERN-03: Build/Refresh/Init/Run 四阶段生命周期精确流程与边界条件
- [ ] 09-04-PLAN.md — KERN-04: 全局 Cache 反向索引设计（HighCommandCache、ITaskForceRegistry、rebuildCache 算法）

**Success criteria per phase:** 产出的设计文档包含完整的接口定义、数据结构、状态机、依赖关系图，可直接指导编码实现。

**强制约束：Phase 9-19 的所有设计文档必须遵循 Phase 8 产出的规范（`docs/v2-design/SPEC-01~06`）。** 包括：目录结构、代码风格命名、模块边界与依赖方向、接口契约格式、测试策略分层。设计文档中的接口定义和模块划分如果违反 SPEC-03（模块边界规则）或 SPEC-04（接口契约规范），视为未通过。

---

*Roadmap created: 2026-05-03*
*v1.0 shipped: 2026-05-09*
*v2.0 started: 2026-05-09*
