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

  // src/lib/photo/photo-processing.ts
  var clamp = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));
  var luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  function upsampleMask(width, height, mask) {
    if (mask.width < 1 || mask.height < 1 || mask.confidence.length !== mask.width * mask.height) throw new Error("Invalid background mask.");
    const output = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const mx = clamp((x + 0.5) * mask.width / width - 0.5, 0, mask.width - 1);
      const my = clamp((y + 0.5) * mask.height / height - 0.5, 0, mask.height - 1);
      const x0 = Math.floor(mx), y0 = Math.floor(my), x1 = Math.min(x0 + 1, mask.width - 1), y1 = Math.min(y0 + 1, mask.height - 1);
      const tx = mx - x0, ty = my - y0;
      const top = mask.confidence[y0 * mask.width + x0] * (1 - tx) + mask.confidence[y0 * mask.width + x1] * tx;
      const bottom = mask.confidence[y1 * mask.width + x0] * (1 - tx) + mask.confidence[y1 * mask.width + x1] * tx;
      const confidence = top * (1 - ty) + bottom * ty;
      if (!Number.isFinite(confidence)) throw new Error("Invalid background confidence.");
      output[y * width + x] = clamp(confidence, 0, 1);
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
      const value = clamp(meanA[i] * guide[i] + meanB[i], 0, 1);
      confidence[i] = confidence[i] < 0.01 ? Math.min(value, 0.01) : confidence[i] > 0.99 ? Math.max(value, 0.99) : value;
    }
    return { width, height, confidence };
  }

  // src/lib/photo/studio-object-worker.ts
  var segmenter;
  async function initialise() {
    if (!segmenter) {
      const base = new URL("/photo-tools/v1/", globalThis.location.href).href;
      importScripts(`${base}vision.js`);
      segmenter = Vision.InteractiveSegmenterLegacy.createFromOptions({ wasmLoaderPath: `${base}wasm/vision_wasm_nosimd_internal.js`, wasmBinaryPath: `${base}wasm/vision_wasm_nosimd_internal.wasm` }, {
        baseOptions: { modelAssetPath: new URL("/photo-tools/studio-v1/magic-touch.tflite", globalThis.location.href).href, delegate: "CPU" },
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
    const { id, bitmap, point, type, pixels, width, height, mask } = event.data;
    try {
      if (type === "refine") {
        const result2 = refinePersonMask(pixels, width, height, mask);
        postMessage({ id, result: result2 }, { transfer: [result2.confidence.buffer] });
        return;
      }
      if (!bitmap) throw new Error("No layer image was supplied.");
      const result = (await initialise()).segment(bitmap, { keypoint: point });
      try {
        const masks = result.confidenceMasks;
        const mask2 = masks?.[masks.length === 1 ? 0 : 1];
        if (!mask2) throw new Error("The object selector returned no mask.");
        const confidence = new Float32Array(mask2.getAsFloat32Array());
        postMessage({ id, result: { width: mask2.width, height: mask2.height, confidence } }, { transfer: [confidence.buffer] });
      } finally {
        result.close();
      }
    } catch (error) {
      postMessage({ id, error: error instanceof Error ? error.message : "Object selection failed." });
    } finally {
      bitmap?.close();
    }
  };
})();
