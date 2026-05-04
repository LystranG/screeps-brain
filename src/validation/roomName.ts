import { ValidationResult } from "validation/results";

/**
 * Phase 1 只做轻量格式保护：后续阶段再接入更严格的 Screeps 房间名规则。
 */
export function validateRoomName(value: string): ValidationResult<string> {
  const roomName = value.trim();

  if (roomName.length === 0) {
    return { ok: false, reason: "Room name must be a non-empty string" };
  }

  return { ok: true, value: roomName };
}
