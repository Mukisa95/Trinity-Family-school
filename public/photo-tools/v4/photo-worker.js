"use strict";
(() => {
  // src/lib/photo/photo-color-grade.ts
  /*!
  MIT License

  Copyright (c) 2026 Isaac Rowntree

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  */
  var NEUTRAL_GRADE = {
    gamma: 1,
    exposure: 0,
    contrast: 1,
    shadows: 0,
    highlights: 0,
    temperature: 0,
    tint: 0,
    saturation: 1,
    gains: [1, 1, 1],
    lookGamma: 1,
    lookExposure: 0,
    lookContrast: 1,
    lookSaturation: 1,
    lookTemperature: 0,
    protectSkin: true
  };
  var clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
  var srgbToLinear = (v) => v <= 0.04045 ? clamp(v) / 12.92 : ((clamp(v) + 0.055) / 1.055) ** 2.4;
  var linearToSrgb = (v) => v <= 31308e-7 ? clamp(v) * 12.92 : 1.055 * clamp(v) ** (1 / 2.4) - 0.055;
  var luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  function compressGamut(r, g, b, target) {
    const peak = Math.max(r, g, b);
    if (peak > 1 && peak > target) {
      const k = clamp((1 - target) / (peak - target));
      r = target + (r - target) * k;
      g = target + (g - target) * k;
      b = target + (b - target) * k;
    }
    return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
  }
  function applyLumaCurve(rgb, curve) {
    const [r, g, b] = rgb.map(srgbToLinear);
    const y = luma(r, g, b), target = srgbToLinear(clamp(curve(linearToSrgb(y))));
    if (Math.abs(target - y) < 1e-12) return rgb;
    if (y <= 1e-12) {
      const v = linearToSrgb(target);
      return [v, v, v];
    }
    const gain = target / y;
    return compressGamut(r * gain, g * gain, b * gain, target);
  }
  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hslToRgb(h, s, l) {
    if (!s) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, hk = h / 360;
    return [hk + 1 / 3, hk, hk - 1 / 3].map((t) => {
      if (t < 0) t++;
      if (t > 1) t--;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    });
  }
  var smoothstep = (x) => {
    const t = clamp(x);
    return t * t * (3 - 2 * t);
  };
  function portraitSkinWeight(r, g, b) {
    const [h, s] = rgbToHsl(r, g, b);
    const distance = Math.min(Math.abs(h - 30), 360 - Math.abs(h - 30));
    return (1 - smoothstep((distance - 25) / 25)) * smoothstep((s - 0.025) / 0.1) * (1 - smoothstep((s - 0.8) / 0.18));
  }
  function gradePortraitRgb(rgb, grade) {
    const protection = grade.protectSkin ? portraitSkinWeight(...rgb) * 0.85 : 0;
    const temperature = grade.temperature + grade.lookTemperature * (1 - protection);
    const tint = grade.tint;
    let result = rgb;
    if (temperature || tint || grade.gains.some((gain) => gain !== 1)) {
      const [r, g, b] = rgb.map(srgbToLinear);
      const target = luma(r, g, b);
      const rr = r * grade.gains[0] * 2 ** (temperature + tint);
      const gg = g * grade.gains[1] * 2 ** -tint;
      const bb = b * grade.gains[2] * 2 ** (-temperature + tint);
      const gain = target / Math.max(1e-12, luma(rr, gg, bb));
      result = compressGamut(rr * gain, gg * gain, bb * gain, target);
    }
    result = applyLumaCurve(result, (y) => {
      let tone = y ** (grade.gamma * grade.lookGamma);
      const linear = srgbToLinear(tone) * 2 ** (grade.exposure + grade.lookExposure);
      tone = linearToSrgb(linear);
      tone += grade.shadows * (1 - y) ** 2 + grade.highlights * y ** 2;
      return (tone - 0.5) * grade.contrast * grade.lookContrast + 0.5;
    });
    const saturation = grade.saturation * (1 + (grade.lookSaturation - 1) * (1 - protection));
    if (Math.abs(saturation - 1) > 1e-12) {
      const [h, s, l] = rgbToHsl(...result);
      result = hslToRgb(h, clamp(s * saturation), l);
    }
    return result;
  }
  var recentLuts = /* @__PURE__ */ new Map();
  function createPortraitLut(grade, size = 33) {
    const key = `${size}:${JSON.stringify(grade)}`, cached = recentLuts.get(key);
    if (cached) return cached;
    const table = new Float32Array(size ** 3 * 3);
    let i = 0;
    for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
      for (const value of gradePortraitRgb([r / (size - 1), g / (size - 1), b / (size - 1)], grade)) table[i++] = clamp(value);
    }
    const lut = { size, table, grade };
    recentLuts.set(key, lut);
    if (recentLuts.size > 3) recentLuts.delete(recentLuts.keys().next().value);
    return lut;
  }
  function applyPortraitLut(pixels, lut) {
    const { size: n, table } = lut, last = n - 1;
    for (let i = 0; i < pixels.length; i += 4) {
      const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]), low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (high === low || high > 215 && high - low > 12) {
        const exact = gradePortraitRgb([pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255], lut.grade);
        for (let c = 0; c < 3; c++) pixels[i + c] = exact[c] * 255;
        continue;
      }
      const r = pixels[i] / 255 * last, g = pixels[i + 1] / 255 * last, b = pixels[i + 2] / 255 * last;
      const r0 = Math.min(Math.floor(r), last - 1), g0 = Math.min(Math.floor(g), last - 1), b0 = Math.min(Math.floor(b), last - 1);
      const rf = r - r0, gf = g - g0, bf = b - b0;
      const base2 = (b0 * n * n + g0 * n + r0) * 3, rs = 3, gs = n * 3, bs = n * n * 3;
      for (let c = 0; c < 3; c++) {
        const j = base2 + c;
        const c00 = table[j] * (1 - rf) + table[j + rs] * rf;
        const c10 = table[j + gs] * (1 - rf) + table[j + gs + rs] * rf;
        const c01 = table[j + bs] * (1 - rf) + table[j + bs + rs] * rf;
        const c11 = table[j + bs + gs] * (1 - rf) + table[j + bs + gs + rs] * rf;
        pixels[i + c] = ((c00 * (1 - gf) + c10 * gf) * (1 - bf) + (c01 * (1 - gf) + c11 * gf) * bf) * 255;
      }
    }
  }

  // src/lib/photo/photo-processing.ts
  var PHOTO_FILTERS = [
    { id: "natural", label: "Natural", grade: {} },
    { id: "clean", label: "Passport", grade: { lookGamma: 0.98, lookContrast: 1.02 }, sharpness: 8 },
    { id: "portrait", label: "Portrait", grade: { lookGamma: 0.98, lookExposure: 0.08, lookSaturation: 1.06 }, smoothing: 10, sharpness: 6 },
    { id: "bright", label: "Bright", grade: { lookGamma: 0.97, lookExposure: 0.16 }, sharpness: 5 },
    { id: "beauty", label: "Soft beauty", grade: { lookGamma: 0.98, lookContrast: 0.99, lookSaturation: 1.03 }, smoothing: 26 },
    { id: "vivid", label: "Vibrant", grade: { lookContrast: 1.035, lookSaturation: 1.18 }, sharpness: 8 },
    { id: "warm", label: "Warm portrait", grade: { lookTemperature: 0.12, lookGamma: 0.99, lookSaturation: 1.04 }, smoothing: 8 }
  ];
  var clamp2 = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));
  var luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  function upsampleMask(width, height, mask) {
    if (mask.width < 1 || mask.height < 1 || mask.confidence.length !== mask.width * mask.height) throw new Error("Invalid background mask.");
    const output = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const mx = clamp2((x + 0.5) * mask.width / width - 0.5, 0, mask.width - 1);
      const my = clamp2((y + 0.5) * mask.height / height - 0.5, 0, mask.height - 1);
      const x0 = Math.floor(mx), y0 = Math.floor(my), x1 = Math.min(x0 + 1, mask.width - 1), y1 = Math.min(y0 + 1, mask.height - 1);
      const tx = mx - x0, ty = my - y0;
      const top = mask.confidence[y0 * mask.width + x0] * (1 - tx) + mask.confidence[y0 * mask.width + x1] * tx;
      const bottom = mask.confidence[y1 * mask.width + x0] * (1 - tx) + mask.confidence[y1 * mask.width + x1] * tx;
      const confidence = top * (1 - ty) + bottom * ty;
      if (!Number.isFinite(confidence)) throw new Error("Invalid background confidence.");
      output[y * width + x] = clamp2(confidence, 0, 1);
    }
    return output;
  }
  function boxMean(input, width, height, radius) {
    const horizontal = new Float32Array(input.length), output = new Float32Array(input.length);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < Math.min(width, radius + 1); x++) sum += input[y * width + x];
      for (let x = 0; x < width; x++) {
        horizontal[y * width + x] = sum / (Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1);
        if (x - radius >= 0) sum -= input[y * width + x - radius];
        if (x + radius + 1 < width) sum += input[y * width + x + radius + 1];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = 0; y < Math.min(height, radius + 1); y++) sum += horizontal[y * width + x];
      for (let y = 0; y < height; y++) {
        output[y * width + x] = sum / (Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1);
        if (y - radius >= 0) sum -= horizontal[(y - radius) * width + x];
        if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x];
      }
    }
    return output;
  }
  function refinePersonMask(pixels, width, height, mask) {
    if (pixels.length !== width * height * 4) throw new Error("Invalid photo pixels.");
    const original = upsampleMask(width, height, mask);
    const confidence = new Float32Array(original);
    if (width * height >= 256) {
      const visited = new Uint8Array(original.length), queue = new Int32Array(original.length);
      const components = [];
      let largest = 0;
      for (let start = 0; start < original.length; start++) {
        if (visited[start] || original[start] < 0.7) continue;
        let read = 0, write = 1;
        queue[0] = start;
        visited[start] = 1;
        while (read < write) {
          const i = queue[read++], x = i % width;
          for (const neighbour of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
            if (neighbour < 0 || neighbour >= original.length || visited[neighbour] || original[neighbour] < 0.7) continue;
            visited[neighbour] = 1;
            queue[write++] = neighbour;
          }
        }
        largest = Math.max(largest, write);
        components.push(queue.slice(0, write));
      }
      for (const component of components) if (component.length < Math.max(4, largest * 2e-4)) {
        let nearby = false;
        for (const i of component) {
          const x = i % width, y = Math.floor(i / width);
          for (let dy = -5; dy <= 5 && !nearby; dy++) for (let dx = -5; dx <= 5; dx++) {
            const nx = x + dx, ny = y + dy, n = ny * width + nx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[n] && original[n] >= 0.7 && !component.includes(n)) {
              nearby = true;
              break;
            }
          }
        }
        if (!nearby) for (const i of component) confidence[i] = 0;
      }
    }
    const guide = new Float32Array(original.length), squared = new Float32Array(original.length), product = new Float32Array(original.length);
    for (let i = 0; i < guide.length; i++) {
      guide[i] = luminance(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]) / 255;
      squared[i] = guide[i] * guide[i];
      product[i] = guide[i] * confidence[i];
    }
    const radius = 4;
    const meanI = boxMean(guide, width, height, radius), meanP = boxMean(confidence, width, height, radius);
    const corrI = boxMean(squared, width, height, radius), corrIP = boxMean(product, width, height, radius);
    const a = new Float32Array(original.length), b = new Float32Array(original.length);
    for (let i = 0; i < a.length; i++) {
      a[i] = (corrIP[i] - meanI[i] * meanP[i]) / (Math.max(0, corrI[i] - meanI[i] * meanI[i]) + 1e-3);
      b[i] = meanP[i] - a[i] * meanI[i];
    }
    const meanA = boxMean(a, width, height, radius), meanB = boxMean(b, width, height, radius);
    for (let i = 0; i < confidence.length; i++) {
      const value = clamp2(meanA[i] * guide[i] + meanB[i], 0, 1);
      confidence[i] = confidence[i] < 0.01 ? Math.min(value, 0.01) : confidence[i] > 0.99 ? Math.max(value, 0.99) : value;
    }
    return { width, height, confidence };
  }
  function applyWhiteBackground(pixels, width, height, mask, settings) {
    if (pixels.length !== width * height * 4 || mask.width < 1 || mask.height < 1 || mask.confidence.length !== mask.width * mask.height) {
      throw new Error("Invalid background mask.");
    }
    const output = new Uint8ClampedArray(pixels);
    const confidenceMap = upsampleMask(width, height, mask);
    const color = { white: [255, 255, 255], grey: [238, 240, 243], blue: [220, 235, 248] }[settings?.backgroundColor ?? "white"] ?? [255, 255, 255];
    const edge = Number.isFinite(settings?.backgroundEdge) ? settings.backgroundEdge : 0;
    const softness = Number.isFinite(settings?.backgroundFeather) ? settings.backgroundFeather : 35;
    const centre = 0.5 + clamp2(edge, -20, 20) * 8e-3;
    const feather = settings ? 0.12 + clamp2(softness, 0, 100) * 28e-4 : 0.3;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const confidence = confidenceMap[y * width + x];
      const t = clamp2((confidence - centre + feather) / (feather * 2), 0, 1);
      const alpha = t * t * (3 - 2 * t);
      const i = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) output[i + channel] = pixels[i + channel] * alpha + color[channel] * (1 - alpha);
      output[i + 3] = 255;
    }
    return output;
  }
  function analysePhoto(pixels, width, height, region) {
    const x0 = Math.floor(clamp2(region?.x ?? width * 0.2, 1, width - 2));
    const y0 = Math.floor(clamp2(region?.y ?? height * 0.15, 1, height - 2));
    const x1 = Math.ceil(clamp2(region ? region.x + region.width : width * 0.8, x0 + 1, width - 1));
    const y1 = Math.ceil(clamp2(region ? region.y + region.height : height * 0.8, y0 + 1, height - 1));
    const histogram = new Uint32Array(256);
    let count = 0, sum = 0, dark = 0, clipped = 0, lap = 0, lapSquared = 0, noiseSum = 0, flatCount = 0;
    const at = (x, y) => {
      const i = (y * width + x) * 4;
      return luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
    };
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const value = at(x, y), left = at(x - 1, y), right = at(x + 1, y), top = at(x, y - 1), bottom = at(x, y + 1);
      histogram[Math.round(value)]++;
      sum += value;
      count++;
      if (value < 30) dark++;
      if (value > 245) clipped++;
      const l = left + right + top + bottom - 4 * value;
      lap += l;
      lapSquared += l * l;
      if (Math.max(left, right, top, bottom) - Math.min(left, right, top, bottom) < 18) {
        noiseSum += Math.abs(value - (left + right + top + bottom) / 4);
        flatCount++;
      }
    }
    function percentile(fraction) {
      let cumulative = 0;
      for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative >= count * fraction) return i;
      }
      return 255;
    }
    return {
      mean: sum / Math.max(count, 1),
      darkFraction: dark / Math.max(count, 1),
      clippedFraction: clipped / Math.max(count, 1),
      p10: percentile(0.1),
      p90: percentile(0.9),
      sharpness: lapSquared / Math.max(count, 1) - (lap / Math.max(count, 1)) ** 2,
      noise: noiseSum / Math.max(flatCount, 1)
    };
  }
  function photoQualityWarnings(stats) {
    const warnings = [];
    if (stats.mean < 48 || stats.darkFraction > 0.55) warnings.push({ code: "dark", message: "The face area is very dark. More light and a retake may preserve more detail." });
    if (stats.clippedFraction > 0.18) warnings.push({ code: "clipped", message: "Bright areas have lost detail. Avoid strong light behind or directly on the face." });
    if (stats.p90 - stats.p10 > 30 && stats.sharpness < 32) warnings.push({ code: "soft", message: "The selected area may be blurry. Check the eyes in the preview and retake if needed." });
    if (stats.noise > 7) warnings.push({ code: "noise", message: "This photo has visible grain. Gentle smoothing helps, but better light will give a clearer result." });
    return warnings;
  }
  function enhancePhoto(pixels, width, height, settings, region, mask) {
    if (width < 3 || height < 3 || pixels.length !== width * height * 4) throw new Error("Invalid photo pixels.");
    const stats = analysePhoto(pixels, width, height, region);
    const output = new Uint8ClampedArray(pixels);
    const preset = PHOTO_FILTERS.find((filter) => filter.id === settings.filter) ?? PHOTO_FILTERS[0];
    const intensity = clamp2(Number.isFinite(settings.filterIntensity) ? settings.filterIntensity : 100, 0, 100) / 100;
    const adjustment = (key, min, max) => clamp2(Number.isFinite(settings[key]) ? settings[key] : 0, min, max);
    const manualSmooth = adjustment("smoothing", 0, 50) / 100;
    const lookSmooth = (preset.smoothing ?? 0) * intensity / 100;
    const sharpness = adjustment("sharpness", 0, 50) + (preset.sharpness ?? 0) * intensity;
    const finish = () => {
      const warnings = photoQualityWarnings(analysePhoto(output, width, height, region));
      if (stats.clippedFraction > 0.18 && !warnings.some((w) => w.code === "clipped")) warnings.push({ code: "clipped", message: "Highlights have lost detail." });
      let finished = output;
      if (settings.removeBackground) {
        if (!mask) throw new Error("Background mask unavailable. Turn off Remove background or try again.");
        if (!mask.confidence.some((value) => value >= 0.65)) throw new Error("No clear subject found. Turn off Remove background or try another photo.");
        finished = applyWhiteBackground(output, width, height, refinePersonMask(pixels, width, height, mask), settings);
      }
      return { pixels: finished, warnings, stats };
    };
    const gamma = !settings.auto ? 1 : stats.p90 < 145 ? clamp2(1 - (145 - stats.p90) / 350, 0.82, 1) : stats.mean > 190 && stats.p10 > 100 ? clamp2(1 + (stats.mean - 190) / 400, 1, 1.08) : 1;
    let red = 0, green = 0, blue = 0, neutralCount = 0;
    const neutralQuadrants = /* @__PURE__ */ new Set();
    if (settings.auto) for (let i = 0; i < pixels.length; i += 16) {
      const x = i / 4 % width, y = Math.floor(i / 4 / width);
      if (region && x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) continue;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (min > 70 && max < 235 && max - min < max * 0.06) {
        red += r;
        green += g;
        blue += b;
        neutralCount++;
        neutralQuadrants.add((x >= width / 2 ? 1 : 0) + (y >= height / 2 ? 2 : 0));
      }
    }
    const neutral = (red + green + blue) / 3;
    const hasNeutral = neutralCount > pixels.length / 4 * 0.01 && neutralQuadrants.size >= 2;
    const gains = hasNeutral ? [clamp2(neutral / red, 0.98, 1.02), clamp2(neutral / green, 0.98, 1.02), clamp2(neutral / blue, 0.98, 1.02)] : [1, 1, 1];
    const grade = {
      ...NEUTRAL_GRADE,
      gamma,
      gains,
      protectSkin: settings.protectSkin !== false,
      exposure: adjustment("brightness", -30, 30) / 40,
      contrast: 1 + adjustment("contrast", -30, 30) * 0.01,
      temperature: adjustment("warmth", -20, 20) * 8e-3,
      tint: adjustment("tint", -20, 20) * 5e-3,
      shadows: adjustment("shadows", -40, 40) * 15e-4,
      highlights: adjustment("highlights", -40, 40) * 15e-4,
      saturation: 1 + adjustment("saturation", -100, 40) / 100
    };
    for (const key of ["lookGamma", "lookContrast", "lookSaturation", "lookExposure", "lookTemperature"]) {
      grade[key] = NEUTRAL_GRADE[key] + ((preset.grade[key] ?? NEUTRAL_GRADE[key]) - NEUTRAL_GRADE[key]) * intensity;
    }
    const colourChanged = Object.entries(grade).some(([key, value]) => key === "gains" ? gains.some((g) => g !== 1) : key !== "protectSkin" && value !== NEUTRAL_GRADE[key]);
    const baseSmoothing = (settings.auto ? clamp2((stats.noise - 1.5) / 18, 0, 0.4) : 0) + manualSmooth;
    if (!colourChanged && !baseSmoothing && !lookSmooth && !sharpness && !settings.auto) return finish();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const smoothing = clamp2(baseSmoothing + lookSmooth * (0.4 + 0.6 * portraitSkinWeight(r / 255, g / 255, b / 255)), 0, 0.7);
      if (smoothing > 0 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        let rs = 0, gs = 0, bs = 0, weightSum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = ((y + dy) * width + x + dx) * 4;
          const difference = Math.abs(pixels[j] - r) + Math.abs(pixels[j + 1] - g) + Math.abs(pixels[j + 2] - b);
          const weight = Math.exp(-difference / 24) * (dx === 0 && dy === 0 ? 2 : 1);
          rs += pixels[j] * weight;
          gs += pixels[j + 1] * weight;
          bs += pixels[j + 2] * weight;
          weightSum += weight;
        }
        r += (rs / weightSum - r) * smoothing;
        g += (gs / weightSum - g) * smoothing;
        b += (bs / weightSum - b) * smoothing;
      }
      output[i] = r;
      output[i + 1] = g;
      output[i + 2] = b;
    }
    if (colourChanged) applyPortraitLut(output, createPortraitLut(grade));
    if (settings.auto || sharpness) {
      const softened = new Uint8ClampedArray(output);
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) for (let c = 0; c < 3; c++) {
        const i = (y * width + x) * 4 + c;
        const average = (softened[i - 4] + softened[i + 4] + softened[i - width * 4] + softened[i + width * 4]) / 4;
        const detail = softened[i] - average;
        const amount = (settings.auto ? 0.18 : 0) + sharpness / 100;
        const limit = 4 + sharpness * 0.15;
        if (Math.abs(detail) > Math.max(3, stats.noise * 3)) output[i] = clamp2(softened[i] + clamp2(detail * amount, -limit, limit));
      }
    }
    return finish();
  }

  // src/lib/photo/photo-worker.ts
  var detector;
  var segmenter;
  var visionLoaded = false;
  var base = new URL("/photo-tools/v1/", globalThis.location.href).href;
  function files() {
    if (!visionLoaded) {
      importScripts(`${base}vision.js`);
      visionLoaded = true;
    }
    return { wasmLoaderPath: `${base}wasm/vision_wasm_nosimd_internal.js`, wasmBinaryPath: `${base}wasm/vision_wasm_nosimd_internal.wasm` };
  }
  function initialise() {
    if (!detector) {
      const wasmFiles = files();
      detector = Vision.FaceDetector.createFromOptions(wasmFiles, {
        baseOptions: { modelAssetPath: `${base}face-detector.tflite`, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.65
      }).catch((error) => {
        detector = void 0;
        throw error;
      });
    }
    return detector;
  }
  function initialiseSegmenter() {
    if (!segmenter) {
      const wasmFiles = files();
      segmenter = Vision.ImageSegmenter.createFromOptions(wasmFiles, {
        baseOptions: { modelAssetPath: new URL("/photo-tools/v2/selfie-segmenter.tflite", globalThis.location.href).href, delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false
      }).catch((error) => {
        segmenter = void 0;
        throw error;
      });
    }
    return segmenter;
  }
  globalThis.onmessage = async (event) => {
    const { id, type } = event.data;
    try {
      if (type === "enhance") {
        const { pixels, width, height, settings, region, mask } = event.data;
        const result = enhancePhoto(pixels, width, height, settings, region, mask);
        postMessage({ id, result }, { transfer: [result.pixels.buffer] });
      } else if (type === "detect") {
        const bitmap = event.data.bitmap;
        try {
          const result = (await initialise()).detect(bitmap);
          const faces = result.detections.map(({ boundingBox: box, keypoints }) => ({
            x: box.originX,
            y: box.originY,
            width: box.width,
            height: box.height,
            eyesY: keypoints?.length >= 2 ? (keypoints[0].y + keypoints[1].y) / 2 * bitmap.height : void 0
          }));
          postMessage({ id, result: faces });
        } finally {
          bitmap.close();
        }
      } else if (type === "segment") {
        const bitmap = event.data.bitmap;
        try {
          const result = (await initialiseSegmenter()).segment(bitmap);
          try {
            const masks = result.confidenceMasks;
            const mask = masks?.[masks.length === 1 ? 0 : 1];
            if (!mask) throw new Error("No person mask was returned.");
            const confidence = new Float32Array(mask.getAsFloat32Array());
            postMessage({ id, result: { width: mask.width, height: mask.height, confidence } }, { transfer: [confidence.buffer] });
          } finally {
            result.close();
          }
        } finally {
          bitmap.close();
        }
      }
    } catch (error) {
      postMessage({ id, error: error instanceof Error ? error.message : "Photo processing failed." });
    }
  };
})();
