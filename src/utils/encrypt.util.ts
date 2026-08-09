import { encryptionSecret } from "@/env/env.import.js";
import crypto from "crypto";
import { configDotenv } from "dotenv";

configDotenv()

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const secret = encryptionSecret;

  if (!secret) {
    throw new Error(
      "[encrypt.util] ENCRYPTION_SECRET is not set in environment variables.",
    );
  }

  if (secret.length !== 64) {
    throw new Error(
      "[encrypt.util] ENCRYPTION_SECRET must be exactly 64 hex characters (32 bytes).",
    );
  }

  return Buffer.from(secret, "hex");
}

/**
 * Encrypts a plaintext string.
 * Returns a colon-separated string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");

  if (parts.length !== 3) {
    throw new Error(
      "[encrypt.util] Invalid encrypted text format. Expected iv:authTag:ciphertext",
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}