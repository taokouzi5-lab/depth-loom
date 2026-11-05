import { describe, expect, it } from 'vitest'
import {
  applyLimitWithRubberBand,
  clampAngle,
  clampZoom,
  damp,
  dragToAngle,
  MAX_ZOOM,
  MIN_ZOOM,
  PITCH_LIMIT,
  YAW_LIMIT,
} from './orbit'

const DEG = Math.PI / 180

describe('applyLimitWithRubberBand', () => {
  it('leaves values inside the limit untouched', () => {
    expect(applyLimitWithRubberBand(10 * DEG, YAW_LIMIT)).toBe(10 * DEG)
    expect(applyLimitWithRubberBand(-10 * DEG, YAW_LIMIT)).toBe(-10 * DEG)
    expect(applyLimitWithRubberBand(YAW_LIMIT, YAW_LIMIT)).toBe(YAW_LIMIT)
  })

  it('resists movement beyond the limit instead of snapping', () => {
    const value = applyLimitWithRubberBand(YAW_LIMIT + 3 * DEG, YAW_LIMIT)
    expect(value).toBeGreaterThan(YAW_LIMIT)
    expect(value).toBeLessThan(YAW_LIMIT + 3 * DEG)
  })

  it('caps the overshoot and preserves the direction', () => {
    const positive = applyLimitWithRubberBand(90 * DEG, YAW_LIMIT)
    const negative = applyLimitWithRubberBand(-90 * DEG, YAW_LIMIT)
    expect(positive).toBeCloseTo(YAW_LIMIT + 5 * DEG, 6)
    expect(negative).toBeCloseTo(-(YAW_LIMIT + 5 * DEG), 6)
  })

  it('applies the same behavior to pitch', () => {
    expect(applyLimitWithRubberBand(PITCH_LIMIT + DEG, PITCH_LIMIT)).toBeLessThan(
      PITCH_LIMIT + DEG,
    )
  })

  it('handles invalid inputs defensively', () => {
    expect(applyLimitWithRubberBand(Number.NaN, YAW_LIMIT)).toBe(0)
    expect(() => applyLimitWithRubberBand(1, 0)).toThrow(/positive/i)
  })
})

describe('clampAngle', () => {
  it('clamps both directions', () => {
    expect(clampAngle(10, 5)).toBe(5)
    expect(clampAngle(-10, 5)).toBe(-5)
    expect(clampAngle(3, 5)).toBe(3)
  })
})

describe('clampZoom', () => {
  it('keeps zoom inside the supported range', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(0.1)).toBe(MIN_ZOOM)
    expect(clampZoom(9)).toBe(MAX_ZOOM)
  })

  it('falls back to 1 for non-finite input', () => {
    expect(clampZoom(Number.NaN)).toBe(1)
  })
})

describe('damp', () => {
  it('does not move when dt is zero', () => {
    expect(damp(0.2, 1, 12, 0)).toBe(0.2)
  })

  it('approaches the target without overshooting', () => {
    const next = damp(0.2, 1, 12, 1 / 60)
    expect(next).toBeGreaterThan(0.2)
    expect(next).toBeLessThan(1)
  })

  it('converges after a long frame', () => {
    expect(damp(0.2, 1, 12, 10)).toBeCloseTo(1, 6)
  })
})

describe('dragToAngle', () => {
  it('returns zero for a zero-size viewport', () => {
    expect(dragToAngle(100, 0, Math.PI / 2)).toBe(0)
  })

  it('scales pointer movement by viewport size', () => {
    expect(dragToAngle(100, 1000, Math.PI / 2)).toBeCloseTo(Math.PI / 20, 6)
    expect(dragToAngle(-100, 1000, Math.PI / 2)).toBeCloseTo(-Math.PI / 20, 6)
  })
})
