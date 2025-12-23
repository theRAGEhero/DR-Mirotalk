import crypto from "crypto";
import type { Meeting } from "@prisma/client";

export function generateRoomId() {
  return crypto.randomBytes(16).toString("base64url");
}

export function generateTempPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

export function isMeetingActive(meeting: Pick<Meeting, "isActive" | "expiresAt">) {
  if (!meeting.isActive) return false;
  if (!meeting.expiresAt) return true;
  return meeting.expiresAt.getTime() > Date.now();
}

export function formatDateTime(value: Date | null) {
  if (!value) return "No expiry";
  return value.toLocaleString();
}
