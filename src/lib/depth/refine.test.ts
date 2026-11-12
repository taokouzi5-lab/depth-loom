import { describe, expect, it } from 'vitest'
import { refineDepthWithColor } from './refine'

function rgbaFrom(colors: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4)
  colors.forEach(([r, g, b], index) => {
    data[index * 4] = r
    data[index * 4 + 1] = g
    data[index * 4 + 2] = b
    data[index * 4 + 3] = 255
  })
  return data
}

describe('refineDepthWithColor', () => {
  it('pulls a misaligned depth edge toward the color edge', () => {
    const depth = new Float32Array([0.2, 0.9, 0.9, 0.9])
    const colors = rgbaFrom([
      [0, 0, 0],
      [0, 0, 0],
      [255, 255, 255],
      [255, 255, 255],
    ])

    const refined = refineDepthWithColor(depth, 4, 1, colors, 4, 1)

    expect(refined[0]).toBeGreaterThan(0.2)
    expect(refined[1]).toBeLessThan(0.9)
  })

  it('returns the input when dimensions do not match', () => {
    const depth = new Float32Array([0.5])
    const refined = refineDepthWithColor(depth, 2, 1, new Uint8ClampedArray(4), 1, 1)
    expect(refined).toBe(depth)
  })

  it('keeps a flat depth map flat', () => {
    const depth = new Float32Array(4).fill(0.5)
    const colors = rgbaFrom([
      [0, 0, 0],
      [255, 255, 255],
      [0, 0, 0],
      [255, 255, 255],
    ])
    const refined = refineDepthWithColor(depth, 2, 2, colors, 2, 2)
    expect(Array.from(refined)).toEqual([0.5, 0.5, 0.5, 0.5])
  })
})
