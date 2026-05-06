---
phase: 06-minimal-rcl1-bootstrap-loop
reviewed: 2026-05-06T19:27:54Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/bootstrap/runner.ts
  - src/bootstrap/slots.ts
  - src/bootstrap/spawnDemand.ts
  - src/bootstrap/taskAssignment.ts
  - src/commands/namespaces/sim.ts
  - src/commands/namespaces/spawn.ts
  - src/constants/processes.ts
  - src/environment/simBootstrap.ts
  - src/memory/migrations.ts
  - src/memory/schema.ts
  - src/processes/runner.ts
  - src/roles/registry.ts
  - src/runtime/Kernel.ts
  - src/spawning/queue.ts
  - src/spawning/runner.ts
  - src/tasks/executor.ts
  - src/tasks/model.ts
  - test/unit/bootstrapExecution.test.ts
  - test/unit/behaviorPrimitives.test.ts
  - test/unit/commandInspection.test.ts
  - test/unit/kernel.test.ts
  - test/unit/memory.test.ts
  - test/unit/mock.ts
  - test/unit/spawnPrimitives.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
resolved_findings:
  critical: 3
  commit: f7facf8
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-06T19:27:54Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** clean after blocker fixes

## Summary

Reviewed the Phase 06 bootstrap execution, spawn lifecycle, role/task execution, kernel wiring, sim/spawn command inspection, and related unit tests. The original review found three blocking behavioral defects in spawn demand lifecycle and bootstrap population control. These have been fixed and covered by focused regression tests.

Verification run during review:

```bash
rtk npm run test-unit -- --grep "bootstrap execution|spawn primitives|kernel bootstrap matrix"
rtk npm run lint
```

Both commands passed.

## Resolution

**Fix commit:** `f7facf8`

- **CR-01 resolved:** `applyBootstrapSpawnDemand` now deduplicates active requests by stable slot id prefix and removes terminal `spawned`/`failed` requests for that slot before enqueueing a replacement.
- **CR-02 resolved:** bootstrap spawn demand is capped by `targetPopulation - context.stage.creepCount`; task-only slots remain available for existing creeps.
- **CR-03 resolved:** queued dry-run validation treats recoverable `ERR_BUSY` and `ERR_NOT_ENOUGH_ENERGY` as waiting diagnostics through `markSpawnRequestWaiting`, preserving attempts and request status.

Regression coverage was added in `test/unit/bootstrapExecution.test.ts` and `test/unit/spawnPrimitives.test.ts`.

## Critical Issues

### CR-01: [RESOLVED] Terminal bootstrap requests cannot be replaced

**File:** `/Users/lystran/programming/screeps/src/bootstrap/spawnDemand.ts:39`
**Issue:** `applyBootstrapSpawnDemand` only treats `queued`, `validated`, and `spawning` as active duplicates, so a `spawned` or `failed` bootstrap request should be replaceable. However, it then calls `enqueueSpawnRequest`, whose duplicate check rejects any existing request with the same id regardless of terminal status at `src/spawning/queue.ts:57`. The replacement path is therefore impossible: after a slot reaches `spawned` or `failed`, every future bootstrap tick attempts the same stable id, queue rejects it, and the summary records it as a duplicate. This breaks BOOT-02 population maintenance and failure recovery.

**Fix:**

```ts
// One safe option: replace terminal requests before enqueueing a stable slot id.
function removeTerminalRequest(memory: ProjectMemoryShape, roomName: string, requestId: string): void {
  const queue = memory.colonies[roomName]?.spawnQueue;
  if (!queue) {
    return;
  }

  memory.colonies[roomName].spawnQueue = queue.filter(request => {
    return request.id !== requestId || request.status === "queued" || request.status === "validated" || request.status === "spawning";
  });
}
```

Call this before `enqueueSpawnRequest`, or change `enqueueSpawnRequest` to allow replacing terminal `spawned`/`failed` entries explicitly.

### CR-02: [RESOLVED] Bootstrap enqueues more spawn requests than the target population

**File:** `/Users/lystran/programming/screeps/src/bootstrap/slots.ts:73`
**Issue:** `targetPopulation` is calculated as `Math.min(4, Math.max(2, sourceCount + 1))`, but it is only used to create the first two `workerFallback` slots. Source and upgrade slots always receive spawn demand too. In a ready RCL1 room with two sources, `targetPopulation` is `3`, yet the current test asserts five queued spawn requests at `test/unit/bootstrapExecution.test.ts:144`: two fallback workers, two source workers/harvesters, and one upgrader. This violates the Phase 06 population cap and can overproduce creeps before the room has logistics/refill behavior.

**Fix:**

```ts
const spawnEligibleSlots = slots
  .filter(slot => slot.spawn !== null)
  .sort((left, right) => left.priority - right.priority)
  .slice(0, Math.max(0, targetPopulation - context.stage.creepCount));
```

Apply the population cap before emitting spawn demand, while still keeping task-only slots available for existing creeps.

### CR-03: [RESOLVED] Recoverable dry-run energy failures consume attempts and can fail the queue

**File:** `/Users/lystran/programming/screeps/src/spawning/runner.ts:111`
**Issue:** Dry-run failures always call `markSpawnRequestError`, which increments attempts and eventually marks the request `failed`. `ERR_NOT_ENOUGH_ENERGY` is recoverable in this phase's lifecycle contract and should record diagnostics without consuming attempts. This matters after the first real spawn consumes room energy: later queued requests can dry-run while the spawn is idle but energy is temporarily low, then fail after three ticks instead of waiting. Combined with CR-01, the slot can become permanently unable to enqueue replacement demand.

**Fix:**

```ts
if (isRecoverableSpawnCode(returnCode)) {
  markSpawnRequestWaiting(memory, selected.request.roomName, selected.request.id, returnCode, tick);

  return {
    ok: false,
    status: "waiting",
    reason: String(returnCode),
    roomName: selected.context.roomName,
    requestId: selected.request.id,
    spawnName: spawn.name,
    returnCode
  };
}

markSpawnRequestError(memory, selected.request.roomName, selected.request.id, String(returnCode), tick);
```

Use the same recoverable-code classification for dry-run validation as for real spawn scheduling.

---

_Reviewed: 2026-05-06T19:27:54Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
