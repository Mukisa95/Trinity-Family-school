export type SelectionPoint = { x: number; y: number };
export type SelectionMode = 'replace' | 'add' | 'subtract';
export const MAX_SELECTION_FEATHER = 50;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Extra softening in working-image pixels; preserves the original AI matte at zero. */
export function normalizeSelectionFeather(value: number) {
  return Number.isFinite(value) ? clamp(Math.round(value), 0, MAX_SELECTION_FEATHER) : 0;
}

export function combineSelection(base: Uint8ClampedArray, next: Uint8ClampedArray, mode: SelectionMode) {
  if (base.length !== next.length) throw new Error('Selection dimensions do not match.');
  if (mode === 'replace') return new Uint8ClampedArray(next);
  return base.map((value, i) => mode === 'add' ? Math.max(value, next[i]) : Math.max(0, value - next[i]));
}

export function selectRegion(width: number, height: number, from: SelectionPoint, to: SelectionPoint, ellipse = false) {
  const mask = new Uint8ClampedArray(width * height);
  const left = clamp(Math.floor(Math.min(from.x, to.x) * width), 0, width), right = clamp(Math.ceil(Math.max(from.x, to.x) * width), 0, width);
  const top = clamp(Math.floor(Math.min(from.y, to.y) * height), 0, height), bottom = clamp(Math.ceil(Math.max(from.y, to.y) * height), 0, height);
  const rx = (right - left) / 2, ry = (bottom - top) / 2;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    if (!ellipse || (rx > 0 && ry > 0 && ((x + 0.5 - left - rx) / rx) ** 2 + ((y + 0.5 - top - ry) / ry) ** 2 <= 1)) mask[y * width + x] = 255;
  }
  return mask;
}

export function selectPolygon(width: number, height: number, points: SelectionPoint[]) {
  if (points.length < 3) throw new Error('Mark at least three points, then close the polygon.');
  const mask = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const scan = (y + 0.5) / height, intersections: number[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > scan) !== (b.y > scan)) intersections.push((a.x + (scan - a.y) * (b.x - a.x) / (b.y - a.y)) * width);
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const left = clamp(Math.ceil(intersections[i] - 0.5), 0, width), right = clamp(Math.ceil(intersections[i + 1] - 0.5), 0, width);
      mask.fill(255, y * width + left, y * width + right);
    }
  }
  return mask;
}

/** Connected colour selection; separated objects with the same colour stay separate. */
export function selectConnectedColour(pixels: Uint8ClampedArray, width: number, height: number, point: SelectionPoint, tolerance: number) {
  const start = clamp(Math.floor(point.y * height), 0, height - 1) * width + clamp(Math.floor(point.x * width), 0, width - 1);
  const mask = new Uint8ClampedArray(width * height), visited = new Uint8Array(mask.length), queue = new Uint32Array(mask.length);
  const seed = start * 4, limit = (clamp(tolerance, 0, 100) * 4.42) ** 2;
  let read = 0, write = 1; queue[0] = start; visited[start] = 1;
  while (read < write) {
    const index = queue[read++], offset = index * 4;
    const distance = (pixels[offset] - pixels[seed]) ** 2 + (pixels[offset + 1] - pixels[seed + 1]) ** 2 + (pixels[offset + 2] - pixels[seed + 2]) ** 2;
    if (distance > limit || Math.abs(pixels[offset + 3] - pixels[seed + 3]) > Math.max(12, tolerance * 2.55)) continue;
    mask[index] = 255;
    const x = index % width;
    for (const neighbour of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
      if (neighbour >= 0 && neighbour < mask.length && !visited[neighbour]) { visited[neighbour] = 1; queue[write++] = neighbour; }
    }
  }
  return mask;
}

export function paintSelectionStroke(mask: Uint8ClampedArray, width: number, height: number, from: SelectionPoint, to: SelectionPoint, radius: number, erase = false) {
  const ax = from.x * width, ay = from.y * height, bx = to.x * width, by = to.y * height;
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, radius / 3)));
  for (let step = 0; step <= steps; step++) {
    const cx = ax + (bx - ax) * step / steps, cy = ay + (by - ay) * step / steps;
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2) mask[y * width + x] = erase ? 0 : 255;
      }
    }
  }
}

function filterAxis(input: Uint8ClampedArray, width: number, height: number, radius: number, horizontal: boolean, mode: 'blur' | 'grow' | 'shrink') {
  const output = new Uint8ClampedArray(input.length), length = horizontal ? width : height, lines = horizontal ? height : width;
  for (let line = 0; line < lines; line++) {
    const offset = (position: number) => horizontal ? line * width + clamp(position, 0, length - 1) : clamp(position, 0, length - 1) * width + line;
    if (mode === 'blur') {
      let sum = 0;
      for (let i = -radius; i <= radius; i++) sum += input[offset(i)];
      for (let i = 0; i < length; i++) { output[offset(i)] = sum / (radius * 2 + 1); sum += input[offset(i + radius + 1)] - input[offset(i - radius)]; }
    } else {
      const queue = new Int32Array(length + radius * 2); let head = 0, tail = 0;
      for (let p = -radius; p < length + radius; p++) {
        while (head < tail && queue[head] < p - radius * 2) head++;
        while (head < tail && (mode === 'grow' ? input[offset(queue[tail - 1])] <= input[offset(p)] : input[offset(queue[tail - 1])] >= input[offset(p)])) tail--;
        queue[tail++] = p;
        if (p >= radius) output[offset(p - radius)] = input[offset(queue[head])];
      }
    }
  }
  return output;
}

export function refineSelection(mask: Uint8ClampedArray, width: number, height: number, feather = 0, shift = 0) {
  let result = mask;
  const grow = Number.isFinite(shift) ? Math.min(12, Math.round(Math.abs(shift))) : 0, blur = normalizeSelectionFeather(feather);
  if (grow) result = filterAxis(filterAxis(result, width, height, grow, true, shift > 0 ? 'grow' : 'shrink'), width, height, grow, false, shift > 0 ? 'grow' : 'shrink');
  if (blur) result = filterAxis(filterAxis(result, width, height, blur, true, 'blur'), width, height, blur, false, 'blur');
  return result;
}

export function extractSelectedPixels(pixels: Uint8ClampedArray, mask: Uint8ClampedArray, keep = true) {
  if (pixels.length !== mask.length * 4) throw new Error('Image and selection dimensions do not match.');
  const result = new Uint8ClampedArray(pixels);
  for (let i = 0; i < mask.length; i++) result[i * 4 + 3] = pixels[i * 4 + 3] * (keep ? mask[i] : 255 - mask[i]) / 255;
  return result;
}
