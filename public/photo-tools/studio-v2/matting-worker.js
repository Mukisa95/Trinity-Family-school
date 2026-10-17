"use strict";
(() => {
  // src/lib/photo/studio-matting-worker.ts
  var session;
  async function initialise() {
    if (!session) {
      const base = new URL("/photo-tools/studio-v2/", globalThis.location.href).href;
      importScripts(`${base}ort.wasm.min.js`);
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = base;
      session = ort.InferenceSession.create(`${base}modnet.onnx`, { executionProviders: ["wasm"], graphOptimizationLevel: "all" }).catch((error) => {
        session = void 0;
        throw error;
      });
    }
    return session;
  }
  globalThis.onmessage = async (event) => {
    const { id, bitmap } = event.data;
    try {
      const scale = Math.min(512 / Math.min(bitmap.width, bitmap.height), 1024 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(32, Math.round(bitmap.width * scale / 32) * 32);
      const height = Math.max(32, Math.round(bitmap.height * scale / 32) * 32);
      const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data, plane = width * height;
      const input = new Float32Array(plane * 3);
      for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) input[c * plane + i] = pixels[i * 4 + c] / 127.5 - 1;
      const engine = await initialise();
      const output = await engine.run({ input: new ort.Tensor("float32", input, [1, 3, height, width]) });
      const matte = output.output;
      if (!matte || matte.data.length !== plane) throw new Error("The portrait model returned an invalid alpha matte.");
      const confidence = new Float32Array(matte.data);
      postMessage({ id, result: { width, height, confidence } }, { transfer: [confidence.buffer] });
    } catch (error) {
      postMessage({ id, error: error instanceof Error ? error.message : "Portrait matting failed." });
    } finally {
      bitmap.close();
    }
  };
})();
