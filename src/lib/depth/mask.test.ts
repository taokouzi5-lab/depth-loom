import { describe, expect, it } from 'vitest'
import {
  buildForegroundMask,
  computeDepthThreshold,
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

describe('upsampleMask', () => {
  it('expands a two-pixel mask to the target size with nearest sampling', () => {
    const upsampled = upsampleMask(new Uint8Array([255, 0]), 2, 1, 4, 2)

    expect(Array.from(upsampled)).toEqual([255, 255, 0, 0, 255, 255, 0, 0])
  })
})
