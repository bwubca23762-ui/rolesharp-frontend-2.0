import mammoth from "mammoth";
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) process.exit(2);

const bytes = await readFile(file);
const out = await mammoth.extractRawText({ buffer: bytes });
const text = String(out.value || "");
if (text.length > 1_000_000) {
  process.stderr.write("expanded_text_too_large\n");
  process.exit(3);
}
process.stdout.write(text);
