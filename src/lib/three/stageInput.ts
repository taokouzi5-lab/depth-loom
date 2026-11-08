import {
  applyLimitWithRubberBand,
  clampAngle,
  clampZoom,
  dragToAngle,
  PITCH_LIMIT,
  YAW_LIMIT,
} from './orbit'

const YAW_SWEEP = Math.PI * 0.5
const PITCH_SWEEP = Math.PI * 0.35
const WHEEL_ZOOM_SPEED = 0.0012
const KEY_YAW_STEP = (2.5 * Math.PI) / 180
const KEY_PITCH_STEP = (2 * Math.PI) / 180

/** The stage state the pointer/keyboard input is allowed to read and mutate. */
export interface StageInputHost {
  canvas: HTMLCanvasElement
  viewportWidth(): number
  viewportHeight(): number
  getTargetYaw(): number
  getTargetPitch(): number
  getTargetZoom(): number
  setTargetYaw(value: number): void
  setTargetPitch(value: number): void
  setTargetZoom(value: number): void
  reset(): void
  requestRender(): void
}

export interface StageInput {
  attach(): void
  detach(): void
}

class PointerInputController implements StageInput {
  private readonly host: StageInputHost
  private readonly pointers = new Map<number, { x: number; y: number }>()

  private dragging = false
  private dragPointerId: number | null = null
  private dragStartX = 0
  private dragStartY = 0
  private dragStartYaw = 0
  private dragStartPitch = 0
  private pinchStartDistance = 0
  private pinchStartZoom = 1

  constructor(host: StageInputHost) {
    this.host = host
  }

  attach(): void {
    const { canvas } = this.host
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointercancel', this.handlePointerUp)
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    canvas.addEventListener('keydown', this.handleKeyDown)
    canvas.addEventListener('dblclick', this.handleDoubleClick)
  }

  detach(): void {
    const { canvas } = this.host
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointercancel', this.handlePointerUp)
    canvas.removeEventListener('wheel', this.handleWheel)
    canvas.removeEventListener('keydown', this.handleKeyDown)
    canvas.removeEventListener('dblclick', this.handleDoubleClick)
    this.pointers.clear()
  }

  private pointerDistance(): number {
    const points = Array.from(this.pointers.values())
    const first = points[0]
    const second = points[1]
    if (!first || !second) return 0
    return Math.hypot(first.x - second.x, first.y - second.y)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault()
    this.host.canvas.focus({ preventScroll: true })
    this.host.canvas.setPointerCapture(event.pointerId)
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (this.pointers.size === 1) {
      this.dragging = true
      this.dragPointerId = event.pointerId
      this.dragStartX = event.clientX
      this.dragStartY = event.clientY
      this.dragStartYaw = this.host.getTargetYaw()
      this.dragStartPitch = this.host.getTargetPitch()
    } else if (this.pointers.size === 2) {
      this.dragging = false
      this.dragPointerId = null
      this.pinchStartDistance = this.pointerDistance()
      this.pinchStartZoom = this.host.getTargetZoom()
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (this.pointers.size >= 2 && this.pinchStartDistance > 0) {
      const distance = this.pointerDistance()
      this.host.setTargetZoom(
        clampZoom(this.pinchStartZoom * (distance / this.pinchStartDistance)),
      )
      this.host.requestRender()
      return
    }

    if (!this.dragging || this.dragPointerId !== event.pointerId) return

    const dx = event.clientX - this.dragStartX
    const dy = event.clientY - this.dragStartY
    this.host.setTargetYaw(
      applyLimitWithRubberBand(
        this.dragStartYaw +
          dragToAngle(dx, this.host.viewportWidth(), YAW_SWEEP),
        YAW_LIMIT,
      ),
    )
    this.host.setTargetPitch(
      applyLimitWithRubberBand(
        this.dragStartPitch +
          dragToAngle(-dy, this.host.viewportHeight(), PITCH_SWEEP),
        PITCH_LIMIT,
      ),
    )
    this.host.requestRender()
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId)

    if (this.pointers.size >= 2) {
      // A third finger left: re-baseline the pinch instead of jumping.
      this.pinchStartDistance = this.pointerDistance()
      this.pinchStartZoom = this.host.getTargetZoom()
      this.dragging = false
      this.dragPointerId = null
      this.host.requestRender()
      return
    }

    this.pinchStartDistance = 0

    if (this.pointers.size === 0) {
      this.dragging = false
      this.dragPointerId = null
      this.host.setTargetYaw(clampAngle(this.host.getTargetYaw(), YAW_LIMIT))
      this.host.setTargetPitch(clampAngle(this.host.getTargetPitch(), PITCH_LIMIT))
      this.host.requestRender()
      return
    }

    const remaining = Array.from(this.pointers.entries())[0]
    if (!remaining) return

    const [pointerId, point] = remaining
    this.dragging = true
    this.dragPointerId = pointerId
    this.dragStartX = point.x
    this.dragStartY = point.y
    this.dragStartYaw = this.host.getTargetYaw()
    this.dragStartPitch = this.host.getTargetPitch()
    this.host.requestRender()
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.host.setTargetZoom(
      clampZoom(
        this.host.getTargetZoom() * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED),
      ),
    )
    this.host.requestRender()
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Home') {
      event.preventDefault()
      this.host.reset()
      return
    }

    if (event.key === 'ArrowLeft') {
      this.host.setTargetYaw(
        clampAngle(this.host.getTargetYaw() - KEY_YAW_STEP, YAW_LIMIT),
      )
    } else if (event.key === 'ArrowRight') {
      this.host.setTargetYaw(
        clampAngle(this.host.getTargetYaw() + KEY_YAW_STEP, YAW_LIMIT),
      )
    } else if (event.key === 'ArrowUp') {
      this.host.setTargetPitch(
        clampAngle(this.host.getTargetPitch() + KEY_PITCH_STEP, PITCH_LIMIT),
      )
    } else if (event.key === 'ArrowDown') {
      this.host.setTargetPitch(
        clampAngle(this.host.getTargetPitch() - KEY_PITCH_STEP, PITCH_LIMIT),
      )
    } else {
      return
    }

    event.preventDefault()
    this.host.requestRender()
  }

  private readonly handleDoubleClick = (): void => {
    this.host.reset()
  }
}

export function createStageInput(host: StageInputHost): StageInput {
  return new PointerInputController(host)
}
