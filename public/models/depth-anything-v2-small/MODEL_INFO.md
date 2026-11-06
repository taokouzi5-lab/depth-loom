# Depth Anything V2 Small — local model files

These files are self-hosted so Depth Loom never needs to reach Hugging Face at
runtime. They are served from the same origin as the app.

## Provenance

- Base model: Depth Anything V2 Small
  - Authors: Lihe Yang, Bingyi Kang, Zilong Huang, Xiaogang Xu, Jiashi Feng,
    Hengshuang Zhao
  - Source: https://github.com/DepthAnything/Depth-Anything-V2
  - Model card: https://huggingface.co/depth-anything/Depth-Anything-V2-Small
- ONNX conversion: https://huggingface.co/onnx-community/depth-anything-v2-small
- License: Apache-2.0 (Small only). See `LICENSE` in this directory.
  Depth Anything V2 Base/Large/Giant are CC-BY-NC-4.0 and are not used here.
- Downloaded: 2026-11-07 via `scripts/fetch-model.mjs`.

## Files and SHA-256

| File | Bytes | SHA-256 |
|---|---:|---|
| `config.json` | 38 | — |
| `preprocessor_config.json` | 461 | — |
| `onnx/model_q4f16.onnx` | 19,126,267 | `eca72971aea64216d767c70c534160de53b5435b588d362bac6dbd5a73f9bf1e` |
| `onnx/model_quantized.onnx` | 27,258,801 | `fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d` |

## Runtime selection

- WebGPU: `model_q4f16.onnx` (`dtype: 'q4f16'`).
- WASM fallback: `model_quantized.onnx` (`dtype: 'q8'`).

The app verifies that a WebGPU adapter exists before attempting WebGPU. If the
adapter is unavailable or WebGPU initialization fails, it loads the q8 WASM
export and shows a "CPU 模式 · 较慢" badge.

## Regenerating

```bash
npm run fetch:model
```

The script verifies byte sizes and the ONNX SHA-256 values above.
