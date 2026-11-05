export const MAX_IMAGE_EDGE = 1024

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Fit an image inside a square of `maxEdge` without upscaling.
 * Both sides stay at least 1px so extremely wide panoramas remain valid.
 */
export function fitWithin(width: number, height: number, maxEdge: number): ImageDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Image dimensions must be positive.')
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    throw new Error('Maximum edge must be positive.')
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height))

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
