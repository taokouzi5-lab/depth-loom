# Depth Loom

**Turn a 2D photo into a draggable 3D parallax scene — entirely in your browser.**

Depth Loom estimates depth locally with Depth Anything V2 Small and renders the
photo as a subtly displaced mesh. Nothing is uploaded; there is no backend.

> Status: **M2 — local depth estimation and depth-map view.**
> Vertex displacement, exports, CC0 samples, and the bilingual README arrive in
> M3–M5.

## What works

- Drop, click, or paste a JPG / PNG / WebP up to 20 MB.
- EXIF orientation is applied and the image is resized to a 1024px longest edge
  before it reaches the GPU.
- **Depth Anything V2 Small runs in a dedicated Web Worker** from files served by
  this origin. No Hugging Face request or CDN is used at runtime.
- **WebGPU is preferred** (q4f16 weights). If WebGPU is unavailable or its
  pipeline initialization fails, the worker falls back to **q8 WASM** and the UI
  shows a "CPU 模式 · 较慢" badge.
- Model loading has byte progress; inference has a distinct state; a failed load
  shows an explicit error with retry.
- Switch between the original image and the grayscale depth map. Brighter means
  nearer. The depth result stays in memory for the M3 displacement pass.
- The worker keeps one pipeline instance; switching images does not reload the
  weights.
- The Three.js stage shows the photo on a textured plane with a 5% edge bleed.
  Drag to rotate (yaw ±25°, pitch ±15°, rubber-band return), wheel / two-finger
  zoom, arrow keys, and Home to reset. Rendering is on demand.
- The image is replaced without leaking the WebGL context; old geometry,
  textures, and materials are disposed.

M2 still presents the depth map on a flat view. M3 will displace the image mesh
and add the strength slider and the 3D view.

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
suite includes a real-model depth test that takes roughly 10 seconds on this
machine with the WASM fallback.

## Measured M2 bundle

- Initial JS: **74.8 KB gzip**, CSS 4.5 KB.
- Lazy Three.js stage: 132.9 KB gzip.
- Depth worker chunk: 1.29 MB uncompressed, loaded only after an image is ready.
- Self-hosted weights: **46.4 MB** total (q4f16 19.1 MB for WebGPU, q8 27.3 MB
  for WASM).
- ONNX Runtime WASM is generated into `public/ort/` at dev/build time (26–28 MB
  per backend); it is not committed.

The initial route stays under the 200 KB gzip budget.

## Stack

- React 19 + TypeScript + Vite
- Three.js (native API, no react-three-fiber)
- Transformers.js 4.3.2 + Depth Anything V2 Small, self-hosted
- ONNX Runtime Web (WASM + WebGPU) self-hosted at build time
- Vitest + Testing Library + Playwright
- MIT licensed

## Model and third-party licenses

Depth Anything V2 Small is released under **Apache-2.0** (Base/Large/Giant are
CC-BY-NC-4.0 and are not used). The license, authors, source links, file sizes,
and SHA-256 values are in
[`public/models/depth-anything-v2-small/MODEL_INFO.md`](public/models/depth-anything-v2-small/MODEL_INFO.md).
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the full license texts.

## Known issues

- **WebGPU unavailable** → the app uses q8 WASM; it is slower and the UI says so.
- **First depth load is large** (tens of MB). The worker caches the pipeline in
  memory, so switching images is instant after initialization. A hard reload may
  refetch the files; the HTTP cache may help.
- **No inpainting**: beyond the orbit limits, foreground disocclusion would show
  gaps. M3 clamps the angle and adds edge bleed/depth fog rather than pretending
  the problem is solved.
- The depth map is relative, not metric; it is not suitable for measurement,
  medical, or safety-critical use.

## License

[MIT](./LICENSE) © 2026 Chunqi Sun
