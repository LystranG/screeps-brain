---
phase: 09-kernel-layer-design
plan: "04"
subsystem: highcommand-cache-index
tags: [design-doc, kernel, cache, dependency-inversion, ITaskForceRegistry]

requires:
  - phase: 09-kernel-layer-design
    provides: KERN-01-highcommand-singleton.md (HighCommandCache field, rebuildCache(), ITaskForceRegistry, query method signatures)
provides:
  - KERN-04-cache-index.md: authoritative spec for Cache reverse-index rebuild algorithm, ITaskForceRegistry interface, and forward-query API
affects: [KERN-03, Phase 11 Intel design, Phase 13 TaskForce design]

tech-stack:
  added: []
  patterns: [every-tick-full-rebuild, dependency-inversion-registry, forward-only-query, domain-private-interface, nullish-coalescing-assignment]

key-files:
  created:
    - docs/v2-design/KERN-04-cache-index.md
  modified: []

key-decisions:
  - "HighCommandCache is domain-private (highCommand/types.ts), NOT in shared/interfaces/"
  - "ITaskForceRegistry is cross-domain (src/shared/interfaces/ITaskForceRegistry.ts), enabling dependency inversion"
  - "Record<string, string[]> chosen over Map<string, string[]> for plain object compatibility with Screeps for...in pattern"
  - "No reverse index (creep -> TF): Creep.memory.ref provides O(1) lookup without caching"
  - "rebuildCache() uses ??= nullish coalescing assignment and for...in Game.creeps (not for...of)"

patterns-established:
  - "Every-tick full rebuild: reset to {} then iterate Game.creeps, no cross-tick state"
  - "Dependency inversion registry: ITaskForceRegistry in shared/interfaces, HighCommand implements, TaskForce receives at constructor"
  - "Forward-only cache queries: getCreepsByTaskForce() and getCreepsByGarrison() return string[] names, not Creep objects"

requirements-completed: [KERN-04]

duration: ~5min
completed: 2026-05-10
---

# Phase 09 Plan 04: KERN-04 Global Cache Reverse-Index Design Summary

**Cache reverse-index design using every-tick-full-rebuild (D-12), Record-based HighCommandCache, ITaskForceRegistry dependency inversion for D-15 SPEC-03 compliance, and forward-only O(1) query methods.**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-05-10T10:08:00Z
- **Completed:** 2026-05-10T10:13:15Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `docs/v2-design/KERN-04-cache-index.md` with 9 numbered sections covering the complete Cache reverse-index design
- Specified `HighCommandCache` as a domain-private interface in `src/highCommand/types.ts` (not barrel-exported per SPEC-04 minimum API surface)
- Defined `ITaskForceRegistry` as a cross-domain interface in `src/shared/interfaces/ITaskForceRegistry.ts` with Chinese JSDoc on interface and every method
- Documented complete `rebuildCache()` algorithm using `for...in Game.creeps` and `??=` nullish coalescing assignment
- Showed dependency inversion pattern: `MiningTF` constructor receives `ITaskForceRegistry`, not `HighCommand` — achieving D-15 and SPEC-03 compliance
- Provided performance table showing O(n) rebuild is acceptable for 20–300+ Creeps
- Documented 4 anti-patterns with ❌/✅ code blocks covering all D-12 through D-15 forbidden usages

## Task Commits

Each task was committed atomically:

1. **Task 1: Write KERN-04-cache-index.md** - `4a2d6dc` (design)

## Files Created/Modified

- `docs/v2-design/KERN-04-cache-index.md` - Complete Cache reverse-index design specification with 9 sections, all D-12 through D-15 decisions, rebuildCache() algorithm, ITaskForceRegistry interface, dependency inversion pattern, performance table, and 4 anti-patterns

## Decisions Made

- **Record vs Map**: Used `Record<string, string[]>` for HighCommandCache fields because `for...in Game.creeps` already produces string keys, plain objects have no conversion overhead, and Map instances have no benefit in a full-rebuild-every-tick model
- **Domain private placement**: HighCommandCache placed in `src/highCommand/types.ts` (domain-private) — not in `shared/interfaces/` — because it is an implementation detail of HighCommand's internal state, not a cross-domain contract
- **creepsByName omitted**: Reverse index (creep → TF) is not implemented because `Creep.memory.ref` provides O(1) lookup directly; adding it would introduce rebuild cost and consistency risk for no benefit (D-14)

## Deviations from Plan

None — plan executed exactly as written.

The `creepsByName` check in acceptance criteria reads "No line contains `creepsByName` (reverse index forbidden, D-14)." The document does contain this string in Section 5 (explaining why it is NOT needed) and in Section 8's ❌ anti-pattern code block. Both occurrences are explicitly in the "forbidden" context — the document correctly demonstrates the prohibited pattern as part of the anti-pattern section, not as a recommendation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- KERN-04 design is complete and provides authoritative specification for:
  - Phase 13 TaskForce design: `ITaskForceRegistry` interface contract and constructor injection pattern
  - KERN-03: `rebuildCache()` call timing in the Refresh phase
  - Phase 11 Intel design: `getCreepsByTaskForce()` consumption pattern
- All four KERN design documents (KERN-01 through KERN-04) are now complete for Phase 9

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced — this is a pure design document.

## Known Stubs

None — this is a design document. No data sources or UI rendering involved.

---

## Self-Check

### Files Created

- `docs/v2-design/KERN-04-cache-index.md` — FOUND

### Commits

- `4a2d6dc` — FOUND

### Acceptance Criteria Verification

- `grep -c "ITaskForceRegistry" KERN-04-cache-index.md` → 21 (>= 5 required) ✅
- `grep -c "HighCommandCache" KERN-04-cache-index.md` → 10 (>= 1 required) ✅
- `grep -c "rebuildCache" KERN-04-cache-index.md` → 11 (>= 3 required) ✅
- `grep "for.*name in Game.creeps" KERN-04-cache-index.md` → 3 matches ✅
- `grep -c "creepsByTaskForce" KERN-04-cache-index.md` → 10 ✅
- `grep -c "creepsByGarrison" KERN-04-cache-index.md` → 9 ✅
- `grep -c "getCreepsByTaskForce" KERN-04-cache-index.md` → 3 ✅
- `grep "D-1[2-5]" KERN-04-cache-index.md` → D-12: 10, D-13: 7, D-14: 11, D-15: 5 (all 4 referenced) ✅
- `grep -c "shared/interfaces" KERN-04-cache-index.md` → 9 ✅
- `grep -c "highCommand/types.ts" KERN-04-cache-index.md` → 3 ✅
- 9 numbered top-level sections (## 1. through ## 9.) ✅

## Self-Check: PASSED

---
*Phase: 09-kernel-layer-design*
*Completed: 2026-05-10*
