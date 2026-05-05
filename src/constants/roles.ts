export const RoleName = {
  worker: "worker",
  harvester: "harvester",
  upgrader: "upgrader",
  builder: "builder"
} as const;

export type RoleName = typeof RoleName[keyof typeof RoleName];
