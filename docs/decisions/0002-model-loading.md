# ADR 0002 — Self-hosted dual-quantization model, worker inference

- Status: accepted (M1), implemented in M2
- Date: 2026-11-06

## Context

Hugging Face is often slow or unreachable from mainland China. Downloading the
model at runtime would strand most first-time visitors on the loading screen.
The model must be served from the same static origin as the app.

Depth Anything V2 Small ships several ONNX exports:

| File | Size | Intended device |
|---|---:|---|
| `model_q4f16.onnx` | 19.07 MB | WebGPU |
| `model_quantized.onnx` (q8) | 26.0 MB | WASM |
| `model_fp16.onnx` | 47.34 MB | WebGPU (higher fidelity) |

## Decision

1. **Self-host two quantizations**: q4f16 for WebGPU and q8 for WASM. Total
   committed payload is ~45 MB. The WASM path is the compatibility floor; it is
   not safe to assume a q4f16 file will run well, or at all, on every WASM
   backend.
2. **Pin Transformers.js 4.3.2.** v3.8.1 was the initial choice, but it pulls a
   sharp version covered by a high-severity advisory. v4.3.2 resolves to a fixed
   sharp and uses a current ONNX Runtime Web. The local model-loading path is
   re-verified in M2; if v4 breaks it, the fallback is v3.8.1 with a pinned
   patched sharp and a documented exception.
3. Set `env.allowRemoteModels = false` and
   `env.localModelPath = ${import.meta.env.BASE_URL}models/`. The base URL is
   injected, not hard-coded, so GitHub Pages' `/depth-loom/` subpath works.
4. Run the whole depth pipeline in a **dedicated module worker**. Model load and
   inference never block the UI thread. The worker keeps a singleton pipeline so
   switching images does not reload weights.
5. Self-host the ONNX Runtime WASM binaries under `public/ort/`, copied from
   `node_modules/onnxruntime-web` at build time. No jsDelivr dependency.
6. On GitHub Pages, `crossOriginIsolated` is false, so WASM runs with
   `numThreads = 1`. The UI must say "CPU mode, slower" rather than pretending
   the fast path is active.

## Why not fp16

fp16 is 47 MB for one device variant. q4f16 + q8 covers both device families in
roughly the same total size, and the depth map is a relative disparity field for
parallax — not a metric measurement — so the quantization error is acceptable.
The strength slider gives the user control over the final effect.

## Why not download from Hugging Face at runtime

Latency, availability, and privacy claims. A local file also makes the demo
reproducible offline after first load, and keeps the "no upload" promise easy to
verify in the network panel.

## Implementation notes (M2, 2026-11-07)

- Transformers.js 4.3.2 imports `onnxruntime-web/webgpu`, which registers only
  the WebGPU execution provider. The Vite alias in `vite.config.ts` maps it to
  `onnxruntime-web/all` so the WASM execution provider exists for fallback.
- `env.localModelPath` must be a **path** (for example `/depth-loom/models/`),
  not an absolute URL. The local-file metadata check treats HTTP URLs as remote;
  with an absolute URL it fails to discover `preprocessor_config.json`, and the
  pipeline later crashes with `this.processor is not a function`. The hook passes
  `new URL('models/', document.baseURI).pathname`.
- WebGPU is attempted only after `navigator.gpu.requestAdapter()` returns an
  adapter. Headless Chromium has none; it goes straight to WASM. The WASM path
  uses the asyncify runtime and the q8 weights.
- `env.useBrowserCache` is disabled by default in the worker. CacheStorage writes
  for the 27 MB q8 model can fail with `ERR_CACHE_WRITE_FAILURE` and surface as a
  fatal "network error" in Chromium profiles. The in-memory pipeline still means
  switching images never reloads the weights.
- ONNX Runtime runtime files are copied into `public/ort/` on `predev` and
  `prebuild`, because Transformers.js expects a WASM directory and the project
  must not rely on jsDelivr.
- The real-model E2E test estimates depth on the synthetic fixture and asserts
  that the depth canvas has real grayscale variation.

## Consequences

- The repository carries ~46.4 MB of model files. This is intentional and below
  GitHub's 100 MB per-file limit.
- First load fetches 19.1 MB (WebGPU/q4f16) or 27.3 MB (WASM/q8) of weights plus
  26–28 MB of ONNX Runtime WASM from the app origin. The UI shows byte progress.
- Model license (Apache-2.0) text, attribution, sizes, and SHA-256 values ship
  next to the weights in `MODEL_INFO.md`.
- A failed model load shows an explicit error and a retry action. Silent
  fallback is not allowed.
- The model is only for relative depth. README states it is not suitable for
  measurement, medical, or safety-critical use.
