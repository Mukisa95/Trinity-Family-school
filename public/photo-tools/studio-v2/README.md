# Local portrait matting tools

MODNet ONNX export: https://huggingface.co/Xenova/modnet/tree/fa2fa546052fba4c08921230a26cc69a333fca12 (Apache-2.0). Original work: https://github.com/ZHKKKe/MODNet.
ONNX Runtime Web 1.20.1: https://www.npmjs.com/package/onnxruntime-web/v/1.20.1 (MIT). Runtime files from this pinned package's dist directory, served from this application. Trailing whitespace was removed from ort-wasm-simd-threaded.mjs; the original upstream SHA-256 is 745eb7c0ce6f18a6aa521971b2877babc7ffb27eecb58ab3bc6e5ef4692672e8.

First use downloads approximately 36 MB of processing tools from the application's own origin and caches them for offline use. Photos and masks are never uploaded. CPU WASM runs in a worker with one thread, without requiring cross-origin isolation or WebGPU. A serialized, idle-terminated worker reuses the model across photos. Existing v1/v4 native photo tools remain unchanged.

Build matting-worker.js with scripts/build-photo-tools.cjs. Do not replace published versioned assets; increment the directory when changing them after release.

## SHA-256

```
e9c22ae665451e063833894b37873cf01f92a827da9ead86da27fb62fa1100f4  matting-worker.js
c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4  MODNET-LICENSE.txt
07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9  modnet.onnx
2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c  ONNXRUNTIME-LICENSE.txt
21430d8b7296e1985cef8a2e2b31cc8b7dcf3bbf1aa6434cb1bba331c0f3e1d6  ort-wasm-simd-threaded.mjs
207d02be4591c156b0a98f024f3d58005b5b04c92274d759fb390338c63559ea  ort-wasm-simd-threaded.wasm
e66568724f8848e57cc2a56e4bea3a5b86ce3ff81b2da11eac8ed7ab02b27bd4  ort.wasm.min.js
```
