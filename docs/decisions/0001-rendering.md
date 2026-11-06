# ADR 0001 — CPU vertex displacement with a custom fragment shader

- Status: accepted (M1), implemented (M3, 2026-11-07)
- Date: 2026-11-06

## Context

The image is rendered on a subdivided plane. A grayscale depth map drives each
vertex's z offset. The depth-strength slider must feel immediate, and the result
must stay within a 60 fps budget on a mid-range laptop.

Three options were considered:

1. `MeshStandardMaterial.displacementMap` + lights.
2. CPU displacement into the position attribute + a custom fragment shader.
3. GPU displacement in the vertex shader + a custom fragment shader.

## Decision

Use **option 2** for the MVP.

- A pure function updates the plane's z positions from the normalized depth
  array when the image or strength changes. The 257×257 grid is ~66k vertices;
  the loop is cheap and the update happens only on input, never per frame.
- A custom fragment shader derives a normal from the depth texture and adds a
  restrained directional highlight plus depth-based fog. This gives real relief
  shading and hides edge artifacts better than flat standard-material lighting.
- The original view keeps the M1 `MeshBasicMaterial`; the 3D view swaps to the
  depth `ShaderMaterial`. The depth view is a separate grayscale canvas overlay,
  so it does not disturb the 3D renderer state.

## Why not option 1

`displacementMap` moves vertices but does not recompute normals, so the surface
stays visually flat under lighting. `scene.fog` is camera-distance based, not
image-depth based, so it cannot darken the far parts of the photo.

## Why not option 3

GPU displacement is technically smoother, but it moves the displacement math
out of TypeScript and makes it harder to unit test. The CPU path is fast enough
at this vertex count and matches the project constraint: compute displacement
once, not every frame. If profiling later shows the upload is a bottleneck, the
same depth texture can be sampled in the vertex shader behind a uniform switch
without changing the public API.

## Implementation notes (M3, 2026-11-07)

- `DEPTH_DISPLACEMENT_SCALE = 0.18`: `z = (d - 0.5) × strength × 0.18`. The
  user slider is 0–2× and resets to 1× on a new image. Without the scale the
  formula would exceed the camera framing and expose edges.
- The depth map is top-down; `PlaneGeometry`'s v=1 edge is the top of the photo,
  so the CPU sampler reads `(u, 1 - v)` and bilinearly interpolates.
- The shader's depth texture is built from the same normalized `Float32Array`
  via a canvas (`CanvasTexture`, `NoColorSpace`, `flipY = true`), so it aligns
  with the image texture.
- The fragment shader estimates a normal from finite differences (one texel),
  applies a restrained light, and mixes far values toward `#0a0a0b`. It ends
  with `#include <colorspace_fragment>` so the image keeps its color pipeline.
- `DepthLayer` owns the depth texture, shader material, and mode switching; the
  stage keeps the renderer and swaps between the base and depth materials.
- The slider updates the position attribute and the `uStrength` uniform on
  input only; there is no per-frame recompute.
- The real-model E2E asserts auto-3D, the enabled strength slider, a changed
  slider value, the depth view, and grayscale variation in the depth canvas.

## Consequences

- Displacement formula and depth sampling live in
  `src/lib/three/displacement.ts` and are covered by unit tests.
- Geometry is created with 256×256 segments and a 5% bleed. UVs stay in [0, 1]:
  the photo scales with the larger plane, so the extra 5% is photo rather than
  a stretched edge-pixel border. `ClampToEdgeWrapping` handles edge filtering.
- The vertex normals are not recomputed; the fragment shader is the shading
  source of truth.
- Rotation is clamped to ±25° yaw / ±15° pitch. Disocclusion beyond that range
  is a documented MVP limitation, not an error to hide.
- Measured M3 build: initial JS 75.1 KB gzip, lazy stage 134.1 KB gzip. The
  real-model WASM E2E (load + inference + 3D + depth view) runs in ~9 s.

## M1 / M3 scope

M1 renders a flat `MeshBasicMaterial` plane. M3 adds the displaced positions,
the depth shader, the strength slider, and the original/depth/3D switch. The
geometry, camera fit, and orbit controller were already in place from M1.
