const MAX_DOCX_ENTRIES = 256;
const MAX_DOCX_UNCOMPRESSED = 40 * 1024 * 1024;
const MAX_DOCX_ENTRY = 12 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 500;

export type ResumeFileKind = "pdf" | "docx" | "txt";

const allowedMime: Record<ResumeFileKind, Set<string>> = {
  pdf: new Set(["application/pdf"]),
  docx: new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  txt: new Set(["text/plain"]),
};

function extension(name: string): ResumeFileKind | "" {
  const part = name.toLowerCase().split(".").pop();
  return part === "pdf" || part === "docx" || part === "txt" ? part as ResumeFileKind : "";
}

function validateDocxArchive(bytes: Buffer) {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("invalid_docx_signature");
  }

  const searchStart = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("invalid_docx_directory");

  const disk = bytes.readUInt16LE(eocd + 4);
  const directoryDisk = bytes.readUInt16LE(eocd + 6);
  const entriesOnDisk = bytes.readUInt16LE(eocd + 8);
  const entries = bytes.readUInt16LE(eocd + 10);
  const directorySize = bytes.readUInt32LE(eocd + 12);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (disk !== 0 || directoryDisk !== 0 || entries !== entriesOnDisk || entries < 2 || entries > MAX_DOCX_ENTRIES) {
    throw new Error("unsafe_docx_directory");
  }
  if (directoryOffset + directorySize > eocd || directoryOffset > bytes.length) {
    throw new Error("invalid_docx_directory_bounds");
  }

  let offset = directoryOffset;
  let total = 0;
  let hasContentTypes = false;
  let hasDocument = false;
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > eocd || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("invalid_docx_entry");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || (flags & 1) !== 0 || (method !== 0 && method !== 8)) throw new Error("unsafe_docx_entry");
    if (uncompressed > MAX_DOCX_ENTRY) throw new Error("docx_entry_too_large");
    if (compressed === 0 && uncompressed > 0) throw new Error("unsafe_docx_ratio");
    if (compressed > 0 && uncompressed / compressed > MAX_COMPRESSION_RATIO) throw new Error("unsafe_docx_ratio");
    total += uncompressed;
    if (total > MAX_DOCX_UNCOMPRESSED) throw new Error("docx_too_large");

    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8").replace(/\\/g, "/");
    if (!name || name.startsWith("/") || name.split("/").includes("..") || name.includes("\0")) throw new Error("unsafe_docx_path");
    if (name === "[Content_Types].xml") hasContentTypes = true;
    if (name === "word/document.xml") hasDocument = true;
    offset = end;
  }
  if (offset !== directoryOffset + directorySize || !hasContentTypes || !hasDocument) throw new Error("not_a_docx");
}

function validateText(bytes: Buffer) {
  if (bytes.includes(0)) throw new Error("invalid_text_file");
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function validateResumeFile(name: string, mime: string, bytes: Buffer): ResumeFileKind {
  const ext = extension(name);
  if (!ext) throw new Error("unsupported_extension");
  const normalizedMime = mime.toLowerCase().split(";", 1)[0].trim();
  if (normalizedMime && normalizedMime !== "application/octet-stream" && !allowedMime[ext].has(normalizedMime)) {
    throw new Error("file_type_mismatch");
  }

  if (ext === "pdf") {
    const header = bytes.subarray(0, Math.min(bytes.length, 1024)).toString("latin1");
    if (!header.startsWith("%PDF-")) throw new Error("invalid_pdf_signature");
  } else if (ext === "docx") {
    validateDocxArchive(bytes);
  } else {
    validateText(bytes);
  }
  return ext;
}
