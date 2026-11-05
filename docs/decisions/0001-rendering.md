# ADR 0001 — CPU vertex displacement with a custom fragment shader

- Status: accepted (M1), implemented in M3
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
- The three views (image / depth / 3D) share one material and switch via a
  uniform, avoiding material churn.

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

## Consequences

- Displacement formula lives in `src/lib/three/displacement.ts` and is covered
  by unit tests.
- Geometry is created with 256×256 segments and a 5% bleed; UVs are expanded so
  `ClampToEdgeWrapping` samples edge pixels outside the photo.
- The vertex normals are not recomputed; the fragment shader is the shading
  source of truth.
- Rotation is clamped to ±25° yaw / ±15° pitch. Disocclusion beyond that range
  is a documented MVP limitation, not an error to hide.

## M1 scope

M1 renders a flat `MeshBasicMaterial` plane. The geometry, camera fit, and
orbit controller are already in place; M3 swaps in the displaced positions and
the custom shader.
