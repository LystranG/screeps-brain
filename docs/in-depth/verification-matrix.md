# Verification Matrix

Use a verification matrix when a phase changes runtime behavior, Memory shape, command output, deployment flow, or Screeps API interactions. The matrix makes evidence explicit instead of treating a green unit suite as complete confidence.

## Evidence Layers

| Layer | Purpose | Good Fit | Not Enough For |
| ----- | ------- | -------- | -------------- |
| Unit | Lock pure logic, migrations, state machines, validators, and command formatting. | Fast regression coverage for one behavior at a time. | Screeps engine timing, built bundle behavior, official sim UI setup. |
| Integration | Run the built `dist/main.js` bundle in `screeps-server-mockup`. | Memory initialization, kernel order, command tokens, bootstrap progression, degraded scenarios. | Official sim Customize behavior, MMO/private-server timing differences. |
| Real sim UAT | Exercise the uploaded bundle in official Screeps sim. | Runtime API differences, manually placed source/spawn lifecycle, visible spawning creeps. | Exhaustive regression; keep this bounded and scripted. |
| Command evidence | Capture stable `global.cmd` tokens and bounded Memory facts. | Operator troubleshooting and acceptance checks. | Full console snapshots, secrets, or raw unbounded Memory dumps. |

## Template

Add a matrix like this to future `PLAN.md`, `SUMMARY.md`, or `VERIFICATION.md` files when the phase has runtime risk:

```markdown
## Verification Matrix

| Requirement / Risk | Unit Evidence | Integration Evidence | Real Sim / Manual Evidence | Command Evidence | Status |
| ------------------ | ------------- | -------------------- | -------------------------- | ---------------- | ------ |
| Spawn queue recoverable waits do not stay queued | `npm run test-unit -- --grep "spawn lifecycle"` | `npm run test-integration -- --grep "official-sim-style bootstrap"` | Official sim: spawn energy wait recovers after energy restore | `cmd.spawn.status()`, `cmd.spawn.queue()` show `waiting` then `spawning`/`spawned` | PASS |
```

Keep rows traceable to requirements or concrete risks. Avoid rows that only say "tests pass" without naming what those tests prove.

## Minimum Expectations

- Runtime-affecting phases should include at least unit and integration evidence.
- Changes touching official sim behavior should include a bounded real sim UAT checklist or explicitly document why manual sim is not applicable.
- Memory migrations should include old-version, current-version partial, and malformed-but-repairable state coverage.
- Command output should be asserted by stable tokens, not by full rendered snapshots.
- A known environment limitation is acceptable only when it is documented with a reproducible workaround or manual check.

## Spawn Lifecycle Example

The Phase 6 and post-v1.0 spawn lifecycle work uses this evidence split:

| Risk | Evidence |
| ---- | -------- |
| Recoverable `ERR_NOT_ENOUGH_ENERGY` / `ERR_BUSY` should not consume attempts or stay `queued`. | Unit lifecycle matrix and official-sim-style integration energy-wait tests. |
| Waiting requests must re-enter dry-run before real spawn. | Unit test for `waiting -> validated -> spawning`. |
| Visible Screeps sim creeps can still have `creep.spawning === true`. | Unit and integration tests distinguish `spawning` from terminal `spawned`. |
| A dead spawned bootstrap creep should be replenished when visible population falls below target. | Explicit bootstrap spawn demand unit test for terminal request replacement. |
| Operators should not inspect raw Memory first. | `cmd.spawn.status()` and `cmd.spawn.queue()` are the preferred evidence surface; richer diagnostics are a follow-up when current tokens are insufficient. |

## Review Checklist

Before marking a phase or quick task complete:

1. Every must-have has at least one evidence row.
2. The matrix includes the highest-risk environment for the change.
3. Manual checks use exact commands and observable outcomes.
4. Any skipped evidence has a reason and a follow-up.
5. Verification commands were run fresh after the final code/doc change.
