# Deferred Items - Phase 05 Strategy and Policy Planning

## 2026-05-06 - Plan 05-04

- `rtk npm run lint` still fails on pre-existing Phase 05 strategy files outside the Plan 05-04 command changes:
  - `src/strategy/planner.ts`: array-type and nullable template literal lint errors, plus import ordering warnings.
  - `src/strategy/policy.ts`: array-type lint error and import ordering warning.
  - `src/memory/schema.ts` and `src/strategy/runner.ts`: import ordering warnings.
- Plan 05-04 fixed its own added lint warning in `src/commands/namespaces/strategy.ts`.
- Plan 05-05 already includes the full `npm run lint` gate and should address these Phase 5-wide lint issues there.
