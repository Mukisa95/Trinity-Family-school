# Local pupil portrait tools, version 1

These files are hosted by the school application. Photos are processed in a browser worker;
the detector locates faces and eye positions and does not identify pupils or send images to Google.

- `vision.js`: unmodified `vision_bundle.js` from `@mediapipe/tasks-vision` **1.0.1**,
  downloaded from https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-1.0.1.tgz.
- `wasm/`: unmodified non-SIMD runtime from the same package. The CPU implementation
  avoids requiring WebGL or SIMD on lower specification phones.
- `face-detector.tflite`: Google BlazeFace short range, float16, model version **1**,
  downloaded from https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite.
- `LICENSE`: MediaPipe Apache 2.0 license, copied from the Google MediaPipe repository.
- `photo-worker.js`: generated from `src/lib/photo/photo-worker.ts` and
  `src/lib/photo/photo-processing.ts` by `node scripts/build-photo-tools.cjs`. The app's prebuild runs this script.

SHA-256 provenance:

```
vision.js: 98DB72469FFB176F5E9F2687BE0F70783893ACA681F7789C34B872B0A764371A
face-detector.tflite: B4578F35940BF5A1A655214A1CCE5CAB13EBA73C1297CD78E1A04C2380B0152F
vision_wasm_nosimd_internal.wasm: A28483CD42E74E855BF5EBDB6B40D9B66A5B49E35E95020BC97669E6822A3192
```

The first use downloads approximately 11.7 MB of tools once. `preparePhotoTools` stores
these public assets in `trinity-photo-tools-v1`; the service worker serves them offline
and preserves the cache across ordinary app releases. Pupil images are never written to
this tools cache. A browser storage reset requires another download. This does not make
all application routes or pupil-record uploads available offline.

One idle worker is retained for two minutes for fast consecutive portraits, then terminated.
Closing an editor with pending work terminates that work. Only one detected face triggers
automatic framing; zero or multiple faces leave the manual crop available. Late detection
does not override a crop the user has started positioning.

The processing uses mild luminance correction, neutral-pixel colour balancing, edge-aware
noise reduction and bounded sharpening. Warnings are heuristics, not guarantees of quality.
The original stays unchanged during editing. Review shows the actual compressed JPEG;
Save passes that exact JPEG to the existing pupil-photo flow. All outputs remain 500 x 500,
at most 180 KiB as binary JPEG, with a minimum 500-pixel source crop. The stored data URL
has additional base64 overhead. Existing saved photos are not automatically reprocessed.

When updating tool or worker behaviour, bump the asset directory and cache version in both
`photo-tools-client.ts` and `public/sw.js`, and update the build output path. Never replace
already-published assets in this immutable directory.
