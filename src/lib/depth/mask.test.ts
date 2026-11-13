import { describe, expect, it } from 'vitest'
import {
  buildForegroundMask,
  computeDepthThreshold,
  dilateForegroundMask,
  erodeForegroundMask,
  upsampleMask,
} from './mask'
import type { DepthMap } from './protocol'

function makeDepth(values: number[], width = values.length): DepthMap {
  return { data: new Float32Array(values), width, height: 1 }
}

describe('computeDepthThreshold', () => {
  it('splits a bimodal depth map between the clusters', () => {
    const threshold = computeDepthThreshold(
      new Float32Array([
        ...new Array<number>(100).fill(0.12),
        ...new Array<number>(100).fill(0.88),
      ]),
    )

    expect(threshold).not.toBeNull()
    expect(threshold).toBeGreaterThan(0.12)
    expect(threshold).toBeLessThan(0.88)
  })

  it('returns null for flat or empty depth', () => {
    expect(computeDepthThreshold(new Float32Array(32).fill(0.5))).toBeNull()
    expect(computeDepthThreshold(new Float32Array())).toBeNull()
  })
})

describe('buildForegroundMask', () => {
  it('marks near pixels as fill and far pixels as keep', () => {
    const mask = buildForegroundMask(makeDepth([0.2, 0.8]), 0.5, 0)

    expect(Array.from(mask)).toEqual([255, 0])
  })

  it('dilates the fill region by the requested radius', () => {
    const mask = buildForegroundMask(makeDepth([0.2, 0.8]), 0.5, 1)

    expect(Array.from(mask)).toEqual([0, 0])
  })
})

describe('erodeForegroundMask', () => {
  it('shrinks the fill region by the requested radius', () => {
    const width = 7
    const height = 7
    const mask = new Uint8Array(width * height).fill(255)
    for (let y = 1; y <= 5; y += 1) {
      for (let x = 1; x <= 5; x += 1) mask[y * width + x] = 0
    }

    const eroded = erodeForegroundMask(mask, width, height, 1)

    expect(eroded[1 * width + 1]).toBe(255)
    expect(eroded[1 * width + 3]).toBe(255)
    expect(eroded[2 * width + 2]).toBe(0)
    expect(eroded[3 * width + 3]).toBe(0)
  })

  it('keeps foreground that touches the image border', () => {
    const mask = new Uint8Array(9)
    const eroded = erodeForegroundMask(mask, 3, 3, 1)

    expect(Array.from(eroded)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('returns the mask unchanged for a zero radius', () => {
    const mask = new Uint8Array([0, 255, 0])
    expect(erodeForegroundMask(mask, 3, 1, 0)).toBe(mask)
  })
})

describe('dilateForegroundMask', () => {
  it('grows the fill region into neighbouring background', () => {
    const mask = new Uint8Array([255, 255, 0, 255, 255])

    const dilated = dilateForegroundMask(mask, 5, 1, 1)

    expect(Array.from(dilated)).toEqual([255, 0, 0, 0, 255])
  })

  it('returns the mask unchanged for a zero radius', () => {
    const mask = new Uint8Array([0, 255, 0])
    expect(dilateForegroundMask(mask, 3, 1, 0)).toBe(mask)
  })
})

describe('upsampleMask', () => {
  it('expands a two-pixel mask to the target size with nearest sampling', () => {
    const upsampled = upsampleMask(new Uint8Array([255, 0]), 2, 1, 4, 2)

    expect(Array.from(upsampled)).toEqual([255, 255, 0, 0, 255, 255, 0, 0])
  })
})
