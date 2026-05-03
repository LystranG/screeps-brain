export const ProcessName = {
  kernel: "kernel",
  lifecycle: "lifecycle",
  migration: "migration",
  environment: "environment",
  colony: "colony",
  spawn: "spawn",
  cleanup: "cleanup",
  stats: "stats"
} as const;

export type ProcessName = typeof ProcessName[keyof typeof ProcessName];
