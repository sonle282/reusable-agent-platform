const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let index = 0; index < a.length; index++) different |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return different === 0;
}

export async function hashPassword(password: string, salt = randomToken(18), iterations = 100_000) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    key,
    256,
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt, iterations };
}

export async function verifyPassword(password: string, salt: string, iterations: number, expected: string) {
  const result = await hashPassword(password, salt, iterations);
  return constantTimeEqual(result.hash, expected);
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), keyVersion: 1 };
}

export async function decryptCredential(ciphertext: string, iv: string, secret: string) {
  const ivBytes = base64ToBytes(iv);
  const ciphertextBytes = base64ToBytes(ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes.buffer as ArrayBuffer },
    await encryptionKey(secret),
    ciphertextBytes.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
}

export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
