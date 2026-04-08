export type ImageDimensions = { width: number; height: number };

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) {
    return null;
  }

  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) {
    return null;
  }

  return { width, height };
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (offset + 1 >= buffer.length) {
      return null;
    }

    const blockLength = buffer.readUInt16BE(offset);
    if (blockLength < 2 || offset + blockLength > buffer.length) {
      return null;
    }

    const isSof =
      marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
      marker === 0xc5 || marker === 0xc6 || marker === 0xc7 || marker === 0xc9 ||
      marker === 0xca || marker === 0xcb || marker === 0xcd || marker === 0xce ||
      marker === 0xcf;

    if (isSof && blockLength >= 7) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (!width || !height) {
        return null;
      }
      return { width, height };
    }

    offset += blockLength;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");

  if (chunkType === "VP8X") {
    if (buffer.length < 30) {
      return null;
    }
    const width = readUInt24LE(buffer, 24) + 1;
    const height = readUInt24LE(buffer, 27) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (chunkType === "VP8L") {
    if (buffer.length < 25 || buffer[20] !== 0x2f) {
      return null;
    }
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (chunkType === "VP8 ") {
    if (buffer.length < 30) {
      return null;
    }

    for (let i = 20; i + 9 < buffer.length; i += 1) {
      if (buffer[i + 3] === 0x9d && buffer[i + 4] === 0x01 && buffer[i + 5] === 0x2a) {
        const width = buffer.readUInt16LE(i + 6) & 0x3fff;
        const height = buffer.readUInt16LE(i + 8) & 0x3fff;
        return width > 0 && height > 0 ? { width, height } : null;
      }
    }
  }

  return null;
}

export function getImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions | null {
  if (mimeType === "image/png") {
    return parsePngDimensions(buffer);
  }

  if (mimeType === "image/jpeg") {
    return parseJpegDimensions(buffer);
  }

  if (mimeType === "image/webp") {
    return parseWebpDimensions(buffer);
  }

  return null;
}
