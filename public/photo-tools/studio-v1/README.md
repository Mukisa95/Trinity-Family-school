# Studio object selection, version 1

`magic-touch.tflite` is Google's pinned MagicTouch float32 version 1 model:
https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite

SHA-256: `E24338A717C1B7AD8D159666677EF400BABB7F33B8AD60C4D96DB4ECF694CD25`

The model is 6,227,884 bytes. Its embedded labels are `background` and `subject`.
The worker uses `InteractiveSegmenterLegacy` from the existing pinned MediaPipe
1.0.1 runtime under `../v1/`, with that runtime's non-SIMD CPU WASM files.
`LICENSE` contains the MediaPipe Apache 2.0 license.

`selection-worker.js` is generated from `src/lib/photo/studio-object-worker.ts`
by `node scripts/build-photo-tools.cjs`, which also runs during prebuild.
Tools are cached on first use; photos are processed on-device and never uploaded
to a segmentation service or written to the public tools cache. Studio edits are
stored only in the user's device template storage. This directory is immutable
after publication; future changes must use a new version.

Portrait edge refinement reuses the existing guided matte filter in
`src/lib/photo/photo-processing.ts`, running in this worker rather than on the UI
thread. Original photo colours are preserved and only the output alpha changes.

AI masks are estimates. The studio provides brush and polygon correction, edge
adjustment and comparison previews so users can inspect and refine the result.
