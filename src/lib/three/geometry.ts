import { PlaneGeometry } from 'three'

export const PLANE_SEGMENTS = 256
export const PLANE_BLEED = 0.05

/**
 * A subdivided plane with a 5% bleed on every side. The photo is scaled with
 * the plane (UVs stay in [0, 1]), so the extra 5% is photo rather than a
 * stretched edge-pixel border. ClampToEdge still handles filtering at the edge.
 */
export function createImagePlaneGeometry(aspect: number): PlaneGeometry {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error('Image aspect ratio must be positive.')
  }

  const scale = 1 + PLANE_BLEED
  return new PlaneGeometry(
    aspect * scale,
    scale,
    PLANE_SEGMENTS,
    PLANE_SEGMENTS,
  )
}
