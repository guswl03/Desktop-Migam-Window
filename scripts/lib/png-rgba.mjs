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

export function analyzePngSemantics(
  { width, height, pixels },
  {
    visibleAlpha = 16,
    dustAlpha = 32,
    minimumSpan = 56,
    minimumComponentPixels = 16,
  } = {},
) {
  const bounds = visibleBoundsAtAlpha(pixels, width, height, visibleAlpha);
  let visiblePixels = 0;
  let lowAlphaPixels = 0;
  let alphaDustPixels = 0;
  const visible = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const alpha = pixels[index * 4 + 3];
    if (alpha > 0 && alpha < dustAlpha) lowAlphaPixels += 1;
    if (alpha < visibleAlpha) continue;
    visible[index] = 1;
    visiblePixels += 1;
  }

  for (let index = 0; index < width * height; index += 1) {
    const alpha = pixels[index * 4 + 3];
    if (alpha === 0 || alpha >= dustAlpha) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    let attachedToVisiblePixel = false;
    for (let dy = -1; dy <= 1 && !attachedToVisiblePixel; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        if (visible[nextY * width + nextX]) {
          attachedToVisiblePixel = true;
          break;
        }
      }
    }
    if (!attachedToVisiblePixel) alphaDustPixels += 1;
  }

  const components = connectedAlphaComponents(visible, width, height);
  const isolatedComponents = components
    .filter((component) => component.pixels < minimumComponentPixels)
    .sort((left, right) => right.pixels - left.pixels);
  const edgeMargins = bounds
    ? {
        left: bounds.left,
        top: bounds.top,
        right: width - 1 - bounds.right,
        bottom: height - 1 - bounds.bottom,
      }
    : null;
  const warnings = [];

  if (!bounds) {
    warnings.push("empty");
  } else {
    const spanX = bounds.right - bounds.left + 1;
    const spanY = bounds.bottom - bounds.top + 1;
    if (Object.values(edgeMargins).some((margin) => margin === 0)) {
      warnings.push("edge-contact");
    }
    if (Math.max(spanX, spanY) < minimumSpan) warnings.push("undersized");
  }
  if (alphaDustPixels > 0) warnings.push("alpha-dust");
  if (isolatedComponents.length > 0) warnings.push("isolated-specks");

  return {
    bounds,
    edgeMargins,
    opaqueRatio: visiblePixels / (width * height),
    lowAlphaPixels,
    alphaDustPixels,
    isolatedComponents,
    warnings,
  };
}

function visibleBoundsAtAlpha(pixels, width, height, visibleAlpha) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] < visibleAlpha) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function connectedAlphaComponents(visible, width, height) {
  const visited = new Uint8Array(visible.length);
  const components = [];
  const neighbors = [-1, 0, 1];

  for (let start = 0; start < visible.length; start += 1) {
    if (!visible[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let cursor = 0;
    let pixels = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    while (cursor < queue.length) {
      const index = queue[cursor];
      cursor += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      pixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);

      for (const dy of neighbors) {
        for (const dx of neighbors) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (!visible[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push({ pixels, bounds: { left, top, right, bottom } });
  }
  return components;
}
