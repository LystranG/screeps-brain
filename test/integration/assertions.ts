// v2.0 集成测试断言辅助函数。所有断言函数接受 IntegrationTestHelper，读取 Memory 状态后断言。

import { assert } from "chai";
import { IntegrationTestHelper } from "./helper";

/**
 * 断言 HighCommand 已在指定房间完成初始化（Garrison 已创建）。
 * @param helper - 集成测试助手
 * @param roomName - 目标房间名称（如 "W0N1"）
 */
export async function assertHighCommandInitialized(
  helper: IntegrationTestHelper,
  roomName: string
): Promise<void> {
  const memory = await helper.readMemory();
  assert.isDefined(memory.highCommand, "highCommand Memory section must exist after initialization");
  assert.isDefined(
    memory.highCommand?.garrisons?.[roomName],
    `Garrison for room ${roomName} must be initialized in Memory`
  );
}

// TODO(Phase 13): assertTaskForceExists(helper, roomName, tfType)
// TODO(Phase 12): assertFacilityBuilt(helper, roomName, facilityType)
