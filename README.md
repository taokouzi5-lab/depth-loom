# Depth Loom

**Turn a 2D photo into a draggable 3D parallax scene — entirely in your browser.**

Depth Loom estimates depth locally with Depth Anything V2 Small and renders the
photo as a subtly displaced mesh. Nothing is uploaded; there is no backend.

> Status: **M1 — scaffold, upload, flat image stage, orbit controls.**
> The depth model, displacement, exports, and bilingual README arrive in later
> milestones.

## What works in M1

- Drop, click, or paste a JPG / PNG / WebP up to 20 MB.
- EXIF orientation is applied and the image is resized to a 1024px longest edge
  before it reaches the GPU.
- A lazy-loaded Three.js stage shows the photo on a textured plane with a 5%
  edge bleed.
- Drag to rotate (yaw ±25°, pitch ±15°, with rubber-band return), use the wheel
  or a two-finger pinch to zoom, and use arrow keys / Home for keyboard control.
- The renderer only runs while the view is settling; it does not sit in a
  requestAnimationFrame loop while idle.
- The image is replaced without leaking the WebGL context; old geometry,
  textures, and materials are disposed.

M1 intentionally has no parallax yet. The depth model and vertex displacement
land in M2/M3.

## Local development

```bash
npm install
npx playwright install chromium   # first-time E2E setup
npm run dev
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e   # serves the production build via vite preview
```

The Playwright suite runs against `dist`, so build before running it.

Measured M1 bundle (gzip): initial JS **73.0 KB**, CSS 3.8 KB; the lazy Three.js
stage adds 132.9 KB only after an image is loaded. The initial route stays well
under the 200 KB budget.

## Stack

- React 19 + TypeScript + Vite
- Three.js (native API, no react-three-fiber)
- Transformers.js + Depth Anything V2 Small, self-hosted (M2)
- Vitest + Testing Library + Playwright
- MIT licensed

## Model and third-party licenses

The pipeline uses **Depth Anything V2 Small**, released under Apache-2.0.
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

[MIT](./LICENSE) © 2026 Chunqi Sun
