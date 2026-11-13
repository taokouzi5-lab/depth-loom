import type { BufferGeometry } from 'three'
import type { DepthMap } from '../depth/protocol'

/**
 * The 0–2 user strength is scaled into plane units. At 2 the strongest relief
 * is ±0.18 world units on a 1-unit-tall plane, which stays inside the gallery
 * framing and the orbit limit.
 */
export const DEPTH_DISPLACEMENT_SCALE = 0.18

/** Bilinear sample of a top-down normalized depth map. */
export function sampleDepth(depth: DepthMap, u: number, v: number): number {
  if (depth.width <= 0 || depth.height <= 0 || depth.data.length === 0) {
    return 0.5
  }

  const x = Math.min(1, Math.max(0, u)) * (depth.width - 1)
  const y = Math.min(1, Math.max(0, v)) * (depth.height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(depth.width - 1, x0 + 1)
  const y1 = Math.min(depth.height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0

  const row0 = y0 * depth.width
  const row1 = y1 * depth.width
  const top = depth.data[row0 + x0] * (1 - fx) + depth.data[row0 + x1] * fx
  const bottom = depth.data[row1 + x0] * (1 - fx) + depth.data[row1 + x1] * fx

  return top * (1 - fy) + bottom * fy
}

type DisplacementOptions = {
  /** World-space z at depth 0 or 1, before strength. */
  scale?: number
  /**
   * Fraction of the plane's edge over which the displacement fades to zero.
   * Pinning the border keeps the photo frame rectangular; without it the whole
   * plane bends and the image looks melted.
   */
  edgeFalloff?: number
}

/**
 * Displace the plane's z positions once per image/strength change. The depth
 * map is top-down; PlaneGeometry's v=1 edge is the top of the image.
 */
export function applyDepthDisplacement(
  geometry: BufferGeometry,
  depth: DepthMap,
  strength: number,
  options: DisplacementOptions = {},
): void {
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  if (!position || !uv) return

  const count = Math.min(position.count, uv.count)
  const zScale = options.scale ?? DEPTH_DISPLACEMENT_SCALE
  const edgeFalloff = options.edgeFalloff ?? 0

  for (let index = 0; index < count; index += 1) {
    const u = uv.getX(index)
    const v = uv.getY(index)
    const d = sampleDepth(depth, u, 1 - v)
    let weight = 1
    if (edgeFalloff > 0) {
      const falloffU = Math.min(1, Math.min(u, 1 - u) / edgeFalloff)
      const falloffV = Math.min(1, Math.min(v, 1 - v) / edgeFalloff)
      weight =
        (falloffU * falloffU * (3 - 2 * falloffU)) *
        (falloffV * falloffV * (3 - 2 * falloffV))
    }
    position.setZ(index, (d - 0.5) * strength * zScale * weight)
  }
  position.needsUpdate = true
}

/** Reset the plane to flat without needing a depth map. */
export function clearDepthDisplacement(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position')
  if (!position) return

  for (let index = 0; index < position.count; index += 1) {
    position.setZ(index, 0)
  }
  position.needsUpdate = true
}
