import { describe, expect, it } from 'vitest'
import { createImagePlaneGeometry, PLANE_BLEED, PLANE_SEGMENTS } from './geometry'

describe('createImagePlaneGeometry', () => {
  it('creates a 256×256 subdivided plane with an extra row and column of vertices', () => {
    const geometry = createImagePlaneGeometry(1.6)
    const position = geometry.getAttribute('position')
    expect(position.count).toBe((PLANE_SEGMENTS + 1) ** 2)
    geometry.dispose()
  })

  it('matches the image aspect and adds a 5% bleed on every side', () => {
    const aspect = 1.6
    const geometry = createImagePlaneGeometry(aspect)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    expect(box).not.toBeNull()
    if (!box) return

    const expectedWidth = aspect * (1 + PLANE_BLEED)
    const expectedHeight = 1 + PLANE_BLEED
    expect(box.max.x - box.min.x).toBeCloseTo(expectedWidth, 6)
    expect(box.max.y - box.min.y).toBeCloseTo(expectedHeight, 6)
    geometry.dispose()
  })

  it('expands UVs so ClampToEdge supplies the bleed pixels', () => {
    const geometry = createImagePlaneGeometry(1.6)
    const uv = geometry.getAttribute('uv')
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (let i = 0; i < uv.count; i += 1) {
      const u = uv.getX(i)
      const v = uv.getY(i)
      min = Math.min(min, u, v)
      max = Math.max(max, u, v)
    }
    expect(min).toBeCloseTo(-PLANE_BLEED / 2, 6)
    expect(max).toBeCloseTo(1 + PLANE_BLEED / 2, 6)
    geometry.dispose()
  })

  it('rejects a non-positive aspect ratio', () => {
    expect(() => createImagePlaneGeometry(0)).toThrow(/aspect/i)
    expect(() => createImagePlaneGeometry(-1)).toThrow(/aspect/i)
  })
})
