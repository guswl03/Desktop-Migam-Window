import { deflateSync } from "node:zlib";

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

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

export function encodePngRgba({ width, height, pixels }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("PNG dimensions must be positive integers");
  }
  if (pixels.length !== width * height * 4) {
    throw new Error(`unexpected RGBA length: ${pixels.length} != ${width * height * 4}`);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const destination = y * (stride + 1);
    scanlines[destination] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride)
      .copy(scanlines, destination + 1);
  }

  return Buffer.concat([
    pngSignature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function thresholdBounds(pixels, width, height, alphaThreshold) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function pixelAt(source, x, y, alphaThreshold) {
  const index = (y * source.width + x) * 4;
  const alpha = source.pixels[index + 3];
  if (alpha <= alphaThreshold) return [0, 0, 0, 0];
  return [
    source.pixels[index],
    source.pixels[index + 1],
    source.pixels[index + 2],
    alpha,
  ];
}

export function normalizeRgbaSprite(source, {
  size = 256,
  padding = 16,
  alphaThreshold = 4,
} = {}) {
  const bounds = thresholdBounds(
    source.pixels,
    source.width,
    source.height,
    alphaThreshold,
  );
  if (!bounds) throw new Error("generated sprite is empty");
  if (padding * 2 >= size) throw new Error("sprite padding leaves no content area");

  const sourceWidth = bounds.right - bounds.left + 1;
  const sourceHeight = bounds.bottom - bounds.top + 1;
  const available = size - padding * 2;
  const scale = Math.min(available / sourceWidth, available / sourceHeight);
  const destinationWidth = Math.max(1, Math.round(sourceWidth * scale));
  const destinationHeight = Math.max(1, Math.round(sourceHeight * scale));
  const offsetX = Math.floor((size - destinationWidth) / 2);
  const offsetY = Math.floor((size - destinationHeight) / 2);
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < destinationHeight; y += 1) {
    const sourceY = Math.min(
      bounds.bottom,
      Math.max(bounds.top, bounds.top + (y + 0.5) / scale - 0.5),
    );
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(bounds.bottom, y0 + 1);
    const fy = sourceY - y0;
    for (let x = 0; x < destinationWidth; x += 1) {
      const sourceX = Math.min(
        bounds.right,
        Math.max(bounds.left, bounds.left + (x + 0.5) / scale - 0.5),
      );
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(bounds.right, x0 + 1);
      const fx = sourceX - x0;
      const samples = [
        [pixelAt(source, x0, y0, alphaThreshold), (1 - fx) * (1 - fy)],
        [pixelAt(source, x1, y0, alphaThreshold), fx * (1 - fy)],
        [pixelAt(source, x0, y1, alphaThreshold), (1 - fx) * fy],
        [pixelAt(source, x1, y1, alphaThreshold), fx * fy],
      ];
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (const [[sampleRed, sampleGreen, sampleBlue, sampleAlpha], weight] of samples) {
        const weightedAlpha = sampleAlpha * weight;
        alpha += weightedAlpha;
        red += sampleRed * weightedAlpha;
        green += sampleGreen * weightedAlpha;
        blue += sampleBlue * weightedAlpha;
      }
      const index = ((offsetY + y) * size + offsetX + x) * 4;
      if (alpha > 0) {
        pixels[index] = Math.round(red / alpha);
        pixels[index + 1] = Math.round(green / alpha);
        pixels[index + 2] = Math.round(blue / alpha);
        pixels[index + 3] = Math.round(alpha);
      }
    }
  }

  return { width: size, height: size, pixels };
}
