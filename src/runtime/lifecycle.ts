// 生命周期顺序是内核的稳定契约，后续阶段只能在这里显式调整。
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
