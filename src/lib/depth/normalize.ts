/**
 * Normalize a relative-disparity field to [0, 1]. Depth Anything outputs a
 * different scale per image, so every result must be normalized independently.
 */
export function normalizeDepth(values: ArrayLike<number>): Float32Array {
  const output = new Float32Array(values.length)
  if (values.length === 0) return output

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-8) {
    output.fill(0.5)
    return output
  }

  const range = max - min
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    output[index] = Number.isFinite(value) ? (value - min) / range : 0.5
  }

  return output
}

/** Convert normalized depth to an opaque grayscale RGBA buffer for display. */
export function depthToRgba(
  values: ArrayLike<number>,
): Uint8ClampedArray<ArrayBuffer> {
  const output = new Uint8ClampedArray(new ArrayBuffer(values.length * 4))
  for (let index = 0; index < values.length; index += 1) {
    const value = Math.min(1, Math.max(0, values[index]))
    const gray = Math.round(value * 255)
    const offset = index * 4
    output[offset] = gray
    output[offset + 1] = gray
    output[offset + 2] = gray
    output[offset + 3] = 255
  }
  return output
}
