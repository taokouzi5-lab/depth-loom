# ADR 0003 — Export the current view as PNG and a short WebM loop

- Status: accepted (M4, 2026-11-07)
- Date: 2026-11-07

## Context

The app should let a user take the current view away without adding a backend.
The requirements are a PNG of the current view and a 3-second looping video of
the 3D result for social sharing. The renderer is transparent; the page's dark
background is CSS, so a raw WebGL canvas would export transparent pixels.

## Decision

### PNG

- For original/3D, render the stage immediately and draw the WebGL canvas onto a
  new 2D canvas filled with `#0a0a0b`, then encode PNG with `canvas.toBlob`.
- For the depth view, the grayscale overlay canvas is already a canvas; flatten
  it onto the same background.
- Set `preserveDrawingBuffer: true` on the renderer so the capture is reliable
  when triggered from a click instead of a render loop.
- Downloads use an object URL and a temporary `<a download>` element.

### WebM

- Only enable the video action after depth is ready. If the user is not in 3D,
  switch to 3D and wait two animation frames for the material change before
  recording.
- Use `canvas.captureStream(30)` and `MediaRecorder`, preferring VP9 then VP8,
  with an 8 Mbps bitrate and no audio.
- Record for 3 seconds while applying `sin(2πt)` yaw motion (±8°) around the
  current orbit. The first and last frames match for a seamless loop.
- Temporarily set the clear color to the page background; restore the clear
  color, orbit, and idle render state afterwards.
- If MediaRecorder or a WebM encoder is unavailable, fail explicitly and show an
  export error. Do not silently produce a different format or a blank file.

## Consequences

- The PNG is flattened onto the app background and includes the stage framing,
  not a transparent cut-out. This matches "current view" and avoids invisible
  content when shared.
- The video intentionally uses the current pitch/zoom and a small yaw loop; it is
  a shareable demo, not a full animation editor.
- Safari may not encode WebM. That is documented in README Known issues and
  surfaced as an explicit error.
- `preserveDrawingBuffer` has a small rendering cost, accepted for reliable
  exports.
- E2E downloads and file-name assertions cover the original PNG, the depth PNG,
  and the WebM loop on both desktop and 375px projects.
