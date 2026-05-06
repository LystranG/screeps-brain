export const StrategyMode = {
  manual: "manual",
  assisted: "assisted",
  automatic: "automatic"
} as const;

export type StrategyMode = typeof StrategyMode[keyof typeof StrategyMode];

export const StrategyIntentType = {
  maintainWorkerCoverage: "maintainWorkerCoverage",
  prioritizeUpgrade: "prioritizeUpgrade",
  allowBasicConstruction: "allowBasicConstruction",
  repairCriticalStructures: "repairCriticalStructures",
  defenseWatch: "defenseWatch",
  deferExpansion: "deferExpansion",
  deferRemoteMining: "deferRemoteMining",
  deferMarket: "deferMarket",
  deferWarfare: "deferWarfare",
  deferLargeFortification: "deferLargeFortification"
} as const;

export type StrategyIntentType = typeof StrategyIntentType[keyof typeof StrategyIntentType];

export const StrategyIntentStatus = {
  allowed: "allowed",
  gated: "gated",
  deferred: "deferred"
} as const;

export type StrategyIntentStatus = typeof StrategyIntentStatus[keyof typeof StrategyIntentStatus];
