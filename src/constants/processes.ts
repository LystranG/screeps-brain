export const ProcessName = {
  kernel: "kernel",
  lifecycle: "lifecycle",
  migration: "migration",
  environment: "environment",
  colony: "colony",
  colonyIntel: "colonyIntel",
  creepRoles: "creepRoles",
  spawn: "spawn",
  spawnValidation: "spawnValidation",
  strategyPlanning: "strategyPlanning",
  cleanup: "cleanup",
  stats: "stats"
} as const;

export type ProcessName = typeof ProcessName[keyof typeof ProcessName];
