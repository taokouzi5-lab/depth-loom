# Depth Loom

**Turn a 2D photo into a draggable 3D parallax scene — entirely in your browser.**

Depth Loom estimates depth locally with Depth Anything V2 Small and renders the
photo as a subtly displaced mesh. Nothing is uploaded; there is no backend.

> Status: **M4 — samples, PNG/WebM export, and Chinese/English UI.**
> The bilingual README, final CI/E2E hardening, and GitHub Pages deployment
> arrive in M5.

## What works

- Drop, click, or paste a JPG / PNG / WebP up to 20 MB.
- EXIF orientation is applied and the image is resized to a 1024px longest edge
  before it reaches the GPU.
- **Depth Anything V2 Small runs in a dedicated Web Worker** from files served by
  this origin. No Hugging Face request or CDN is used at runtime.
- **WebGPU is preferred** (q4f16 weights). If WebGPU is unavailable or its
  pipeline initialization fails, the worker falls back to **q8 WASM** and the UI
  shows a "CPU mode · slower" badge.
- Model loading has byte progress; inference has a distinct state; a failed load
  shows an explicit error with retry.
- **3D view**: the normalized depth field drives CPU vertex displacement on the
  257×257 plane; a custom fragment shader derives relief normals from the depth
  texture and adds depth-based fog. The 5% edge bleed and ±25°/±15° orbit limits
  keep disocclusion out of the MVP.
- **Depth strength slider (0–2×)**: real-time, applied on input without a
  per-frame geometry rebuild. The first successful depth result auto-switches to
  3D; original and depth views remain one click away.
- Switch between original, grayscale depth, and 3D. Brighter depth means nearer.
- **Three built-in CC0 samples** (landscape, street, cat portrait) load without
  an upload. Credits are in
  [`public/samples/CREDITS.md`](public/samples/CREDITS.md).
- **Export the current view as PNG**, or record a **3-second looping WebM** of the
  3D view (MediaRecorder + canvas capture; no audio).
- **Chinese and English UI**, default Chinese; the choice is stored in
  `localStorage`. The original-only mode `?depth=off` skips the model.
- The worker keeps one pipeline instance; switching images does not reload the
  weights.
- Drag to rotate (yaw ±25°, pitch ±15°, rubber-band return), wheel / two-finger
  zoom, arrow keys, and Home to reset. Rendering is on demand.
- The image is replaced without leaking the WebGL context; old geometry,
  textures, and materials are disposed.

## Local development

```bash
npm install
npx playwright install chromium   # first-time E2E setup
npm run dev                       # predev copies ONNX Runtime WASM into public/ort
```

The model files under `public/models/depth-anything-v2-small/` are committed so
the app works offline after first load. To regenerate them with checksum
verification:

```bash
npm run fetch:model
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build                     # prebuild copies ONNX Runtime WASM
npm run test:e2e                  # serves dist via vite preview
```

The Playwright suite runs against `dist`, so build before running it. The E2E
suite includes a real-model depth flow (load + inference + 3-second WebM + depth
PNG) that takes roughly 13 seconds on this machine with the WASM fallback; it
runs on desktop and 375px mobile.

## Measured M4 bundle

- Initial JS: **78.5 KB gzip**, CSS 5.1 KB.
- Lazy Three.js stage: **134.6 KB gzip**.
- Depth worker chunk: 1.29 MB uncompressed, loaded only after an image is ready.
- Self-hosted weights: **46.4 MB** total (q4f16 19.1 MB for WebGPU, q8 27.3 MB
  for WASM).
- ONNX Runtime WASM is generated into `public/ort/` at dev/build time (26–28 MB
  per backend); it is not committed.
- Test suite: 91 unit/component tests and 10 passing E2E tests (desktop + 375px
  mobile, including the real-model depth/export flow).

The initial route stays under the 200 KB gzip budget.

## Stack

- React 19 + TypeScript + Vite
- Three.js (native API, no react-three-fiber)
- Transformers.js 4.3.2 + Depth Anything V2 Small, self-hosted
- ONNX Runtime Web (WASM + WebGPU) self-hosted at build time
- Vitest + Testing Library + Playwright
- MIT licensed

## Model, samples, and third-party licenses

Depth Anything V2 Small is released under **Apache-2.0** (Base/Large/Giant are
CC-BY-NC-4.0 and are not used). The license, authors, source links, file sizes,
and SHA-256 values are in
[`public/models/depth-anything-v2-small/MODEL_INFO.md`](public/models/depth-anything-v2-small/MODEL_INFO.md).

The three sample images are **CC0 1.0**; authors and source pages are recorded in
[`public/samples/CREDITS.md`](public/samples/CREDITS.md). See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the license texts.

## Known issues

- **WebGPU unavailable** → the app uses q8 WASM; it is slower and the UI says so.
- **First depth load is large** (tens of MB). The worker caches the pipeline in
  memory, so switching images is instant after initialization. A hard reload may
  refetch the files; the HTTP cache may help.
- **No inpainting**: the 3D view is constrained to ±25° yaw / ±15° pitch. Beyond
  that, foreground disocclusion would show gaps. The 5% edge bleed and depth fog
  reduce edge artifacts; they do not replace inpainting.
- **Depth strength** is a look control, not a measurement; at 2× the relief is
  intentionally exaggerated.
- **WebM export requires MediaRecorder with a WebM encoder** (Chrome/Edge/Firefox
  today). Browsers without one show an explicit export error. The exported PNG is
  flattened onto the app's dark background, not transparent.
- The depth map is relative, not metric; it is not suitable for measurement,
  medical, or safety-critical use.

## License

[MIT](./LICENSE) © 2026 Chunqi Sun
