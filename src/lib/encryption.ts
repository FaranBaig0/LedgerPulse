import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for standard GCM IV
const AUTH_TAG_LENGTH = 16;

const RAW_SECRET = process.env.ENCRYPTION_SECRET || "0123456789abcdef0123456789abcdef";

/**
 * Gets a 32-byte Buffer key from ENCRYPTION_SECRET environment variable
 */
function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(RAW_SECRET).digest();
}

/**
 * Encrypt plaintext string using AES-256-GCM
 * Returns string formatted as `iv_hex:auth_tag_hex:encrypted_hex`
 */
export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Decrypt string encrypted with AES-256-GCM
 */
export function decryptToken(encryptedString: string): string {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format. Expected 'iv:authTag:ciphertext'");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
