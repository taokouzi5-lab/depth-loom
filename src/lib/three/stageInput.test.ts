import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, PITCH_LIMIT, YAW_LIMIT } from './orbit'
import { createStageInput, type StageInputHost } from './stageInput'

type HostState = {
  yaw: number
  pitch: number
  zoom: number
  renders: number
  resets: number
}

function createHost(state: HostState): { host: StageInputHost; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'setPointerCapture', { value: () => {} })

  const host: StageInputHost = {
    canvas,
    viewportWidth: () => 1000,
    viewportHeight: () => 1000,
    getTargetYaw: () => state.yaw,
    getTargetPitch: () => state.pitch,
    getTargetZoom: () => state.zoom,
    setTargetYaw: (value) => {
      state.yaw = value
    },
    setTargetPitch: (value) => {
      state.pitch = value
    },
    setTargetZoom: (value) => {
      state.zoom = value
    },
    reset: () => {
      state.resets += 1
    },
    requestRender: () => {
      state.renders += 1
    },
  }

  return { host, canvas }
}

function pointerEvent(
  type: string,
  { pointerId, clientX = 0, clientY = 0 }: { pointerId: number; clientX?: number; clientY?: number },
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event
}

function setup() {
  const state: HostState = { yaw: 0, pitch: 0, zoom: 1, renders: 0, resets: 0 }
  const { host, canvas } = createHost(state)
  const input = createStageInput(host)
  input.attach()
  return { state, canvas, input }
}

describe('stage input', () => {
  it('converts drag deltas into viewport-scaled yaw and pitch', () => {
    const { state, canvas } = setup()

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 350, clientY: 300 }))

    expect(state.yaw).toBeCloseTo(Math.PI / 8)
    expect(state.pitch).toBeCloseTo(-Math.PI * 0.07)
    expect(state.renders).toBeGreaterThan(0)
  })

  it('springs the orbit back inside the hard limits on release', () => {
    const { state, canvas } = setup()

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1 }))
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 5000 }))
    expect(Math.abs(state.yaw)).toBeGreaterThan(YAW_LIMIT)

    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }))

    expect(state.yaw).toBeCloseTo(YAW_LIMIT)
    expect(Math.abs(state.pitch)).toBeLessThanOrEqual(PITCH_LIMIT)
  })

  it('zooms with the wheel and clamps to the allowed range', () => {
    const { state, canvas } = setup()

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
    expect(state.zoom).toBeCloseTo(Math.exp(0.12))

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -10000, cancelable: true }))
    expect(state.zoom).toBe(MAX_ZOOM)
  })

  it('pinches with two pointers and re-baselines when one lifts', () => {
    const { state, canvas } = setup()

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0 }))
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 100 }))
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 200 }))

    expect(state.zoom).toBe(MAX_ZOOM)

    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 2 }))
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50 }))

    // The remaining finger keeps dragging instead of jumping the pinch.
    expect(state.yaw).toBeCloseTo(Math.PI / 40)
  })

  it('handles arrow keys, Home, and double click', () => {
    const { state, canvas } = setup()

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(state.yaw).toBeCloseTo((-2.5 * Math.PI) / 180)

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    expect(state.pitch).toBeCloseTo((2 * Math.PI) / 180)

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
    expect(state.resets).toBe(1)

    canvas.dispatchEvent(new MouseEvent('dblclick'))
    expect(state.resets).toBe(2)
  })

  it('stops responding after detach', () => {
    const { state, canvas, input } = setup()
    input.detach()

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1 }))

    expect(state.zoom).toBe(1)
    expect(state.renders).toBe(0)
  })
})
