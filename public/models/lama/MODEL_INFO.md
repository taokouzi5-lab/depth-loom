# LaMa inpainting model

- Work: LaMa — Resolution-robust Large Mask Inpainting with Fourier Convolutions
- Authors: Samsung Research
- ONNX export: OpenCV Zoo (`opencv/inpainting_lama`)
- Source: https://huggingface.co/opencv/inpainting_lama
- Revision: `aee6d22f0a13e5e35af1c9a1c3afd62841fc6f3f`
- File: `inpainting_lama_2025jan.onnx`
- Size: 92,591,623 bytes
- SHA-256: `7df918ac3921d3daf0aae1d219776cf0dc4e4935f035af81841b40adcf74fdf2`
- License: Apache-2.0 (see `LICENSE` in this directory)

## Interface

- `image`: float32 `[1, 3, 512, 512]`, RGB in 0–1.
- `mask`: float32 `[1, 1, 512, 512]`, `1` = hole (foreground), `0` = keep.
- `output`: float32 `[1, 3, 512, 512]`, RGB in 0–255.

## How Depth Loom uses it

The depth worker builds a foreground mask from the depth map, crops a padded
region around the mask, resizes it to 512×512, runs LaMa in WASM, and composites
the generated pixels back only inside the feathered foreground region. The rest
of the plate is the untouched photo. If the model is unavailable, the app keeps
the classical push-pull fill.
