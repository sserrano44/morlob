import { createHash } from "node:crypto";

import { env } from "@/lib/config/env";
import { sanitizeFilename } from "@/lib/core/ids";

export async function fileToBuffer(file: File) {
  if (file.size > env.MORLOB_MAX_UPLOAD_BYTES) {
    return null;
  }

  return Buffer.from(await file.arrayBuffer());
}

export function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildStoragePath(input: {
  organizationPublicId: string;
  workspacePublicId: string;
  filePublicId: string;
  filename: string;
}) {
  return [
    input.organizationPublicId,
    input.workspacePublicId,
    input.filePublicId,
    sanitizeFilename(input.filename)
  ].join("/");
}
