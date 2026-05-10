// v2.0 集成测试场景定义。每个 IntegrationScenario 描述一种初始游戏状态，供集成测试用例组装。

import { IntegrationScenario, IntegrationTestHelper } from "./helper";

/**
 * HighCommand 冷启动场景：单个已拥有房间 W0N1，RCL 1。
 * 用于验证 HighCommand 初始化、Garrison 创建、首个 spawn 请求。
 */
export const HighCommandBootScenario: IntegrationScenario = {
  name: "highcommand-boot",
  roomName: "W0N1",
  async setup(helper: IntegrationTestHelper): Promise<void> {
    await helper.setupOwnedRoom("W0N1");
  }
};

// TODO(Phase 12+): 添加 GarrisonExpansionScenario（多房间扩张场景）
// TODO(Phase 18): 添加 CombatResponseScenario（防御响应场景）
