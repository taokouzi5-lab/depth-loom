export const DEFAULT_CAMERA_FILL = 0.66

export interface CameraFitOptions {
  imageWidth: number
  imageHeight: number
  viewportWidth: number
  viewportHeight: number
  fovDeg: number
  /** Fraction of the limiting viewport dimension the image may occupy. */
  fill?: number
}

/**
 * Distance at which a 1-unit-tall plane (width = image aspect) fits inside the
 * viewport while occupying approximately `fill` of the limiting dimension.
 *
 * The plane is centred at the origin and the camera looks down -Z from +Z.
 */
export function computeCameraDistance({
  imageWidth,
  imageHeight,
  viewportWidth,
  viewportHeight,
  fovDeg,
  fill = DEFAULT_CAMERA_FILL,
}: CameraFitOptions): number {
  const dimensions = [imageWidth, imageHeight, viewportWidth, viewportHeight]
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Image and viewport dimensions must be positive.')
  }
  if (!Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) {
    throw new Error('FOV must be between 0 and 180 degrees.')
  }
  if (!Number.isFinite(fill) || fill <= 0 || fill > 1) {
    throw new Error('Camera fill must be greater than 0 and at most 1.')
  }

  const imageAspect = imageWidth / imageHeight
  const viewportAspect = viewportWidth / viewportHeight
  const tanHalfFov = Math.tan((fovDeg * Math.PI) / 180 / 2)

  const distanceByHeight = 1 / (2 * tanHalfFov * fill)
  const distanceByWidth = imageAspect / (2 * tanHalfFov * viewportAspect * fill)

  return Math.max(distanceByHeight, distanceByWidth)
}
