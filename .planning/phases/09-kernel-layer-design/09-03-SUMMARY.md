---
phase: 09-kernel-layer-design
plan: "03"
subsystem: lifecycle-boundaries
tags: [design-doc, kernel, lifecycle, highcommand, eventbus, build-refresh-init-run]
dependency_graph:
  requires: [KERN-01]
  provides: [KERN-03-lifecycle.md]
  affects: [KERN-04, Phase 11 Intel design, Phase 12 Garrison design]
tech_stack:
  added: []
  patterns: [four-phase-lifecycle, event-driven-build, factory-function-stages, isolated-try-catch, as-const-events]
key_files:
  created:
    - docs/v2-design/KERN-03-lifecycle.md
  modified: []
decisions:
  - lifecycle.ts KERNEL_LIFECYCLE_STAGES refactored to createLifecycleStages(highCommand) factory function to capture Kernel instance via closure
  - eventBus.clear() is mandatory first step of build() to prevent handler accumulation across rebuilds (T-09-06 mitigation)
  - global._lastTick updated only after build() succeeds in tick() try block — never before or inside build()
  - Build failure path returns immediately from tick() without executing init/run to prevent null-reference cascade
  - HighCommandEvents as const object with three event constants (StructureBuilt, RoomClaimed, RoomLost) in shared/events/
  - Init/Run use per-module isolated try/catch — one module failure does not stop others
metrics:
  duration: "~3 minutes"
  completed: "2026-05-10"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 09 Plan 03: KERN-03 Build/Refresh/Init/Run Lifecycle Design Summary

**One-liner:** Four-phase HighCommand lifecycle with factory-function stage integration, event-driven build triggers via HighCommandEvents constants, and per-module isolated error recovery.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Write KERN-03-lifecycle.md | 36fe42d |

## What Was Built

Created `docs/v2-design/KERN-03-lifecycle.md` — a complete, copy-ready specification of the Build/Refresh/Init/Run lifecycle with 10 numbered sections:

1. **总体原则（D-18）** — "对象引用即状态" principle with the full system architecture ASCII diagram showing Kernel → highCommandTick → HighCommand.tick() → build/refresh → init → run flow
2. **lifecycle.ts 扩展（KERN-03）** — Exact before/after comparison of LifecycleStageName union (2 → 3 members including `highCommandTick`) and KERNEL_LIFECYCLE_STAGES refactored to `createLifecycleStages(highCommand)` factory function with corresponding Kernel.ts call site change
3. **Build 阶段（D-16）** — Three trigger conditions, 8-step ordered execution sequence, and try/catch recovery pattern showing `_lastTick` only updated after `build()` succeeds
4. **Refresh 阶段（D-19）** — Minimal responsibility: id→object refresh + rebuildCache() only; no structure change detection (event-driven instead)
5. **Init 阶段** — Intel.init() → Garrison[].init() sequence with per-module try/catch isolation and no-Game-side-effects constraint
6. **Run 阶段** — Intel.run() → Garrison[].run() sequence with per-module isolation; Game mutations and eventBus.emit() calls happen here
7. **异常恢复策略（D-17）** — Two-level recovery table: Build failure (whole-tree retry) vs Init/Run failure (per-module isolation)
8. **事件驱动 Build 通知（D-16）** — HighCommandEvents `as const` object with 3 event constants, handler registration in build(), emit call sites in run()
9. **禁止模式** — 5 anti-patterns with ❌/✅ code blocks covering: Kernel build/refresh decision, Run-phase handler registration, premature _lastTick update, Refresh structure detection, Init Game side-effects
10. **关联规范** — Cross-links to KERN-01/02/04, SPEC-03/04

## Deviations from Plan

None — plan executed exactly as written.

All acceptance criteria confirmed:
- `highCommandTick` — 4 matches (≥ 3 required)
- `createLifecycleStages` — 5 matches (≥ 1 required)
- `HighCommandEvents` — 13 matches (≥ 1 required)
- `eventBus.clear()` — 7 matches (≥ 1 required)
- `_needsBuildFlag` — 23 matches (≥ 4 required)
- `D-1[6-9]` — 14 matches (≥ 4 required)
- `Game.notify` — 13 matches (≥ 2 required)
- 10 numbered top-level sections — confirmed
- `eventBus.on` in `run()` — 0 matches (required = 0)

## Threat Model Coverage

Both threats in the plan's STRIDE register were addressed:

| Threat ID | Disposition | Coverage |
|-----------|-------------|---------|
| T-09-06 (EventBus handler accumulation) | mitigate | Section 3.2 step 1 mandates `eventBus.clear()` as first build() step; constraint block and Section 9 forbidden pattern 2 reinforce |
| T-09-07 (Build failure infinite retry) | mitigate | Section 3.3 shows `Game.notify()` + `_needsBuildFlag = true` recovery; Section 7 table documents the full retry path; not an infinite loop because Kernel's outer try/catch provides the termination guarantee |

## Self-Check

### Files Created

- `docs/v2-design/KERN-03-lifecycle.md` — FOUND

### Commits

- `36fe42d` — FOUND (`design(09-03): write KERN-03-lifecycle.md four-phase lifecycle design`)

## Self-Check: PASSED
