# Depth Loom

**Turn a 2D photo into a draggable 3D parallax scene — entirely in your browser.**

English | [简体中文](README.zh.md)

Depth Loom estimates depth locally with Depth Anything V2 Small and renders the
photo as a subtly displaced mesh. Nothing is uploaded; there is no backend.

> Status: **M5 — bilingual documentation and a hardened CI pipeline.**
> GitHub Pages deployment and the online demo link are pending.

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

`npm run test:e2e` builds `dist` first (via `pretest:e2e`) and serves it with
`vite preview`, so the suite always runs against the current commit. It includes
a real-model depth flow (load + inference + 3-second WebM + depth PNG) that takes
roughly 13 seconds per viewport with the WASM fallback; the full desktop +
375px-mobile suite takes about 45 seconds.

## Architecture

- `src/lib/depth/` — worker protocol, q4f16 WebGPU → q8 WASM fallback, and depth
  normalization.
- `src/lib/three/` — stage lifecycle, orbit/input state machine, CPU vertex
  displacement, depth shader, and capture/export.
- `src/hooks/` — upload validation, the depth state machine, and export state.
- `src/components/` — upload zone, stage wrapper, depth status, and control bar.
- `docs/decisions/` — ADR 0001 (rendering), 0002 (model loading), 0003 (export).

See [docs/architecture.md](docs/architecture.md) for the data flow.

## Measured build and performance

Bundle (production build):

- Initial JS: **78.5 KB gzip**, CSS 5.1 KB.
- Lazy Three.js stage: **134.7 KB gzip**.
- Depth worker chunk: 1.29 MB uncompressed, loaded only after an image is ready.
- Self-hosted weights: **46.4 MB** total (q4f16 19.1 MB for WebGPU, q8 27.3 MB
  for WASM).
- ONNX Runtime WASM is generated into `public/ort/` at dev/build time (26–28 MB
  per backend); it is not committed.

Production build served from localhost, three runs averaged. The app reported
**WebGPU** (q4f16) on every run, so this is the real accelerated path:

**WebGPU — Microsoft Edge 157 headless, NVIDIA Ampere adapter**

| Phase | Cold (first image) | Second image (pipeline warm) |
|---|---|---|
| Decode + resize | 167 ms | included below |
| Model load + init | 1.68 s | ~1 ms (pipeline cached in the worker) |
| Inference | 1.31 s | 0.38 s |
| **Total to depth-ready** | **3.16 s** | **0.45 s** |

The first cold run includes browser warm-up (4.01 s); the next two were 2.71 s
and 2.74 s. Warm inference ranged 374–382 ms.

**WASM q8 fallback — headless Chromium 156, CPU**

| Phase | Cold (first image) | Second image (pipeline warm) |
|---|---|---|
| Decode + resize | 114 ms | included below |
| Model load + init | 1.88 s | ~1 ms (pipeline cached in the worker) |
| Inference | 5.47 s | 5.85 s |
| **Total to depth-ready** | **7.46 s** | **6.04 s** |

Machine: 12th Gen Intel Core i7-12700H (14C / 20T), 15.8 GB RAM, Windows 11.
These are averages from a local preview server, not a benchmark: transfer time is
negligible because the weights are local. CI runners have no GPU, so the E2E
suite always exercises the CPU fallback; the WebGPU row is a local measurement.

- Test suite: 105 unit/component tests and 10 passing E2E tests (desktop + 375px
  mobile, including the real-model depth/export flow).
- Coverage: 92.4% statements / 82.1% branches over `src/lib` and `src/hooks`.
  WebGL, worker, and download glue are excluded from the coverage denominator and
  exercised by the E2E suite instead.

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
- **WebGPU is measured locally** (Edge 157, NVIDIA Ampere). CI runners have no
  GPU, so the E2E suite always exercises the CPU fallback; the WebGPU row is not
  re-measured on every release.
- The **mobile E2E project is Chromium touch emulation at 375px**, not WebKit.
  Safari-specific behavior (notably WebM export) is documented but not yet in CI.
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
