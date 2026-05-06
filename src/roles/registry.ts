import { ColonyContext } from "colony/types";
import { RoleName } from "constants/roles";
import { RuntimeServices } from "runtime/services";
import { runCreepTask } from "tasks/executor";

export interface RoleRunResult {
  ok: boolean;
  status: "ok" | "blocked" | "error";
  reason: string;
}

export interface RoleRunnerContext {
  colony: ColonyContext;
  services: RuntimeServices;
  game: Game;
  tick: number;
}

export type RoleRunner = (creep: Creep, context: RoleRunnerContext) => RoleRunResult;

export interface RoleDefinition {
  name: RoleName;
  description: string;
  run: RoleRunner;
}

export interface RoleRegistry {
  get(roleName: string): RoleDefinition | undefined;
  list(): readonly RoleDefinition[];
  run(roleName: string, creep: Creep, context: RoleRunnerContext): RoleRunResult;
}

const DEFERRED_ROLE_REASON = "role behavior deferred to Phase 6";

export function createDefaultRoleRegistry(): RoleRegistry {
  return createRoleRegistry([
    createTaskExecutingRole(RoleName.worker),
    createTaskExecutingRole(RoleName.harvester),
    createTaskExecutingRole(RoleName.upgrader),
    createDeferredRole(RoleName.builder)
  ]);
}

function createRoleRegistry(definitions: readonly RoleDefinition[]): RoleRegistry {
  return {
    get(roleName: string): RoleDefinition | undefined {
      return definitions.find(definition => definition.name === roleName);
    },

    list(): readonly RoleDefinition[] {
      return definitions;
    },

    run(roleName: string, creep: Creep, context: RoleRunnerContext): RoleRunResult {
      const definition = this.get(roleName);

      if (definition === undefined) {
        return {
          ok: false,
          status: "blocked",
          reason: `unknown role: ${roleName}`
        };
      }

      return definition.run(creep, context);
    }
  };
}

function createDeferredRole(name: RoleName): RoleDefinition {
  return {
    name,
    description: DEFERRED_ROLE_REASON,
    // Phase 4 只建立分发边界；具体 creep 行为必须等 Phase 6 在任务/进程层接入。
    run(): RoleRunResult {
      return {
        ok: true,
        status: "blocked",
        reason: DEFERRED_ROLE_REASON
      };
    }
  };
}

function createTaskExecutingRole(name: RoleName): RoleDefinition {
  return {
    name,
    description: "execute assigned creep task memory",
    run: runCreepTask
  };
}
