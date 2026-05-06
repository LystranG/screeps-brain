import { runBootstrapExecution } from "bootstrap/runner";
import { ProcessDefinition, ProcessDefinitionResult, ProcessRunResult, ProcessRunnerContext } from "processes/types";
import { RoleRegistry, createDefaultRoleRegistry } from "roles/registry";
import { ColonyContext } from "colony/types";
import { ProcessMemory } from "memory/schema";
import { ProcessName } from "constants/processes";
import { RuntimeServices } from "runtime/services";
import { runStrategyPlanning } from "strategy/runner";

export function runProcessDefinitions(
  contexts: readonly ColonyContext[],
  services: RuntimeServices,
  memory: Memory,
  game: Game,
  tick: number,
  definitions: readonly ProcessDefinition[]
): ProcessRunResult[] {
  const sortedDefinitions = [...definitions].sort((left, right) => left.priority - right.priority);
  const runnerContext: ProcessRunnerContext = {
    contexts,
    services,
    memory,
    game,
    tick
  };

  return sortedDefinitions.map(definition => runSingleProcess(definition, runnerContext));
}

export function createDefaultProcessDefinitions(roleRegistry: RoleRegistry = createDefaultRoleRegistry()): ProcessDefinition[] {
  return [
    {
      id: ProcessName.colonyIntel,
      name: ProcessName.colonyIntel,
      enabled: true,
      priority: 10,
      cadence: 5,
      run(context: ProcessRunnerContext): ProcessDefinitionResult {
        return {
          status: "ok",
          message: `observed ${context.contexts.length} colonies`
        };
      }
    },
    {
      id: ProcessName.strategyPlanning,
      name: ProcessName.strategyPlanning,
      enabled: true,
      priority: 15,
      cadence: 1,
      run(context: ProcessRunnerContext): ProcessDefinitionResult {
        const summary = runStrategyPlanning(context.contexts, context.memory, context.tick);

        return {
          status: "ok",
          message: `strategy refreshed=${summary.refreshed} skipped=${summary.skipped} errors=${summary.errors.length}`
        };
      }
    },
    {
      id: ProcessName.bootstrapExecution,
      name: ProcessName.bootstrapExecution,
      enabled: true,
      priority: 18,
      cadence: 1,
      run(context: ProcessRunnerContext): ProcessDefinitionResult {
        const summary = runBootstrapExecution(context.contexts, context.memory, context.tick);

        return {
          status: "ok",
          message: `bootstrap colonies=${summary.colonies} slots=${summary.slots} spawn=${summary.spawnRequestsCreated} duplicate=${summary.spawnRequestsDuplicate} tasks=${summary.tasksAssigned} blocked=${summary.blocked}`
        };
      }
    },
    {
      id: ProcessName.creepRoles,
      name: ProcessName.creepRoles,
      enabled: true,
      priority: 20,
      cadence: 1,
      run(context: ProcessRunnerContext): ProcessDefinitionResult {
        const dispatchMessages: string[] = [];

        for (const colony of context.contexts) {
          for (const creep of colony.creeps) {
            const roleName = creep.memory.role;

            if (roleName === undefined) {
              dispatchMessages.push(`${creep.name ?? "unnamed"} missing role`);
              continue;
            }

            const result = roleRegistry.run(roleName, creep, {
              colony,
              services: context.services,
              game: context.game,
              tick: context.tick
            });

            if (!result.ok) {
              dispatchMessages.push(result.reason);
            }
          }
        }

        return {
          status: "ok",
          message: dispatchMessages.length === 0 ? "creep roles dispatched" : dispatchMessages.join("; ")
        };
      }
    }
  ];
}

function runSingleProcess(definition: ProcessDefinition, context: ProcessRunnerContext): ProcessRunResult {
  const state = ensureProcessMemory(context.memory, definition);

  if (!state.enabled) {
    state.lastStatus = "skipped";

    return {
      processId: definition.id,
      status: "skipped",
      message: "process disabled"
    };
  }

  if (state.nextRunTick > context.tick) {
    state.lastStatus = "skipped";

    return {
      processId: definition.id,
      status: "skipped",
      message: `nextRunTick ${state.nextRunTick} is greater than current tick ${context.tick}`
    };
  }

  try {
    const result = definition.run(context);

    state.lastRunTick = context.tick;
    state.lastStatus = result.status;
    state.lastResult = result.message;
    state.lastError = null;
    state.nextRunTick = context.tick + state.cadence;

    return {
      processId: definition.id,
      ...result
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown process failure";

    state.lastRunTick = context.tick;
    state.lastStatus = "error";
    state.lastResult = null;
    state.lastError = message;
    state.nextRunTick = context.tick + state.cadence;

    return {
      processId: definition.id,
      status: "error",
      message
    };
  }
}

function ensureProcessMemory(memory: Memory, definition: ProcessDefinition): ProcessMemory {
  if (memory.processes[definition.id] === undefined) {
    memory.processes[definition.id] = {
      id: definition.id,
      name: definition.name,
      enabled: definition.enabled,
      priority: definition.priority,
      cadence: definition.cadence,
      nextRunTick: 0,
      lastRunTick: null,
      lastResult: null,
      lastError: null
    };
  }

  return memory.processes[definition.id];
}
