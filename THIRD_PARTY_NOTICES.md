# Third-Party Notices

Depth Loom is MIT licensed. The following third-party works are used at build
time or runtime. Full license texts are included with the distributed source
where required; the model license text will live next to the model files in
`public/models/depth-anything-v2-small/LICENSE` (added in M2).

## Depth Anything V2 Small

- Work: Depth Anything V2 Small (model weights and code)
- Authors: Lihe Yang, Bingyi Kang, Zilong Huang, Xiaogang Xu, Jiashi Feng,
  Hengshuang Zhao
- Source: https://github.com/DepthAnything/Depth-Anything-V2
- Model card: https://huggingface.co/depth-anything/Depth-Anything-V2-Small
- License: **Apache-2.0** (Small only; Base/Large/Giant are CC-BY-NC-4.0 and
  are not used by this project)
- ONNX conversion: https://huggingface.co/onnx-community/depth-anything-v2-small
  (Apache-2.0)

The model weights are redistributed unmodified in ONNX form. The ONNX files are
converted and quantized by the onnx-community conversion repository; Depth Loom
only renames the local directory to keep the loader path stable.

## DINOv2 (Depth Anything V2 backbone)

- Work: DINOv2 code and model weights
- Authors: Meta AI Research (FAIR)
- Source: https://github.com/facebookresearch/dinov2
- License: Apache-2.0

## Transformers.js

- Package: `@huggingface/transformers`
- Source: https://github.com/huggingface/transformers.js
- License: Apache-2.0

## ONNX Runtime Web

- Package: `onnxruntime-web` (transitive dependency of Transformers.js)
- Source: https://github.com/microsoft/onnxruntime
- License: MIT

## Three.js

- Package: `three`
- Source: https://github.com/mrdoob/three.js
- License: MIT

## React / React DOM

- Packages: `react`, `react-dom`
- Source: https://github.com/facebook/react
- License: MIT

## Vite

- Package: `vite`
- Source: https://github.com/vitejs/vite
- License: MIT

## Test and build tooling

Vitest, Testing Library, Playwright, jsdom, TypeScript, and Oxlint are
development-only dependencies. Their licenses are listed in
`package-lock.json`; all are permissive (MIT / Apache-2.0 / ISC / BSD).

## MIT license text

The following copyright notices apply to MIT-licensed runtime and build
dependencies. The full MIT permission text is reproduced once below; it applies
to each listed work.

- React / React DOM: Copyright (c) Meta Platforms, Inc. and affiliates.
- Three.js: Copyright © 2010-2026 three.js authors.
- Vite: Copyright (c) 2019-present, VoidZero Inc. and Vite contributors.

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The full Apache-2.0 text for Transformers.js and the Depth Anything V2 Small
model is included at
`public/models/depth-anything-v2-small/LICENSE`, alongside the ONNX weights and
the provenance/checksum file `MODEL_INFO.md`.

## Images

The only committed image is the synthetic E2E fixture
`e2e/fixtures/landscape.png`, generated from `e2e/fixtures/landscape.svg` by the
project author and dedicated to CC0 1.0. It contains no third-party photography,
people, or trademarks.

User-facing sample images added in M4 must be CC0 or public domain, with author,
source, and license recorded in `public/samples/CREDITS.md`.
