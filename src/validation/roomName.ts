import { ValidationResult } from "validation/results";

export function validateRoomName(value: string): ValidationResult<string> {
  const roomName = value.trim();

  if (roomName.length === 0) {
    return { ok: false, reason: "Room name must be a non-empty string" };
  }

  return { ok: true, value: roomName };
}
