import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type GeneratedApiKey = {
  plaintext: string;
  keyPrefix: string;
  hash: string;
  salt: string;
};

export type ParsedApiKey = {
  prefix: string;
  keyPrefix: string;
};

const KEY_PREFIX_BYTES = 8;
const KEY_SECRET_BYTES = 32;
const KEY_SALT_BYTES = 16;
const HASH_BYTES = 64;

export function generateApiKey(prefix = "mlb"): GeneratedApiKey {
  const keyPrefix = randomBytes(KEY_PREFIX_BYTES).toString("hex");
  const secret = randomBytes(KEY_SECRET_BYTES).toString("base64url");
  const plaintext = `${prefix}_${keyPrefix}_${secret}`;
  const salt = randomBytes(KEY_SALT_BYTES).toString("base64url");

  return {
    plaintext,
    keyPrefix,
    salt,
    hash: hashApiKey(plaintext, salt)
  };
}

export function parseApiKey(value: string, expectedPrefix = "mlb"): ParsedApiKey | null {
  const [prefix, keyPrefix, ...secretParts] = value.split("_");

  if (prefix !== expectedPrefix || !keyPrefix || secretParts.length === 0) {
    return null;
  }

  return { prefix, keyPrefix };
}

export function hashApiKey(plaintext: string, salt: string) {
  return scryptSync(plaintext, salt, HASH_BYTES).toString("base64url");
}

export function verifyApiKey(plaintext: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashApiKey(plaintext, salt), "base64url");
  const expected = Buffer.from(expectedHash, "base64url");

  if (actual.byteLength !== expected.byteLength) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function redactApiKey(plaintext: string) {
  const parsed = parseApiKey(plaintext, plaintext.split("_")[0] ?? "mlb");

  if (!parsed) {
    return "mlb_***";
  }

  return `${parsed.prefix}_${parsed.keyPrefix}_***`;
}
