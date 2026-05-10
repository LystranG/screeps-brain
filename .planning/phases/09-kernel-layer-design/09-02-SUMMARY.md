---
phase: 09-kernel-layer-design
plan: "02"
subsystem: infra
tags: [screeps, cpu-budget, design-doc, typescript, as-const, kernel]

# Dependency graph
requires:
  - phase: 09-01
    provides: HighCommand singleton design with computeBudgetLevel() method signature and field structure
provides:
  - CpuBudgetLevel as const object (Critical/Low/Normal/Surplus) with derived union type
  - ICpuBudgetConfig interface with criticalThreshold/lowThreshold/surplusThreshold fields
  - DEFAULT_CPU_BUDGET_CONFIG constant with concrete threshold values (500/2500/8000)
  - computeBudgetLevel() method signature and behavior contract
  - WatchdogRecord and IWatchdogConfig domain-private data structures
  - Phase 9 vs Phase 11 scope boundary table with D-11 quote
affects:
  - 09-03  # KERN-03 lifecycle boundaries reference CpuBudgetLevel for init/run gate
  - 09-04  # KERN-04 cache index references HighCommand field structure
  - Phase 11 Intel scheduler  # consumes CpuBudgetLevel data structures for truncation loop

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "as const object + derived union type for CPU budget level enum (SPEC-02 D-13)"
    - "ICpuBudgetConfig injectable threshold interface (allows Phase 11 override)"
    - "WatchdogRecord as domain-private type in highCommand/types.ts (not shared/interfaces/)"
    - "computeBudgetLevel() behavior contract defined in Phase 9, implementation deferred to Phase 11"

key-files:
  created:
    - docs/v2-design/KERN-02-kernel-scheduler.md
  modified: []

key-decisions:
  - "CpuBudgetLevel thresholds: Critical<500, Low<2500, Normal 2500-8000, Surplus>8000 (Claude's Discretion on concrete values)"
  - "WatchdogRecord lives in src/highCommand/types.ts (domain-private), NOT in src/shared/interfaces/ (T-09-05 threat mitigation)"
  - "DEFAULT_CPU_BUDGET_CONFIG exported from src/shared/constants/cpu.ts alongside CpuBudgetLevel"
  - "computeBudgetLevel() takes RuntimeServices parameter for logger access during anomaly detection"

patterns-established:
  - "Phase boundary documentation: explicit scope table (Phase 9 vs Phase 11) prevents scope creep during implementation"
  - "D-11 quote embedded in document to enforce scope boundary for Phase 11 implementors"

requirements-completed:
  - KERN-02

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 09 Plan 02: KERN-02 Kernel Scheduler CPU Budget Infrastructure Summary

**CPU budget design with CpuBudgetLevel as-const enum (Critical/Low/Normal/Surplus), injectable ICpuBudgetConfig thresholds (500/2500/8000), computeBudgetLevel() method contract, and domain-private WatchdogRecord data structures with explicit Phase 9/11 scope boundary**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T00:00:00Z
- **Completed:** 2026-05-10T00:12:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Produced `docs/v2-design/KERN-02-kernel-scheduler.md` with all 7 required sections meeting KERN-02 acceptance criteria
- Defined `CpuBudgetLevel` as-const object with string values (not numbers) and derived union type per SPEC-02 D-13
- Defined `ICpuBudgetConfig` interface with readonly fields and `DEFAULT_CPU_BUDGET_CONFIG` constant (thresholds: 500/2500/8000)
- Established `computeBudgetLevel()` method signature and behavior contract without implementation body
- Defined `WatchdogRecord` and `IWatchdogConfig` as domain-private types in `src/highCommand/types.ts`
- Created explicit Phase 9 vs Phase 11 scope boundary table with D-11 quote to prevent scope creep

## Task Commits

Each task was committed atomically:

1. **Task 1: Write KERN-02-kernel-scheduler.md** - `6e0d528` (design)

**Plan metadata:** (committed after SUMMARY.md)

## Files Created/Modified

- `docs/v2-design/KERN-02-kernel-scheduler.md` - CPU budget infrastructure design document: CpuBudgetLevel enum, ICpuBudgetConfig interface, computeBudgetLevel() contract, WatchdogRecord data structures, Phase 9/11 scope boundary

## Decisions Made

- **Threshold values (Claude's Discretion):** Critical < 500 (5% bucket capacity), Low < 2500 (25%), Normal 2500–8000, Surplus > 8000 (80%+). Rationale: Conservative thresholds to protect creep survival. Phase 11 can override via ICpuBudgetConfig injection.
- **WatchdogRecord placement:** `src/highCommand/types.ts` (domain-private), not `src/shared/interfaces/`. Watchdog state is an internal implementation detail of HighCommand/Intel, not a cross-domain contract.
- **DEFAULT_CPU_BUDGET_CONFIG location:** Exported from `src/shared/constants/cpu.ts` alongside `CpuBudgetLevel` to keep CPU-related constants co-located.
- **computeBudgetLevel() uses RuntimeServices parameter:** For logger access to record anomalous bucket levels (e.g., unexpected zero), consistent with other HighCommand private methods in KERN-01.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- KERN-02 provides all data structures needed by KERN-03 (lifecycle CpuBudgetLevel gate check in init/run) and by Phase 11 (truncation loop and watchdog implementation)
- KERN-03 and KERN-04 can proceed in parallel (wave 2 already contains them)
- No blockers identified

## Self-Check

- [x] File exists: `docs/v2-design/KERN-02-kernel-scheduler.md`
- [x] Commit `6e0d528` exists
- [x] `grep "as const" ... | grep "CpuBudgetLevel"` returns match (table row + code block)
- [x] `grep "ICpuBudgetConfig"` returns multiple matches
- [x] `grep "computeBudgetLevel"` returns multiple matches
- [x] `grep "WatchdogRecord"` returns multiple matches
- [x] `grep "Phase 11" | wc -l` returns 18 (>= 3 required)
- [x] `grep "D-0[7-9]|D-10|D-11"` returns 20 matches (>= 5 required)
- [x] `grep "typeof CpuBudgetLevel[keyof typeof CpuBudgetLevel]"` returns match
- [x] 7 numbered top-level sections present
- [x] No truncation for-loop code (`Game.cpu.getUsed` in `for`) found

## Self-Check: PASSED

---
*Phase: 09-kernel-layer-design*
*Completed: 2026-05-10*
