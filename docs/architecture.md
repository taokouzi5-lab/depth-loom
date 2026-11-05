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
  → [M2] depth worker (Depth Anything V2 Small)
  → [M2] per-image min/max normalize → depth texture
  → [M3] CPU vertex displacement → Three.js scene
  → render / export
```

M1 stops after resize and renders the flat image on a plane.

## Module boundaries

| Layer | Location | Responsibility |
|---|---|---|
| UI shell | `src/App.tsx`, `src/components` | Upload affordances, states, accessible chrome |
| Image pipeline | `src/lib/image` | Validation, EXIF-aware decode, resize |
| Three stage | `src/lib/three` | Camera fit, orbit math, renderer lifecycle |
| Hooks | `src/hooks` | Window drag/drop and paste listeners |
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
```

A monotonically increasing job id makes the newest decode win; stale results
are ignored. The stage owns camera/rotation state internally, and React only
passes the decoded image. This keeps pointer-move updates out of React's render
path. On replacement the stage disposes the old geometry, texture, and material
but keeps its `WebGLRenderer`, avoiding WebGL context churn.

## Testing strategy

- **Unit (Vitest):** validation, resize math, decode options, camera fit,
  orbit clamping, plane geometry.
- **Component (Testing Library):** upload entry points, error presentation,
  app state transitions. The WebGL stage is mocked.
- **E2E (Playwright, M5):** real upload → stage canvas → depth view, desktop
  and 375px mobile.
- Coverage threshold: 80% lines/statements/functions on `src/lib` and
  `src/hooks`; the WebGL renderer glue is excluded and verified in-browser.

## Decisions

- [0001 — Rendering approach](decisions/0001-rendering.md)
- [0002 — Model loading approach](decisions/0002-model-loading.md)
