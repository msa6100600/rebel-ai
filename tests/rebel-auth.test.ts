import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRebelSession, decryptProviderKey, encryptProviderKey, hashPassword, verifyPassword, verifyRebelSession } from "../server/rebel-auth";

describe("Rebel account security helpers", () => {
  beforeEach(() => vi.stubEnv("JWT_SECRET", "test-session-secret-for-rebel-ai"));
  afterEach(() => vi.unstubAllEnvs());

  it("derives and verifies passwords without retaining the plaintext", async () => {
    const stored = await hashPassword("A-strong-passphrase-2026");
    expect(stored).not.toContain("A-strong-passphrase-2026");
    await expect(verifyPassword("A-strong-passphrase-2026", stored)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", stored)).resolves.toBe(false);
  });

  it("signs account sessions and rejects tampering", () => {
    const token = createRebelSession({ accountId: 9, username: "rebeluser", displayName: "مستخدم Rebel", role: "user" });
    expect(verifyRebelSession(token)).toMatchObject({ accountId: 9, username: "rebeluser", role: "user" });
    expect(verifyRebelSession(`${token}tampered`)).toBeNull();
  });

  it("encrypts a provider key and restores it only on the server", () => {
    const encrypted = encryptProviderKey("example-provider-secret-key");
    expect(encrypted.ciphertext).not.toContain("example-provider-secret-key");
    expect(decryptProviderKey(encrypted)).toBe("example-provider-secret-key");
  });
});
