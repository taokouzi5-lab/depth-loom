import { describe, expect, it } from 'vitest'
import { computeCameraDistance } from './cameraFit'

const FOV_DEG = 45
const FILL = 0.66

function expectedDistance(input: {
  imageWidth: number
  imageHeight: number
  viewportWidth: number
  viewportHeight: number
  fill?: number
}): number {
  const fill = input.fill ?? FILL
  const tan = Math.tan((FOV_DEG * Math.PI) / 180 / 2)
  const imageAspect = input.imageWidth / input.imageHeight
  const viewportAspect = input.viewportWidth / input.viewportHeight
  return Math.max(1 / (2 * tan * fill), imageAspect / (2 * tan * viewportAspect * fill))
}

describe('computeCameraDistance', () => {
  it('fits a landscape image on a wide desktop viewport', () => {
    const input = {
      imageWidth: 1600,
      imageHeight: 1000,
      viewportWidth: 1600,
      viewportHeight: 900,
    }
    expect(computeCameraDistance({ ...input, fovDeg: FOV_DEG, fill: FILL })).toBeCloseTo(
      expectedDistance(input),
      6,
    )
  })

  it('fits a portrait image by height on a wide viewport', () => {
    const input = {
      imageWidth: 800,
      imageHeight: 1200,
      viewportWidth: 1600,
      viewportHeight: 900,
    }
    expect(computeCameraDistance({ ...input, fovDeg: FOV_DEG, fill: FILL })).toBeCloseTo(
      expectedDistance(input),
      6,
    )
  })

  it('moves back when the viewport becomes tall and narrow', () => {
    const input = {
      imageWidth: 1600,
      imageHeight: 1000,
      viewportWidth: 400,
      viewportHeight: 1000,
    }
    const distance = computeCameraDistance({ ...input, fovDeg: FOV_DEG, fill: FILL })
    expect(distance).toBeCloseTo(expectedDistance(input), 6)
    expect(distance).toBeGreaterThan(
      computeCameraDistance({
        ...input,
        viewportWidth: 1600,
        viewportHeight: 1000,
        fovDeg: FOV_DEG,
        fill: FILL,
      }),
    )
  })

  it('uses a smaller distance when the requested fill is larger', () => {
    const base = {
      imageWidth: 1600,
      imageHeight: 1000,
      viewportWidth: 1600,
      viewportHeight: 900,
      fovDeg: FOV_DEG,
    }
    expect(computeCameraDistance({ ...base, fill: 0.8 })).toBeLessThan(
      computeCameraDistance({ ...base, fill: 0.6 }),
    )
  })

  it('rejects invalid dimensions, FOV, and fill', () => {
    const base = {
      imageWidth: 1600,
      imageHeight: 1000,
      viewportWidth: 1600,
      viewportHeight: 900,
      fovDeg: FOV_DEG,
      fill: FILL,
    }
    expect(() => computeCameraDistance({ ...base, imageWidth: 0 })).toThrow(/positive/i)
    expect(() => computeCameraDistance({ ...base, viewportHeight: 0 })).toThrow(/positive/i)
    expect(() => computeCameraDistance({ ...base, fovDeg: 0 })).toThrow(/FOV/i)
    expect(() => computeCameraDistance({ ...base, fill: 0 })).toThrow(/fill/i)
  })
})
