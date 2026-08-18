import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type RebelSessionPayload = {
  accountId: number;
  username: string;
  displayName: string;
  role: "user" | "owner";
  expiresAt: number;
};

type EncryptedValue = { ciphertext: string; iv: string; authTag: string };

const base64Url = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const decodeBase64Url = (value: string) => Buffer.from(value, "base64url");

function signingSecret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is required for Rebel AI account sessions");
  return value;
}

function signature(payload: string) {
  return base64Url(createHmac("sha256", signingSecret()).update(payload).digest());
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt-v1$${base64Url(salt)}$${base64Url(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, saltValue, hashValue] = storedHash.split("$");
  if (scheme !== "scrypt-v1" || !saltValue || !hashValue) return false;
  const expected = decodeBase64Url(hashValue);
  const candidate = await scrypt(password, decodeBase64Url(saltValue), expected.length) as Buffer;
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function createRebelSession(payload: Omit<RebelSessionPayload, "expiresAt">) {
  const data: RebelSessionPayload = { ...payload, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const encoded = base64Url(JSON.stringify(data));
  return `${encoded}.${signature(encoded)}`;
}

export function verifyRebelSession(token?: string | null): RebelSessionPayload | null {
  if (!token) return null;
  const [encoded, tokenSignature] = token.split(".");
  if (!encoded || !tokenSignature) return null;
  const expected = signature(encoded);
  if (expected.length !== tokenSignature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(tokenSignature))) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded).toString("utf8")) as RebelSessionPayload;
    if (!Number.isInteger(parsed.accountId) || !parsed.username || !parsed.displayName || !parsed.role || parsed.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encryptionKey() {
  return createHmac("sha256", signingSecret()).update("rebel-ai-provider-key-v1").digest();
}

export function encryptProviderKey(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: base64Url(ciphertext), iv: base64Url(iv), authTag: base64Url(cipher.getAuthTag()) };
}

export function decryptProviderKey(value: EncryptedValue) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), decodeBase64Url(value.iv));
  decipher.setAuthTag(decodeBase64Url(value.authTag));
  return Buffer.concat([decipher.update(decodeBase64Url(value.ciphertext)), decipher.final()]).toString("utf8");
}
