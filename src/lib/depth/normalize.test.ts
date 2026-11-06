import { describe, expect, it } from 'vitest'
import { depthToRgba, normalizeDepth } from './normalize'

describe('normalizeDepth', () => {
  it('maps the min and max to 0 and 1 and preserves order', () => {
    const result = Array.from(normalizeDepth(new Float32Array([4, 2, 8, 6])))
    expect(result[0]).toBeCloseTo(1 / 3, 6)
    expect(result[1]).toBe(0)
    expect(result[2]).toBe(1)
    expect(result[3]).toBeCloseTo(2 / 3, 6)
  })

  it('handles negative values', () => {
    const result = Array.from(normalizeDepth([-2, 0, 2]))
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0.5)
    expect(result[2]).toBe(1)
  })

  it('returns 0.5 for a constant map', () => {
    expect(Array.from(normalizeDepth([7, 7, 7]))).toEqual([0.5, 0.5, 0.5])
  })

  it('handles empty and non-finite input defensively', () => {
    expect(normalizeDepth([])).toHaveLength(0)
    const result = normalizeDepth([Number.NaN, 1, 3, Number.POSITIVE_INFINITY])
    expect(result[0]).toBe(0.5)
    expect(result[1]).toBe(0)
    expect(result[2]).toBe(1)
    expect(result[3]).toBe(0.5)
  })
})

describe('depthToRgba', () => {
  it('produces opaque grayscale pixels', () => {
    const rgba = depthToRgba([0, 0.5, 1])
    expect(Array.from(rgba)).toEqual([
      0, 0, 0, 255,
      128, 128, 128, 255,
      255, 255, 255, 255,
    ])
  })

  it('clamps values outside 0..1', () => {
    const rgba = depthToRgba([-1, 2])
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })
})
