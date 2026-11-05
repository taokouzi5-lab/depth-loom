import { PlaneGeometry } from 'three'

export const PLANE_SEGMENTS = 256
export const PLANE_BLEED = 0.05

/**
 * A subdivided plane with a 5% bleed on every side. UVs are expanded past
 * [0, 1] so a ClampToEdge texture supplies the edge pixels instead of a hard
 * transparent border when the mesh rotates.
 */
export function createImagePlaneGeometry(aspect: number): PlaneGeometry {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error('Image aspect ratio must be positive.')
  }

  const scale = 1 + PLANE_BLEED
  const geometry = new PlaneGeometry(
    aspect * scale,
    scale,
    PLANE_SEGMENTS,
    PLANE_SEGMENTS,
  )

  const uv = geometry.getAttribute('uv')
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      uv.getX(index) * scale - PLANE_BLEED / 2,
      uv.getY(index) * scale - PLANE_BLEED / 2,
    )
  }
  uv.needsUpdate = true

  return geometry
}
