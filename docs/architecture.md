# Depth Loom — Architecture

## Goal

A static, backend-free web app that turns one 2D image into a draggable 3D
parallax scene. The image is decoded, resized, and depth-estimated entirely on
the client. No image bytes leave the machine.

## Non-goals (MVP)

- Real 3D reconstruction (TripoSR / InstantMesh)
- Inpainting or background extension
- Accounts, database, server-side inference
- Mobile app

## Data flow

```text
File
  → validate (type, size)
  → decode + EXIF orient (createImageBitmap)
  → resize to ≤1024px longest edge (canvas)
  → depth worker:
       ImageData → RawImage → Depth Anything V2 Small
       → predicted_depth (interpolated to the input size)
       → per-image min/max normalize → Float32Array
  → view mode:
       original → flat MeshBasicMaterial plane
       depth    → grayscale depth canvas overlay
       3D       → CPU vertex displacement + custom fragment shader
  → render / export
```

M1 renders the flat image on a plane. M2 adds the worker depth pass and the
depth-map view. M3 adds the displaced 3D mesh, depth-derived shading/fog, the
strength slider, and the three view modes. The first depth result auto-switches
to 3D unless the user has already chosen a view.

The worker keeps a single pipeline instance. The first image pays the
model/ORT load; subsequent images reuse the in-memory weights. The transfer to
the main thread is an `ArrayBuffer` (zero-copy) and contains normalized
`Float32Array` values plus dimensions.

Model files live in `public/models/depth-anything-v2-small/` and are committed.
ONNX Runtime WASM binaries are copied from `node_modules/onnxruntime-web/dist`
into `public/ort/` by `scripts/copy-ort.mjs` on `predev`/`prebuild`; they are
generated artifacts and are not committed.

## Module boundaries

| Layer | Location | Responsibility |
|---|---|---|
| UI shell | `src/App.tsx`, `src/components` | Upload affordances, states, accessible chrome |
| Image pipeline | `src/lib/image` | Validation, EXIF-aware decode, resize |
| Depth pipeline | `src/lib/depth` | Worker protocol, ONNX/model config, normalization |
| Three stage | `src/lib/three` | Camera fit, orbit math, renderer lifecycle |
| Depth layer | `src/lib/three/depthLayer.ts`, `depthMaterial.ts` | Depth texture, displacement material, mode switching |
| Hooks | `src/hooks` | Upload listeners, depth worker state machine |
| UI components | `src/components` | Upload, stage, depth view/status, controls |
| Design system | `src/styles` | Tokens, reset, motion, responsive rules |
| Docs | `docs` | Architecture and decision records |

The Three.js stage is lazy-loaded via `React.lazy` so the initial route does not
ship Three.js. It sits behind a `Suspense` fallback and a stage error boundary:
a failed chunk load shows a reload action, while a WebGL initialisation failure
renders an inline error and can be retried by loading another image. The model
chunk (M2) is loaded only when an image is ready.

## Performance budget

- Initial JS (excluding the lazy stage and model): < 200 KB gzip
- 3D stage: 60 fps at 256×256 segments
- Inference: target < 5 s WebGPU, < 15 s WASM on a mid-range laptop
- Render on demand: no `requestAnimationFrame` loop while idle

Measured M3 build: initial JS 75.1 KB gzip, lazy stage 134.1 KB gzip, depth
worker 1.29 MB uncompressed; the real-model E2E completes in ~9 s on the WASM
path. WebGPU performance is not measured yet because this machine's headless
Chromium has no `navigator.gpu`.

## State model

`App` keeps the last successful image mounted while a replacement decodes, so a
failed replacement never destroys the current view:

```ts
type ImageState =
  | { status: 'empty' }
  | { status: 'ready'; image: ProcessedImage }

// alongside:
const [isDecoding, setIsDecoding] = useState(false)
const [notice, setNotice] = useState<UploadNotice | null>(null)
const [view, setView] = useState<'original' | 'depth' | '3d'>('original')
const [strength, setStrength] = useState(1)
```

A monotonically increasing job id makes the newest decode win; stale results
are ignored. The stage owns camera/rotation state internally, and React only
passes the decoded image, depth result, view, and strength. This keeps
pointer-move updates out of React's render path. On replacement the stage
disposes the old geometry, texture, and material but keeps its
`WebGLRenderer`, avoiding WebGL context churn.

When the first depth result arrives and the user has not chosen a view, the App
switches to 3D. Choosing a view sets a ref that suppresses this auto-switch for
the current image; the ref resets on the next image. The strength is reset to 1
per image.

## Testing strategy

- **Unit (Vitest):** validation, resize math, decode options, camera fit,
  orbit clamping, plane geometry, depth normalization/RGBA conversion, bilinear
  depth sampling, and plane displacement.
- **Component (Testing Library):** upload entry points, error presentation,
  app state transitions, view switch (original/depth/3D), strength slider,
  depth status, and the depth hook state machine with an injected fake client.
- **E2E (Playwright):** real upload → stage canvas → depth estimate → auto 3D →
  strength change → depth-map view, on desktop. The 375px upload path is
  covered; mobile depth is deferred to a later E2E pass.
- Coverage threshold: 80% lines/statements/functions on `src/lib` and
  `src/hooks`; the WebGL renderer/depth-material glue, the depth worker, and the
  Worker client are excluded and verified in-browser.

## Decisions

- [0001 — Rendering approach](decisions/0001-rendering.md)
- [0002 — Model loading approach](decisions/0002-model-loading.md)
