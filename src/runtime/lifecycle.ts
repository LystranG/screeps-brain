export const KERNEL_STAGE_ORDER = [
  "migrate",
  "refreshServices",
  "detectEnvironmentBootstrap",
  "runColoniesAndProcesses",
  "runSpawning",
  "cleanup",
  "flushStats"
] as const;

export type LifecycleStageName = typeof KERNEL_STAGE_ORDER[number];

export interface LifecycleStage {
  name: LifecycleStageName;
  run: () => void;
}
