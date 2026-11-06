import { PlaneGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import type { DepthMap } from '../depth/protocol'
import {
  applyDepthDisplacement,
  clearDepthDisplacement,
  DEPTH_DISPLACEMENT_SCALE,
  sampleDepth,
} from './displacement'

const depth: DepthMap = {
  width: 2,
  height: 2,
  // Top row far, bottom row near.
  data: new Float32Array([0, 0, 1, 1]),
}

describe('sampleDepth', () => {
  it('samples the top and bottom rows', () => {
    expect(sampleDepth(depth, 0.5, 0)).toBe(0)
    expect(sampleDepth(depth, 0.5, 1)).toBe(1)
  })

  it('bilinearly interpolates', () => {
    expect(sampleDepth(depth, 0.5, 0.5)).toBeCloseTo(0.5, 6)
    expect(sampleDepth(depth, 0.25, 0.5)).toBeCloseTo(0.5, 6)
  })

  it('clamps outside the map and handles an empty map', () => {
    expect(sampleDepth(depth, -1, 0)).toBe(0)
    expect(sampleDepth(depth, 2, 1)).toBe(1)
    expect(sampleDepth({ width: 0, height: 0, data: new Float32Array() }, 0.5, 0.5)).toBe(0.5)
  })
})

describe('applyDepthDisplacement', () => {
  it('moves the top of the plane back and the bottom forward', () => {
    const geometry = new PlaneGeometry(1, 1, 1, 1)
    applyDepthDisplacement(geometry, depth, 1)

    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    for (let index = 0; index < position.count; index += 1) {
      const z = position.getZ(index)
      if (uv.getY(index) > 0.5) {
        expect(z).toBeLessThan(0)
      } else {
        expect(z).toBeGreaterThan(0)
      }
    }
    geometry.dispose()
  })

  it('scales with strength and reaches the documented maximum', () => {
    const geometry = new PlaneGeometry(1, 1, 1, 1)
    applyDepthDisplacement(geometry, depth, 2)

    const position = geometry.getAttribute('position')
    let maxAbs = 0
    for (let index = 0; index < position.count; index += 1) {
      maxAbs = Math.max(maxAbs, Math.abs(position.getZ(index)))
    }
    expect(maxAbs).toBeCloseTo(DEPTH_DISPLACEMENT_SCALE, 6)
    geometry.dispose()
  })

  it('clears a displaced plane', () => {
    const geometry = new PlaneGeometry(1, 1, 1, 1)
    applyDepthDisplacement(geometry, depth, 1)
    clearDepthDisplacement(geometry)

    const position = geometry.getAttribute('position')
    for (let index = 0; index < position.count; index += 1) {
      expect(position.getZ(index)).toBe(0)
    }
    geometry.dispose()
  })
})
