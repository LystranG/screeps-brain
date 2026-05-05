---
phase: 04-colony-and-behavior-primitives
plan: 01
subsystem: memory
tags: [screeps, typescript, memory, migrations, constants, tdd]

requires:
  - phase: 01-runtime-and-memory-foundation
    provides: versioned Memory schema, migration runner, role/process constants
  - phase: 03-console-command-system
    provides: existing command and process constant baseline
provides:
  - Phase 4 role constants for worker, harvester, upgrader, and builder skeleton roles
  - Phase 4 process constants for colony intel, creep roles, and spawn validation
  - Memory version 3 with typed colony config, colony intel, spawn request, process, task, and creep role/task structures
  - v3 migration repair for empty, legacy, v2, and partial current-version Memory states
affects: [04-colony-and-behavior-primitives, colony, processes, roles, tasks, spawning]

tech-stack:
  added: []
  patterns:
    - as-const domain constants with derived union types
    - versioned Memory migration with deep partial repair
    - TDD RED/GREEN commits for schema primitives

key-files:
  created:
    - .planning/phases/04-colony-and-behavior-primitives/04-01-SUMMARY.md
  modified:
    - src/constants/roles.ts
    - src/constants/processes.ts
    - src/memory/schema.ts
    - src/memory/migrations.ts
    - test/unit/constants.test.ts
    - test/unit/memory.test.ts

key-decisions:
  - "Memory version 3 stores Phase 4 primitives as compact JSON-only state: IDs, strings, ticks, arrays, and status fields."
  - "v3 migration deep-repairs runtime/config/stats sections while preserving existing colonies, processes, commands, and creep memory."
  - "CreepMemory now carries optional role/task fields, with role names constrained to centralized RoleName constants."

patterns-established:
  - "Phase 4 Memory additions are introduced through schema interfaces plus migration tests before behavior modules consume them."
  - "Current-version migration remains idempotent and doubles as partial repair for manually edited Memory."

requirements-completed: [COL-01, COL-03, BEH-02, BEH-03, BEH-04, BEH-05, TEST-05]

duration: 9min
completed: 2026-05-05
---

# Phase 04 Plan 01: Memory and Constants Foundation Summary

**Typed Phase 4 Screeps Memory v3 with colony/process/task/spawn primitives and skeleton role/process constants**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-05T15:13:28Z
- **Completed:** 2026-05-05T15:22:30Z
- **Tasks:** 3 completed
- **Files modified:** 6 code/test files plus this summary

## Accomplishments

- Added Phase 4 role constants for `worker`, `harvester`, `upgrader`, and `builder`.
- Added process constants for `colonyIntel`, `creepRoles`, and `spawnValidation` without removing existing process keys.
- Bumped project Memory to version 3 and added typed colony config, intel, spawn request, process, task, and creep role/task structures.
- Implemented v3 migration repair that preserves existing user Memory while adding colony defaults.
- Expanded unit tests for constants and Memory migration paths, including empty, old, v2, and partial current-version states.

## Task Commits

1. **Task 1 RED: Extend role and process constants test** - `1daf76e` (test)
2. **Task 1 GREEN: Extend role and process constants** - `f687e1c` (feat)
3. **Task 2 RED: Add Phase 4 Memory defaults test** - `9f226bd` (test)
4. **Task 2 GREEN: Add Phase 4 Memory schema defaults** - `1ded757` (feat)
5. **Task 3 RED: Add v3 migration repair test** - `af47eac` (test)
6. **Task 3 GREEN: Add v3 Memory migration repairs** - `b8050cd` (feat)

**Plan metadata:** included in final docs commit

## Files Created/Modified

- `src/constants/roles.ts` - Defines Phase 4 skeleton role names.
- `src/constants/processes.ts` - Defines Phase 4 colony/process/spawn validation process names.
- `src/memory/schema.ts` - Defines Memory v3 interfaces and defaults.
- `src/memory/migrations.ts` - Adds ordered v3 migration and nested partial repair.
- `test/unit/constants.test.ts` - Verifies role/process constants and key preservation.
- `test/unit/memory.test.ts` - Verifies v3 defaults, v2-to-v3 migration, preservation, and partial repair.
- `.planning/phases/04-colony-and-behavior-primitives/04-01-SUMMARY.md` - Documents plan execution.

## Decisions Made

- Role/task fields live on `CreepMemory` as optional fields so later behavior dispatch can validate them before execution.
- `SpawnRequestMemory` stores resolved `BodyPartConstant[]` plus explainable metadata; richer body intent semantics remain for later body builder work.
- v3 migration deep-merges nested runtime and config sections to keep current-version partial repair reliable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added minimal v3 migration wiring during Task 2**
- **Found during:** Task 2 (Add Phase 4 Memory interfaces and defaults)
- **Issue:** Bumping `CURRENT_MEMORY_VERSION` to 3 made the migration runner require an ordered v3 step before Task 3's dedicated migration work.
- **Fix:** Added `3: migrateToVersion3` with compact default repair so Task 2 tests could run against version 3. Task 3 then deepened the migration coverage and repair behavior.
- **Files modified:** `src/memory/migrations.ts`, `test/unit/memory.test.ts`
- **Verification:** `rtk npm run test-unit -- --grep "memory"` passed.
- **Committed in:** `1ded757`, completed by `b8050cd`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** The deviation was necessary to keep the versioned migration runner coherent after the schema bump. It did not add gameplay behavior or expand scope beyond v3 Memory primitives.

## Issues Encountered

- RED tests initially produced TypeScript compile errors when asserting future constant/schema fields. The tests were adjusted to read future fields through narrow indexed views so RED failures remained behavioral assertions.
- Existing tests that preserved legacy arbitrary creep memory needed `as unknown` assertions after `CreepMemory` became stricter. Runtime preservation behavior remains covered.

## Verification

- `rtk npm run test-unit -- --grep "memory"` - PASS, 18 passing
- `rtk npm run test-unit -- --grep "constants"` - PASS, 8 passing
- Task acceptance `rg` checks for role constants, process constants, `CURRENT_MEMORY_VERSION = 3`, schema interfaces, v3 migration, `config.colony`, `primaryRoomName`, and `intelRefreshCadence` - PASS
- `rtk graphify update .` - PASS, graph rebuilt with 193 nodes and 240 edges

## Known Stubs

None - no placeholder UI/data stubs were introduced. Empty default arrays/objects are schema defaults for JSON Memory sections and do not block the plan goal.

## Threat Flags

None - this plan only extends existing Memory migration and serialized Memory shapes covered by the plan threat model. No network endpoints, file access paths, auth paths, or external trust boundaries were added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04-02 can build colony context and room intel on top of `Memory.config.colony`, `Memory.colonies`, v3 process memory, and the new role/process constants. Spawn queue/body builder plans can use `SpawnRequestMemory` and `TaskMemory` without replacing the schema.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/04-colony-and-behavior-primitives/04-01-SUMMARY.md`
- Commits found: `1daf76e`, `f687e1c`, `9f226bd`, `1ded757`, `af47eac`, `b8050cd`
- Verification commands passed after final task implementation.

---
*Phase: 04-colony-and-behavior-primitives*
*Completed: 2026-05-05*
