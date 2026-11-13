import { describe, expect, it } from 'vitest'
import { createPushPullFill } from './fill'

function makeImage(
  pixels: Array<[number, number, number]>,
  width: number,
  height: number,
) {
  const data = new Uint8ClampedArray(width * height * 4)
  pixels.forEach(([red, green, blue], index) => {
    data[index * 4] = red
    data[index * 4 + 1] = green
    data[index * 4 + 2] = blue
    data[index * 4 + 3] = 255
  })
  return { data, width, height }
}

describe('createPushPullFill', () => {
  it('fills a hole with the nearest background colour', () => {
    const source = makeImage(
      [
        [255, 0, 0],
        [0, 0, 255],
      ],
      2,
      1,
    )
    const keep = new Uint8Array([255, 0])

    const filled = createPushPullFill(source, keep, 2)

    expect(filled).not.toBeNull()
    expect(filled?.width).toBe(2)
    expect(Array.from(filled!.data.slice(0, 4))).toEqual([255, 0, 0, 255])
    expect(filled!.data[4]).toBe(255)
    expect(filled!.data[5]).toBe(0)
    expect(filled!.data[6]).toBe(0)
  })

  it('blends colours across a larger hole without darkening', () => {
    const source = makeImage(
      [
        [255, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 255],
      ],
      4,
      1,
    )
    const keep = new Uint8Array([255, 0, 0, 255])

    const filled = createPushPullFill(source, keep, 4)

    expect(filled).not.toBeNull()
    const middle = Array.from(filled!.data.slice(4, 8))
    expect(middle[0]).toBeGreaterThan(0)
    expect(middle[2]).toBeGreaterThan(0)
    expect(middle[3]).toBe(255)
  })

  it('returns the source unchanged when every pixel is background', () => {
    const source = makeImage(
      [
        [10, 20, 30],
        [40, 50, 60],
      ],
      2,
      1,
    )
    const filled = createPushPullFill(source, new Uint8Array([255, 255]), 2)

    expect(Array.from(filled!.data.slice(0, 4))).toEqual([10, 20, 30, 255])
    expect(Array.from(filled!.data.slice(4, 8))).toEqual([40, 50, 60, 255])
  })

  it('returns null when there is no background pixel to sample', () => {
    const source = makeImage([[10, 20, 30]], 1, 1)

    expect(createPushPullFill(source, new Uint8Array([0]), 1)).toBeNull()
  })

  it('downsamples to maxWidth while filling', () => {
    const pixels: Array<[number, number, number]> = []
    for (let x = 0; x < 8; x += 1) pixels.push([x * 10, 0, 0])
    const source = makeImage(pixels, 8, 1)
    const keep = new Uint8Array(8)
    keep[0] = 255

    const filled = createPushPullFill(source, keep, 4)

    expect(filled?.width).toBe(4)
    expect(filled?.data.length).toBe(4 * 4)
  })
})
