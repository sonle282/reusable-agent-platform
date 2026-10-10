import { describe, expect, it } from "vitest";
import { constantTimeEqual, decryptCredential, encryptCredential, hashPassword, hmacHex, verifyPassword } from "../src/worker/security/crypto";

describe("credential and password security", () => {
  it("round-trips AES-GCM credentials without plaintext storage", async () => {
    const encrypted = await encryptCredential("sk-secret-value", "a-long-encryption-key");
    expect(encrypted.ciphertext).not.toContain("secret");
    await expect(decryptCredential(encrypted.ciphertext, encrypted.iv, "a-long-encryption-key")).resolves.toBe("sk-secret-value");
    await expect(decryptCredential(encrypted.ciphertext, encrypted.iv, "wrong-key")).rejects.toThrow();
  });

  it("hashes and verifies passwords", async () => {
    const result = await hashPassword("a sufficiently long password", "fixed-test-salt", 1_000);
    await expect(verifyPassword("a sufficiently long password", result.salt, result.iterations, result.hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", result.salt, result.iterations, result.hash)).resolves.toBe(false);
  });

  it("produces stable HMAC signatures", async () => {
    const signature = await hmacHex("secret", "payload");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    await expect(constantTimeEqual(signature, await hmacHex("secret", "payload"))).resolves.toBe(true);
  });
});

