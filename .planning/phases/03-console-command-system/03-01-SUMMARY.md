---
phase: 03-console-command-system
plan: 01
subsystem: commands
tags: [typescript, screeps, console-commands, validation, memory-history, tdd]

# Dependency graph
requires:
  - phase: 01-runtime-and-memory-foundation
    provides: typed Memory schema, validation result contracts, centralized constants
  - phase: 02-observability-and-environment-infrastructure
    provides: runtime Memory surfaces that later command namespaces inspect
provides:
  - Command API constants with stable status prefixes and side-effect labels
  - Structured internal command contracts for registry execution and tests
  - Metadata-driven help formatting for root and namespace command help
  - Strict command argument validators for confirmation, dump paths, booleans, and sampling
  - Compact bounded Memory.commands.history recording
  - Metadata registry execution with structured unknown-path errors
affects: [03-console-command-system, console-command-installer, command-namespaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Metadata-driven command definitions render public help output
    - Structured CommandResult values are formatted separately from execution
    - Command history stores compact serializable records only

key-files:
  created:
    - src/commands/types.ts
    - src/commands/formatter.ts
    - src/commands/arguments.ts
    - src/commands/history.ts
    - src/commands/registry.ts
    - test/unit/commandCore.test.ts
  modified:
    - src/constants/commands.ts

key-decisions:
  - "Command execution returns structured CommandResult values; public string formatting remains a separate layer."
  - "Command help is rendered from namespace and command metadata, avoiding duplicated command lists."
  - "Memory.commands.history records only tick, path, compact args, and status, capped at COMMAND_HISTORY_LIMIT."

patterns-established:
  - "Command definitions carry signature, description, side-effect level, and run handler in one metadata object."
  - "User validation failures return ValidationResult failures instead of throwing."
  - "Registry unknown paths return structured ERR results and do not log ordinary command output."

requirements-completed: [CMD-02, CMD-03, CMD-06, TEST-03]

# Metrics
duration: 15min
completed: 2026-05-05
---

# Phase 03 Plan 01: Command Core Foundation Summary

**Typed Screeps console command core with metadata help, strict validators, bounded history, and registry execution**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-05T08:44:11Z
- **Completed:** 2026-05-05T08:59:24Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added command constants for API versioning, output prefixes, side-effect labels, and history cap.
- Created structured command contracts and metadata-driven root/namespace help rendering.
- Added strict validators for confirmation tokens, whitelisted dump paths, sampling rates, booleans, and argument stringification.
- Added compact bounded command history and registry execution with structured unknown-path errors.
- Added unit coverage for formatter/help, arguments, registry, and history behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define command constants, contracts, and formatter**
   - `f416628` test: add failing command formatter tests
   - `4e0c378` feat: implement command formatter contracts
2. **Task 2: Implement strict command argument validators**
   - `8d999ea` test: add failing command argument tests
   - `b0d2c94` feat: implement command argument validators
3. **Task 3: Add bounded history recording and registry execution**
   - `ff255e6` test: add failing registry history tests
   - `d1d5d84` feat: implement command registry history
4. **Refactor**
   - `aaa0312` refactor: sort command module imports

## Files Created/Modified

- `src/constants/commands.ts` - Adds command API version, history limit, status prefixes, and side-effect constants.
- `src/commands/types.ts` - Defines CommandResult, command metadata, context, command tree, and registry contracts.
- `src/commands/formatter.ts` - Formats structured results and renders root/namespace help from metadata.
- `src/commands/arguments.ts` - Validates confirmation tokens, dump paths, sampling rates, and booleans.
- `src/commands/history.ts` - Records compact bounded command history in `Memory.commands.history`.
- `src/commands/registry.ts` - Executes registered commands and returns structured errors for unknown paths.
- `test/unit/commandCore.test.ts` - Covers formatter/help, arguments, registry, and history behavior.

## Decisions Made

- Used structured `CommandResult` internally so registry execution, tests, and history can consume stable result metadata before public string formatting.
- Kept help metadata beside command definitions so root and namespace help cannot drift from registered commands.
- Recorded only compact serializable history fields to avoid storing dump output, full Memory snapshots, or live Screeps objects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made command history records compatible with Memory.commands.history**
- **Found during:** Task 3 (Add bounded history recording and registry execution)
- **Issue:** The local `CommandHistoryRecord` interface did not satisfy the existing `Record<string, unknown>[]` Memory history type.
- **Fix:** Extended the local history record from `Record<string, unknown>` while keeping its explicit tick/path/args/status fields.
- **Files modified:** `src/commands/history.ts`
- **Verification:** `rtk npm run test-unit -- --grep "command core|registry|history"` passed.
- **Committed in:** `d1d5d84`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for TypeScript compatibility with the existing Memory schema; no scope expansion.

## Issues Encountered

- Git signing initially failed because the signing key was not available in the agent. Work paused at a human-action checkpoint and resumed after user authorization; no signing or hook bypass was used.
- Lint reported import ordering warnings after implementation. Import ordering was corrected in `aaa0312`; `rtk npm run lint` then passed cleanly.

## Verification

- `rtk npm run test-unit -- --grep "command core|formatter|help"` - passed, 11 tests.
- `rtk npm run test-unit -- --grep "command core|arguments"` - passed, 11 tests.
- `rtk npm run test-unit -- --grep "command core|registry|history"` - passed, 11 tests.
- `rtk npm run lint` - passed.
- `rtk graphify update .` - completed after code changes.

## Known Stubs

None. Stub scan found no TODO/FIXME/placeholder or hardcoded empty UI data. The `null` occurrence in `stringifyArgument` is intentional value formatting logic.

## Threat Flags

None. The new trust-boundary surfaces match the plan threat model: command argument validation, command history persistence, and result formatting.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The command core is ready for later public `global.cmd` installation and namespace implementations. Downstream work can register namespace definitions, execute them through `createCommandRegistry`, format public output through `formatCommandResult`, and rely on bounded history recording.

## Self-Check: PASSED

- Verified created files exist: `src/commands/types.ts`, `src/commands/formatter.ts`, `src/commands/arguments.ts`, `src/commands/history.ts`, `src/commands/registry.ts`, and `test/unit/commandCore.test.ts`.
- Verified modified file exists: `src/constants/commands.ts`.
- Verified commits exist: `f416628`, `4e0c378`, `8d999ea`, `b0d2c94`, `ff255e6`, `d1d5d84`, and `aaa0312`.
- Verified `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified.

---
*Phase: 03-console-command-system*
*Completed: 2026-05-05*
