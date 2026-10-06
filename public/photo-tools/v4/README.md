# Pupil portrait pipeline, version 4

The school photo is still an opaque, square 500 x 500 JPEG, capped at 180 KiB.
Circle/Square are crop guides. Tight, Standard and Headroom preserve the head
within that square, subject to source bounds and the minimum 500-pixel crop.

The Crop tab has Auto enhance and Remove background. Enhance and Background hold
the advanced adjustments. Zoom uses a logarithmic dial, updates at animation
frame cadence, supports small +/- adjustments and 0.001x keyboard changes, and
shows the current multiplier. Circle and Square use labelled icon buttons;
the separate face framing button has been removed. Use another editor remains.

## Colour processing

Natural, Passport, Portrait, Bright, Soft beauty, Vibrant and Warm portrait are
tuned for school portraits and gift cards. Filter strength interpolates the
preset parameters; zero strength removes colour, smoothing and sharpening stages.
Preserve skin tones is on by default and reduces preset temperature/saturation
changes in a broad warm colour range, including darker tones. This is a colour
heuristic, not a skin classifier. No preset uses a fixed skin hue or brightness
target, skin whitening, face reshaping or generated detail.

The linear-light luminance curves, gamut compression, HSL saturation helpers,
LUT ordering and parameter-strength approach adapt the browser pipeline from
[color-grade-ai](https://github.com/isaacrowntree/color-grade-ai), pinned at
`a6eef94e0d773b1a9475cd9bac8bc15bc3944f46` (MIT). The complete licence is in
`COLOR-GRADE-AI-LICENSE` and embedded in the generated worker.

The upstream tools focus on display-referred Rec.709 video. Phone JPEG canvas
pixels use the sRGB transfer functions here. The skin-to-peach corrections,
cinematic presets, Ruby/Python tools, video conversion LUTs and AI integration
are not shipped. Conservative auto white balance requires distributed near-neutral
samples outside the detected face; skin cannot be the grey reference.

Order: analyse original face/crop; mild edge-aware denoising; colour grade in
linear light with gamut compression; gentle detail sharpening; quality analysis;
optional guided background refinement/compositing; JPEG encoding. Spatial work
always starts from original pixels. Beauty smoothing is gentle around warm
tones and retains strong eye/hair edges; it cannot restore missing capture detail.

The worker generates a 33-cubed float LUT locally and retains up to three recent
tables. Trilinear sampling is used for ordinary pixels; exact grading avoids
errors on the neutral axis and steep highlight gamut shoulders. This adds no
model download or external processing service. Cached tools can run offline;
ordinary school record saving still follows the application's connection needs.

Build with `node scripts/build-photo-tools.cjs`. The v4 URL leaves published
v1-v3 workers unchanged and reuses the existing v1 detector/runtime and v2
segmenter. All versions share `trinity-photo-tools-v1` public-asset caching.
Pupil photos are never written to that tools cache.
