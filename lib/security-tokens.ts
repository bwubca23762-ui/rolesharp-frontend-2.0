import { createHash } from "crypto";

export function digestOneTimeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
