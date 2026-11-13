import type { DepthMap } from './protocol'

/** Below this depth range the image is effectively flat. */
export const MIN_DEPTH_RANGE = 0.03

const HISTOGRAM_BINS = 64

/**
 * Otsu split on the normalized depth histogram, placed midway between the two
 * class means. Returns null when the depth range is too small.
 */
export function computeDepthThreshold(data: Float32Array): number | null {
  if (data.length === 0) return null

  let min = 1
  let max = 0
  for (const value of data) {
    if (value < min) min = value
    if (value > max) max = value
  }
  if (max - min < MIN_DEPTH_RANGE) return null

  const histogram = new Array<number>(HISTOGRAM_BINS).fill(0)
  for (const value of data) {
    const bin = Math.min(
      HISTOGRAM_BINS - 1,
      Math.max(0, Math.floor(value * HISTOGRAM_BINS)),
    )
    histogram[bin] += 1
  }

  const total = data.length
  let totalSum = 0
  for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
    totalSum += bin * histogram[bin]
  }

  let backgroundWeight = 0
  let backgroundSum = 0
  let bestBin = 0
  let bestVariance = -1

  for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
    backgroundWeight += histogram[bin]
    if (backgroundWeight === 0) continue
    const foregroundWeight = total - backgroundWeight
    if (foregroundWeight === 0) break

    backgroundSum += bin * histogram[bin]
    const backgroundMean = backgroundSum / backgroundWeight
    const foregroundMean = (totalSum - backgroundSum) / foregroundWeight
    const variance =
      backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2

    if (variance > bestVariance) {
      bestVariance = variance
      bestBin = bin
    }
  }

  let classWeight = 0
  let classSum = 0
  for (let bin = 0; bin <= bestBin; bin += 1) {
    classWeight += histogram[bin]
    classSum += bin * histogram[bin]
  }
  const remainingWeight = total - classWeight
  if (classWeight === 0 || remainingWeight === 0) {
    return (bestBin + 0.5) / HISTOGRAM_BINS
  }

  const backgroundMean = classSum / classWeight
  const foregroundMean = (totalSum - classSum) / remainingWeight
  const midpoint = (backgroundMean + foregroundMean) / 2
  return Math.min(1, Math.max(0, (midpoint + 0.5) / HISTOGRAM_BINS))
}

/**
 * Inpainting mask at depth resolution: 255 = keep (background), 0 = fill
 * (foreground). The foreground is dilated so soft depth edges are covered.
 */
export function buildForegroundMask(
  depth: DepthMap,
  threshold: number,
  radius: number,
): Uint8Array {
  const { width, height } = depth
  const mask = new Uint8Array(width * height)

  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = depth.data[index] > threshold ? 0 : 255
  }
  if (radius <= 0) return mask

  const dilated = new Uint8Array(mask)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 0) continue
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const neighbourY = y + offsetY
        if (neighbourY < 0 || neighbourY >= height) continue
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (offsetX * offsetX + offsetY * offsetY > radius * radius) continue
          const neighbourX = x + offsetX
          if (neighbourX < 0 || neighbourX >= width) continue
          dilated[neighbourY * width + neighbourX] = 0
        }
      }
    }
  }
  return dilated
}

/**
 * Shrink the fill (foreground) region by a safety radius. Composite generated
 * pixels only where the renderer's feathered matte is fully opaque; under the
 * feather the plate must stay the untouched photo, otherwise the blend of
 * foreground and generated content reads as a haze ring at rest.
 */
export function erodeForegroundMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return mask

  const eroded = new Uint8Array(mask)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 0) continue

      let core = true
      for (let offsetY = -radius; offsetY <= radius && core; offsetY += 1) {
        const neighbourY = y + offsetY
        if (neighbourY < 0 || neighbourY >= height) continue
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (offsetX * offsetX + offsetY * offsetY > radius * radius) continue
          const neighbourX = x + offsetX
          if (neighbourX < 0 || neighbourX >= width) continue
          if (mask[neighbourY * width + neighbourX] !== 0) {
            core = false
            break
          }
        }
      }
      if (!core) eroded[y * width + x] = 255
    }
  }
  return eroded
}

/**
 * Grow the fill (foreground) region by a radius. Depth edges are soft, so
 * object pixels regularly sit just outside the thresholded mask; if the plate
 * kept them, they would be duplicated behind the foreground card as soon as
 * the cards separate.
 */
export function dilateForegroundMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return mask

  const dilated = new Uint8Array(mask)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 0) continue

      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const neighbourY = y + offsetY
        if (neighbourY < 0 || neighbourY >= height) continue
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (offsetX * offsetX + offsetY * offsetY > radius * radius) continue
          const neighbourX = x + offsetX
          if (neighbourX < 0 || neighbourX >= width) continue
          dilated[neighbourY * width + neighbourX] = 0
        }
      }
    }
  }
  return dilated
}

/** Nearest-neighbour upscale of a depth-resolution mask to image resolution. */
export function upsampleMask(
  mask: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const output = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor((y * sourceHeight) / height),
    )
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor((x * sourceWidth) / width),
      )
      output[y * width + x] = mask[sourceY * sourceWidth + sourceX]
    }
  }
  return output
}
