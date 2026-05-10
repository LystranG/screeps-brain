---
phase: 09-kernel-layer-design
plan: "01"
subsystem: highcommand-singleton
tags: [design-doc, kernel, highcommand, architecture]
dependency_graph:
  requires: []
  provides: [KERN-01-highcommand-singleton.md]
  affects: [KERN-02, KERN-03, KERN-04]
tech_stack:
  added: []
  patterns: [interface-typed-fields, thin-coordinator, global-reset-detection, event-driven-build]
key_files:
  created:
    - docs/v2-design/KERN-01-highcommand-singleton.md
  modified: []
decisions:
  - HighCommand tick() receives RuntimeServices as parameter (not constructor injection) for testability
  - global._lastTick stored on Screeps global object (not class field) to survive HighCommand reconstruction on reset
  - lifecycle.ts must be refactored to factory function createLifecycleStages(highCommand) to enable closure over instance
metrics:
  duration: "~8 minutes"
  completed: "2026-05-10"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 09 Plan 01: KERN-01 HighCommand Singleton Design Summary

**One-liner:** HighCommand singleton design with interface-typed fields, global-reset-detecting tick(), and Kernel integration via factory-function lifecycle stages.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Write KERN-01-highcommand-singleton.md | d1042cf |

## What Was Built

Created `docs/v2-design/KERN-01-highcommand-singleton.md` — a complete, copy-ready specification of the HighCommand class with 9 numbered sections:

1. **总体原则** — Six locked decisions D-01 through D-06 in a reference table
2. **文件位置与目录结构** — SPEC-01 compliant directory additions for Phase 9
3. **HighCommand 类定义** — Complete TypeScript class with all fields typed as interfaces (IIntelProvider, IGarrison, ITaskForce), not concrete classes
4. **tick() 方法** — Global reset detection via `global._lastTick`, build/refresh branching, CpuBudgetLevel-based circuit breaker
5. **Kernel 集成** — Kernel field addition, lifecycle.ts union extension, factory function refactoring approach
6. **方法签名摘要** — Table of all 12 public/private methods with signatures and descriptions
7. **IIntelProvider 最小接口** — Phase 9 minimal interface (init/run only), Phase 11 expansion noted
8. **禁止模式** — 5 anti-patterns with ❌/✅ code blocks (global registration, concrete refs, business logic, Run-phase handler registration, premature _lastTick update)
9. **关联规范** — Cross-links to KERN-02/03/04, SPEC-03/04

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `private readonly highCommand` in the acceptance criteria. The document shows this pattern in:
- The D-03 decision table cell
- The Kernel class code block in Section 5.1

Both match the acceptance criteria grep pattern.

## Self-Check

### Files Created

- `docs/v2-design/KERN-01-highcommand-singleton.md` — FOUND

### Commits

- `d1042cf` — FOUND (`git log --oneline -3` shows this commit)

### Acceptance Criteria

- `class HighCommand implements ITaskForceRegistry` — 1 match
- `private intel: IIntelProvider` — matches (not `private intel: Intel`)
- `private readonly highCommand: HighCommand` — matches in code block
- `highCommandTick` — 8 matches
- `global._lastTick` — 2 matches
- `_needsBuildFlag` — 7 matches
- `D-0[1-6]` — 25 matches (>= 6 required)
- 9 numbered top-level sections — confirmed
- No `global.highCommand =` as recommendation — 0 matches (only in `(global as any).highCommand` as ❌ forbidden pattern)

## Self-Check: PASSED
