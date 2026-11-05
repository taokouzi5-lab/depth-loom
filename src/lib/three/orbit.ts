const DEG_TO_RAD = Math.PI / 180

export const YAW_LIMIT = 25 * DEG_TO_RAD
export const PITCH_LIMIT = 15 * DEG_TO_RAD
export const MAX_OVERSHOOT = 5 * DEG_TO_RAD
export const RUBBER_BAND_FACTOR = 0.18
export const MIN_ZOOM = 0.82
export const MAX_ZOOM = 1.32

/**
 * Let the user pull a little past the hard limit, with resistance, then spring
 * back on release. This reads as elastic rather than broken.
 */
export function applyLimitWithRubberBand(
  value: number,
  limit: number,
  overshoot = MAX_OVERSHOOT,
  factor = RUBBER_BAND_FACTOR,
): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('Angle limit must be positive.')
  }
  if (!Number.isFinite(value)) {
    return 0
  }

  const magnitude = Math.abs(value)
  if (magnitude <= limit) {
    return value
  }

  const extra = Math.min((magnitude - limit) * factor, overshoot)
  return Math.sign(value) * (limit + extra)
}

export function clampAngle(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value))
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (dt <= 0) {
    return current
  }
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

/** Convert a pointer delta in pixels into an angle, scaled by viewport size. */
export function dragToAngle(deltaPx: number, viewportPx: number, sweepRad: number): number {
  if (!Number.isFinite(viewportPx) || viewportPx <= 0) {
    return 0
  }
  return (deltaPx / viewportPx) * sweepRad
}
