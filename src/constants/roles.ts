export const RoleName = {
  worker: "worker"
} as const;

export type RoleName = typeof RoleName[keyof typeof RoleName];
