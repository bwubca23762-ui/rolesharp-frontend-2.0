import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { jobsWorkflowConfig, type JobsWorkflowConfig } from "../jobs-workflow/config";

export type MailProvider = "google" | "microsoft";

export type MailTokenContext = {
  userId: string;
  connectionId: string;
  provider: MailProvider;
  providerTenant: string;
  providerSubject: string;
  connectionGeneration: number;
};

export type EncryptedSecret = {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
  keyVersion: number;
  aad: string;
};

export function mailTokenAad(context: MailTokenContext, keyVersion: number): string {
  if (!Number.isInteger(context.connectionGeneration) || context.connectionGeneration <= 0) {
    throw new Error("connection generation must be a positive integer");
  }
  if (!Number.isInteger(keyVersion) || keyVersion <= 0) throw new Error("key version must be a positive integer");
  return [
    "rolesharp-mail-v1",
    `user=${context.userId}`,
    `connection=${context.connectionId}`,
    `provider=${context.provider}`,
    `tenant=${context.providerTenant}`,
    `subject=${context.providerSubject}`,
    `generation=${context.connectionGeneration}`,
    `key=${keyVersion}`,
  ].join("|");
}

function keyFor(config: JobsWorkflowConfig, version: number): Buffer {
  const key = config.mailTokenKeys.get(version);
  if (!key) throw new Error("mail token key is unavailable");
  return key;
}

export function encryptSecret(
  plaintext: string,
  aad: string,
  config: JobsWorkflowConfig = jobsWorkflowConfig(),
  keyVersion = config.activeKeyVersion,
): EncryptedSecret {
  if (!plaintext) throw new Error("secret cannot be empty");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(config, keyVersion), nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag(), keyVersion, aad };
}

export function decryptSecret(
  encrypted: Pick<EncryptedSecret, "ciphertext" | "nonce" | "tag" | "keyVersion">,
  aad: string,
  config: JobsWorkflowConfig = jobsWorkflowConfig(),
): string {
  if (encrypted.nonce.length !== 12 || encrypted.tag.length !== 16) throw new Error("invalid encrypted secret envelope");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(config, encrypted.keyVersion), encrypted.nonce);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString("utf8");
}

export function encryptRefreshToken(
  token: string,
  context: MailTokenContext,
  config: JobsWorkflowConfig = jobsWorkflowConfig(),
): EncryptedSecret {
  const aad = mailTokenAad(context, config.activeKeyVersion);
  const encrypted = encryptSecret(token, aad, config);
  const aadDigest = createHash("sha256").update(aad, "utf8").digest();
  return { ...encrypted, ciphertext: Buffer.concat([aadDigest, encrypted.ciphertext]) };
}

export function decryptRefreshToken(
  encrypted: Pick<EncryptedSecret, "ciphertext" | "nonce" | "tag" | "keyVersion">,
  context: MailTokenContext,
  config: JobsWorkflowConfig = jobsWorkflowConfig(),
): string {
  const aad = mailTokenAad(context, encrypted.keyVersion);
  if (encrypted.ciphertext.length < 33) throw new Error("invalid refresh credential envelope");
  const expectedDigest = createHash("sha256").update(aad, "utf8").digest();
  const actualDigest = encrypted.ciphertext.subarray(0, 32);
  if (!timingSafeEqual(expectedDigest, actualDigest)) throw new Error("refresh credential AAD mismatch");
  return decryptSecret({ ...encrypted, ciphertext: encrypted.ciphertext.subarray(32) }, aad, config);
}

export function rotateRefreshToken(
  encrypted: Pick<EncryptedSecret, "ciphertext" | "nonce" | "tag" | "keyVersion">,
  context: MailTokenContext,
  config: JobsWorkflowConfig = jobsWorkflowConfig(),
): EncryptedSecret {
  const plaintext = decryptRefreshToken(encrypted, context, config);
  return encryptRefreshToken(plaintext, context, config);
}
