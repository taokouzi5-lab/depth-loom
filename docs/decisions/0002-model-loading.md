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

## Consequences

- The repository carries ~45 MB of model files. This is intentional and below
  GitHub's 100 MB per-file limit.
- First load fetches 19 MB (WebGPU) or 26 MB (WASM) from the app origin. It is
  cached by the browser; the UI shows byte progress.
- Model license (Apache-2.0) text and attribution ship next to the weights.
- A failed model load must show an explicit error and a retry action. Silent
  fallback is not allowed.
- The model is only for relative depth. README must state it is not suitable for
  measurement, medical, or safety-critical use.
