import { describe, expect, it } from 'vitest'
import { fitWithin, MAX_IMAGE_EDGE } from './resize'

describe('fitWithin', () => {
  it('scales a landscape image down to the maximum edge', () => {
    expect(fitWithin(4000, 3000, MAX_IMAGE_EDGE)).toEqual({ width: 1024, height: 768 })
  })

  it('scales a portrait image down to the maximum edge', () => {
    expect(fitWithin(3000, 4000, MAX_IMAGE_EDGE)).toEqual({ width: 768, height: 1024 })
  })

  it('never upscales a small image', () => {
    expect(fitWithin(800, 600, MAX_IMAGE_EDGE)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1024, 1024, MAX_IMAGE_EDGE)).toEqual({ width: 1024, height: 1024 })
  })

  it('keeps a 1×1 image valid', () => {
    expect(fitWithin(1, 1, MAX_IMAGE_EDGE)).toEqual({ width: 1, height: 1 })
  })

  it('rounds to whole pixels without collapsing an edge to zero', () => {
    const result = fitWithin(10_000, 1, MAX_IMAGE_EDGE)
    expect(result.width).toBe(1024)
    expect(result.height).toBe(1)
  })

  it('rejects non-positive dimensions and an invalid maximum edge', () => {
    expect(() => fitWithin(0, 100, 1024)).toThrow(/positive/i)
    expect(() => fitWithin(100, -1, 1024)).toThrow(/positive/i)
    expect(() => fitWithin(100, 100, 0)).toThrow(/maximum edge/i)
  })
})
