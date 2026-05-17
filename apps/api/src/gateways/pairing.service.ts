import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateAuthToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyToken(token: string, expectedHash: string): boolean {
  return hashToken(token) === expectedHash;
}

export function normalizeMac(raw: string): string {
  return raw.replace(/-/g, ":").toUpperCase();
}
