export const StrategyMode = {
  manual: "manual",
  assisted: "assisted",
  automatic: "automatic"
} as const;

export type StrategyMode = typeof StrategyMode[keyof typeof StrategyMode];
