import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { createRandomId } from "../random-id";

export type MediaStorageWriteInput = {
  fileName: string;
  buffer: Buffer;
};

export type MediaStorageWriteResult = {
  storageKey: string;
  fileName: string;
  absolutePath: string;
};

export interface MediaStorageProvider {
  write(input: MediaStorageWriteInput): Promise<MediaStorageWriteResult>;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildStoredFileName(originalFileName: string): string {
  const fileId = createRandomId();
  return `${fileId}-${sanitizeFileName(originalFileName)}`;
}

export class LocalMediaStorageProvider implements MediaStorageProvider {
  async write(input: MediaStorageWriteInput): Promise<MediaStorageWriteResult> {
    const resolvedFileName = buildStoredFileName(input.fileName);
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const absolutePath = path.join(uploadDir, resolvedFileName);
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey: `/uploads/${resolvedFileName}`,
      fileName: resolvedFileName,
      absolutePath,
    };
  }
}

export type MediaStorageProviderType = "LOCAL";

export function getMediaStorageProviderType(raw = process.env.MEDIA_STORAGE_PROVIDER): MediaStorageProviderType {
  if (String(raw ?? "").trim().toUpperCase() === "LOCAL") {
    return "LOCAL";
  }
  return "LOCAL";
}

export function getMediaStorageProvider(): MediaStorageProvider {
  const providerType = getMediaStorageProviderType();
  if (providerType === "LOCAL") {
    return new LocalMediaStorageProvider();
  }
  return new LocalMediaStorageProvider();
}
