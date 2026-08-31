const DEFAULT_SIZE = 16;
const DEFAULT_THRESHOLD = 0.08;
const VISIBLE_ALPHA = 16;

function assertDecoded(decoded) {
  if (
    !decoded ||
    !Number.isInteger(decoded.width) ||
    !Number.isInteger(decoded.height) ||
    decoded.width <= 0 ||
    decoded.height <= 0 ||
    decoded.pixels?.length !== decoded.width * decoded.height * 4
  ) {
    throw new TypeError("expected a decoded RGBA sprite");
  }
}

function alphaBounds(decoded) {
  let left = decoded.width;
  let top = decoded.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] < VISIBLE_ALPHA) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function normalizedOccupancy(decoded, size) {
  const bounds = alphaBounds(decoded);
  const occupancy = new Uint8Array(size * size);
  if (!bounds) return occupancy;

  const sourceWidth = bounds.right - bounds.left + 1;
  const sourceHeight = bounds.bottom - bounds.top + 1;
  const sourceSpan = Math.max(sourceWidth, sourceHeight);
  const targetSpan = Math.max(1, size - 2);
  const targetWidth = sourceWidth / sourceSpan * targetSpan;
  const targetHeight = sourceHeight / sourceSpan * targetSpan;
  const offsetX = (size - targetWidth) / 2;
  const offsetY = (size - targetHeight) / 2;

  for (let y = 0; y < size; y += 1) {
    const normalizedY = (y + 0.5 - offsetY) / targetHeight;
    if (normalizedY < 0 || normalizedY >= 1) continue;
    const sourceY = Math.min(
      bounds.bottom,
      bounds.top + Math.floor(normalizedY * sourceHeight),
    );
    for (let x = 0; x < size; x += 1) {
      const normalizedX = (x + 0.5 - offsetX) / targetWidth;
      if (normalizedX < 0 || normalizedX >= 1) continue;
      const sourceX = Math.min(
        bounds.right,
        bounds.left + Math.floor(normalizedX * sourceWidth),
      );
      const alpha = decoded.pixels[(sourceY * decoded.width + sourceX) * 4 + 3];
      occupancy[y * size + x] = alpha >= VISIBLE_ALPHA ? 255 : 0;
    }
  }
  return occupancy;
}

function edgeTransitions(occupancy, size) {
  const edges = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const visible = occupancy[y * size + x] > 0;
      let transitions = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nextX = x + dx;
        const nextY = y + dy;
        const neighborVisible = nextX >= 0 && nextX < size && nextY >= 0 && nextY < size
          ? occupancy[nextY * size + nextX] > 0
          : false;
        if (visible !== neighborVisible) transitions += 1;
      }
      edges[y * size + x] = Math.round(transitions / 4 * 255);
    }
  }
  return edges;
}

export function silhouetteFingerprint(decoded, size = DEFAULT_SIZE) {
  assertDecoded(decoded);
  if (!Number.isInteger(size) || size < 4) {
    throw new RangeError("fingerprint size must be an integer of at least 4");
  }
  const occupancy = normalizedOccupancy(decoded, size);
  const edges = edgeTransitions(occupancy, size);
  const fingerprint = new Uint8Array(occupancy.length + edges.length);
  fingerprint.set(occupancy);
  fingerprint.set(edges, occupancy.length);
  return fingerprint;
}

function fingerprintDistance(left, right) {
  if (left.length !== right.length || left.length % 2 !== 0) {
    throw new TypeError("fingerprints must have equal occupancy and edge sections");
  }
  const cells = left.length / 2;
  let occupancyDifference = 0;
  let occupancyUnion = 0;
  let edgeDifference = 0;
  let edgeUnion = 0;
  for (let index = 0; index < cells; index += 1) {
    occupancyDifference += Math.abs(left[index] - right[index]);
    occupancyUnion += Math.max(left[index], right[index]);
    edgeDifference += Math.abs(left[cells + index] - right[cells + index]);
    edgeUnion += Math.max(left[cells + index], right[cells + index]);
  }
  const occupancyDistance = occupancyUnion === 0 ? 0 : occupancyDifference / occupancyUnion;
  const edgeDistance = edgeUnion === 0 ? 0 : edgeDifference / edgeUnion;
  return 0.75 * occupancyDistance + 0.25 * edgeDistance;
}

export function findNearDuplicateSprites(entries, threshold = DEFAULT_THRESHOLD) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError("similarity threshold must be between 0 and 1");
  }
  const prepared = entries.map(({ id, png }) => ({
    id,
    fingerprint: silhouetteFingerprint(png),
  }));
  const pairs = [];
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
      const left = prepared[leftIndex];
      const right = prepared[rightIndex];
      const distance = fingerprintDistance(left.fingerprint, right.fingerprint);
      if (distance <= threshold) {
        pairs.push({ left: left.id, right: right.id, distance });
      }
    }
  }
  return pairs.sort((left, right) =>
    left.distance - right.distance ||
    left.left.localeCompare(right.left) ||
    left.right.localeCompare(right.right));
}
