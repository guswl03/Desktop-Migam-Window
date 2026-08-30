import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function reconstructScanlines(inflated, width, height) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const expectedLength = (stride + 1) * height;
  if (inflated.length !== expectedLength) {
    throw new Error(`unexpected decompressed PNG length: ${inflated.length} != ${expectedLength}`);
  }

  const pixels = new Uint8Array(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - stride] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[rowOffset + x - stride - bytesPerPixel]
        : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + above;
      else if (filter === 3) value = raw + Math.floor((left + above) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, above, upperLeft);
      else throw new Error(`unsupported PNG filter: ${filter}`);
      pixels[rowOffset + x] = value & 0xff;
    }
    sourceOffset += stride;
  }
  return pixels;
}

export async function readPngRgba(path) {
  const buffer = await readFile(path);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${path}: invalid PNG signature`);
  }

  let offset = 8;
  let header;
  const imageChunks = [];
  let sawEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > buffer.length) throw new Error(`${path}: truncated PNG chunk`);
    const type = buffer.toString("ascii", typeStart, dataStart);
    const expectedCrc = buffer.readUInt32BE(crcOffset);
    const actualCrc = crc32(buffer.subarray(typeStart, dataEnd));
    if (expectedCrc !== actualCrc) throw new Error(`${path}: invalid ${type} CRC`);

    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      if (length !== 13) throw new Error(`${path}: invalid IHDR length`);
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      imageChunks.push(data);
    } else if (type === "IEND") {
      sawEnd = true;
      break;
    }
    offset = crcOffset + 4;
  }

  if (!header || !sawEnd || imageChunks.length === 0) {
    throw new Error(`${path}: incomplete PNG`);
  }
  if (
    header.bitDepth !== 8 ||
    header.colorType !== 6 ||
    header.compression !== 0 ||
    header.filter !== 0 ||
    header.interlace !== 0
  ) {
    throw new Error(
      `${path}: expected non-interlaced 8-bit RGBA PNG, got depth=${header.bitDepth} color=${header.colorType} interlace=${header.interlace}`,
    );
  }

  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(imageChunks));
  } catch (error) {
    throw new Error(`${path}: invalid compressed PNG data`, { cause: error });
  }
  return {
    width: header.width,
    height: header.height,
    pixels: reconstructScanlines(inflated, header.width, header.height),
  };
}

export function visibleBounds(pixels, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}
