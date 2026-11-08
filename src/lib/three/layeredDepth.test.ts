import { describe, expect, it } from 'vitest'
import type { DepthMap } from '../depth/protocol'
import { computeLayerThreshold } from './layeredDepth'

function makeDepth(values: number[]): DepthMap {
  return {
    width: values.length,
    height: 1,
    data: new Float32Array(values),
  }
}

describe('computeLayerThreshold', () => {
  it('splits a bimodal depth map between the two clusters', () => {
    const values = [
      ...new Array<number>(100).fill(0.12),
      ...new Array<number>(100).fill(0.88),
    ]

    const threshold = computeLayerThreshold(makeDepth(values))

    expect(threshold).not.toBeNull()
    expect(threshold).toBeGreaterThan(0.12)
    expect(threshold).toBeLessThan(0.88)
  })

  it('returns null for a flat image with no usable depth range', () => {
    expect(computeLayerThreshold(makeDepth(new Array(64).fill(0.5)))).toBeNull()
    expect(computeLayerThreshold(makeDepth([0.5, 0.51, 0.52]))).toBeNull()
  })

  it('returns null for an empty depth map', () => {
    expect(
      computeLayerThreshold({ width: 0, height: 0, data: new Float32Array() }),
    ).toBeNull()
  })

  it('keeps the threshold inside the observed range', () => {
    const threshold = computeLayerThreshold(
      makeDepth([0.05, 0.1, 0.2, 0.75, 0.8, 0.95]),
    )

    expect(threshold).not.toBeNull()
    expect(threshold).toBeGreaterThan(0.1)
    expect(threshold).toBeLessThan(0.95)
  })
})
