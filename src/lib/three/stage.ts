import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import type { CanvasTexture, PlaneGeometry } from 'three'
import type { DepthMap } from '../depth/protocol'
import type { ProcessedImage } from '../image/decode'
import { computeCameraDistance } from './cameraFit'
import { DepthLayer, type StageView } from './depthLayer'
import { createImagePlaneGeometry } from './geometry'
import {
  applyLimitWithRubberBand,
  clampAngle,
  clampZoom,
  damp,
  dragToAngle,
  PITCH_LIMIT,
  YAW_LIMIT,
} from './orbit'
import {
  createStageCaptureApi,
  type StageCaptureApi,
} from './stageCapture'
import type { ImageStage, ImageStageOptions } from './stageTypes'
import { createImageTexture } from './textures'

const FOV_DEG = 45
const DESKTOP_FILL = 0.8
const MOBILE_FILL = 0.72
const MOBILE_WIDTH = 640
const YAW_SWEEP = Math.PI * 0.5
const PITCH_SWEEP = Math.PI * 0.35
const WHEEL_ZOOM_SPEED = 0.0012
const DRAG_LAMBDA = 14
const SETTLE_EPSILON = 0.0002
const MAX_DPR = 2
const KEY_YAW_STEP = (2.5 * Math.PI) / 180
const KEY_PITCH_STEP = (2 * Math.PI) / 180

class ImageStageController implements ImageStage {
  private readonly container: HTMLElement
  private readonly renderer: WebGLRenderer
  private readonly canvas: HTMLCanvasElement
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FOV_DEG, 1, 0.1, 100)
  private readonly group = new Group()
  private readonly mesh: Mesh
  private readonly resizeObserver: ResizeObserver
  private readonly pointers = new Map<number, { x: number; y: number }>()

  private currentImage: ProcessedImage
  private geometry: PlaneGeometry
  private texture: CanvasTexture
  private material: MeshBasicMaterial
  private depthLayer: DepthLayer
  private readonly captureApi: StageCaptureApi

  private baseDistance = 1
  private zoom = 1
  private targetZoom = 1
  private yaw = 0
  private pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private rafId = 0
  private lastTime = 0

  private dragging = false
  private dragPointerId: number | null = null
  private dragStartX = 0
  private dragStartY = 0
  private dragStartYaw = 0
  private dragStartPitch = 0
  private pinchStartDistance = 0
  private pinchStartZoom = 1

  constructor({ container, image, ariaLabel }: ImageStageOptions) {
    this.container = container
    this.currentImage = image

    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
    this.renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight),
      false,
    )
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = SRGBColorSpace

    this.canvas = this.renderer.domElement
    this.canvas.className = 'dl-canvas'
    this.canvas.tabIndex = 0
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute('aria-label', ariaLabel ?? '可拖拽旋转的 3D 照片。')
    container.appendChild(this.canvas)

    this.scene.add(this.group)
    this.geometry = createImagePlaneGeometry(image.width / image.height)
    this.texture = createImageTexture(this.renderer, image)
    this.material = new MeshBasicMaterial({ map: this.texture, toneMapped: false })
    this.mesh = new Mesh(this.geometry, this.material)
    this.group.add(this.mesh)
    this.depthLayer = new DepthLayer(
      this.mesh,
      this.geometry,
      this.material,
      this.texture,
      () => this.requestRender(),
    )
    this.captureApi = createStageCaptureApi({
      canvas: this.canvas,
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      group: this.group,
      getZoom: () => this.zoom,
      getYaw: () => this.yaw,
      getPitch: () => this.pitch,
      setOrbit: (yaw, pitch, zoom) => {
        this.yaw = yaw
        this.targetYaw = yaw
        this.pitch = pitch
        this.targetPitch = pitch
        this.zoom = zoom
        this.targetZoom = zoom
        this.group.rotation.y = yaw
        this.group.rotation.x = pitch
        this.camera.position.z = this.baseDistance / zoom
        this.camera.lookAt(0, 0, 0)
      },
      requestRender: () => this.requestRender(),
    })

    this.resizeObserver = new ResizeObserver(() => {
      this.fitCamera()
      this.requestRender()
    })
    this.resizeObserver.observe(container)

    this.attachInput()
    this.fitCamera()
    this.requestRender()
  }

  reset(): void {
    this.targetYaw = 0
    this.targetPitch = 0
    this.targetZoom = 1
    this.requestRender()
  }

  capturePng(): Promise<Blob> {
    return this.captureApi.capturePng()
  }

  recordLoop(durationMs = 3000): Promise<Blob> {
    return this.captureApi.recordLoop(durationMs)
  }

  setDepth(depth: DepthMap | null): void {
    this.depthLayer.setDepth(depth)
  }

  setView(view: StageView): void {
    this.depthLayer.setView(view)
  }

  setStrength(strength: number): void {
    this.depthLayer.setStrength(strength)
  }

  setImage(next: ProcessedImage): void {
    if (next === this.currentImage) return
    this.currentImage = next

    const nextGeometry = createImagePlaneGeometry(next.width / next.height)
    const nextTexture = createImageTexture(this.renderer, next)
    const nextMaterial = new MeshBasicMaterial({
      map: nextTexture,
      toneMapped: false,
    })

    this.depthLayer.dispose()
    this.geometry.dispose()
    this.texture.dispose()
    this.material.dispose()

    this.geometry = nextGeometry
    this.texture = nextTexture
    this.material = nextMaterial
    this.mesh.geometry = nextGeometry
    this.mesh.material = nextMaterial
    this.depthLayer = new DepthLayer(
      this.mesh,
      nextGeometry,
      nextMaterial,
      nextTexture,
      () => this.requestRender(),
    )

    this.yaw = 0
    this.pitch = 0
    this.targetYaw = 0
    this.targetPitch = 0
    this.zoom = 1
    this.targetZoom = 1
    this.group.rotation.set(0, 0, 0)

    this.fitCamera()
    this.requestRender()
  }

  dispose(): void {
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.resizeObserver.disconnect()
    this.detachInput()
    this.pointers.clear()
    this.depthLayer.dispose()
    this.geometry.dispose()
    this.texture.dispose()
    this.material.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    if (this.canvas.parentElement === this.container) {
      this.container.removeChild(this.canvas)
    }
  }

  private viewportWidth(): number {
    return Math.max(1, this.canvas.clientWidth || this.container.clientWidth)
  }

  private viewportHeight(): number {
    return Math.max(1, this.canvas.clientHeight || this.container.clientHeight)
  }

  private fitCamera(): void {
    const width = this.viewportWidth()
    const height = this.viewportHeight()
    const fill = width < MOBILE_WIDTH ? MOBILE_FILL : DESKTOP_FILL

    // Keep the drawing buffer in sync with the CSS size. Without this, resizing
    // the window stretches the old buffer and blurs the photo.
    this.renderer.setSize(width, height, false)

    this.baseDistance = computeCameraDistance({
      imageWidth: this.currentImage.width,
      imageHeight: this.currentImage.height,
      viewportWidth: width,
      viewportHeight: height,
      fovDeg: FOV_DEG,
      fill,
    })

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 0, this.baseDistance / this.zoom)
    this.camera.lookAt(0, 0, 0)
  }

  private requestRender(): void {
    if (this.rafId !== 0) return
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0), 0.05)
    this.lastTime = now

    this.yaw = damp(this.yaw, this.targetYaw, DRAG_LAMBDA, dt)
    this.pitch = damp(this.pitch, this.targetPitch, DRAG_LAMBDA, dt)
    this.zoom = damp(this.zoom, this.targetZoom, DRAG_LAMBDA, dt)

    this.group.rotation.y = this.yaw
    this.group.rotation.x = this.pitch
    this.camera.position.z = this.baseDistance / this.zoom
    this.camera.lookAt(0, 0, 0)
    this.renderer.render(this.scene, this.camera)

    const settled =
      Math.abs(this.targetYaw - this.yaw) < SETTLE_EPSILON &&
      Math.abs(this.targetPitch - this.pitch) < SETTLE_EPSILON &&
      Math.abs(this.targetZoom - this.zoom) < SETTLE_EPSILON

    this.rafId = settled ? 0 : requestAnimationFrame(this.tick)
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
    this.canvas.focus({ preventScroll: true })
    this.canvas.setPointerCapture(event.pointerId)
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (this.pointers.size === 1) {
      this.dragging = true
      this.dragPointerId = event.pointerId
      this.dragStartX = event.clientX
      this.dragStartY = event.clientY
      this.dragStartYaw = this.targetYaw
      this.dragStartPitch = this.targetPitch
    } else if (this.pointers.size === 2) {
      this.dragging = false
      this.dragPointerId = null
      this.pinchStartDistance = this.pointerDistance()
      this.pinchStartZoom = this.targetZoom
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (this.pointers.size >= 2 && this.pinchStartDistance > 0) {
      const distance = this.pointerDistance()
      this.targetZoom = clampZoom(
        this.pinchStartZoom * (distance / this.pinchStartDistance),
      )
      this.requestRender()
      return
    }

    if (!this.dragging || this.dragPointerId !== event.pointerId) return

    const dx = event.clientX - this.dragStartX
    const dy = event.clientY - this.dragStartY
    this.targetYaw = applyLimitWithRubberBand(
      this.dragStartYaw + dragToAngle(dx, this.viewportWidth(), YAW_SWEEP),
      YAW_LIMIT,
    )
    this.targetPitch = applyLimitWithRubberBand(
      this.dragStartPitch + dragToAngle(-dy, this.viewportHeight(), PITCH_SWEEP),
      PITCH_LIMIT,
    )
    this.requestRender()
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId)

    if (this.pointers.size >= 2) {
      // A third finger left: re-baseline the pinch instead of jumping.
      this.pinchStartDistance = this.pointerDistance()
      this.pinchStartZoom = this.targetZoom
      this.dragging = false
      this.dragPointerId = null
      this.requestRender()
      return
    }

    this.pinchStartDistance = 0

    if (this.pointers.size === 0) {
      this.dragging = false
      this.dragPointerId = null
      this.targetYaw = clampAngle(this.targetYaw, YAW_LIMIT)
      this.targetPitch = clampAngle(this.targetPitch, PITCH_LIMIT)
      this.requestRender()
      return
    }

    const remaining = Array.from(this.pointers.entries())[0]
    if (!remaining) return

    const [pointerId, point] = remaining
    this.dragging = true
    this.dragPointerId = pointerId
    this.dragStartX = point.x
    this.dragStartY = point.y
    this.dragStartYaw = this.targetYaw
    this.dragStartPitch = this.targetPitch
    this.requestRender()
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.targetZoom = clampZoom(
      this.targetZoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED),
    )
    this.requestRender()
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Home') {
      event.preventDefault()
      this.reset()
      return
    }

    if (event.key === 'ArrowLeft') {
      this.targetYaw = clampAngle(this.targetYaw - KEY_YAW_STEP, YAW_LIMIT)
    } else if (event.key === 'ArrowRight') {
      this.targetYaw = clampAngle(this.targetYaw + KEY_YAW_STEP, YAW_LIMIT)
    } else if (event.key === 'ArrowUp') {
      this.targetPitch = clampAngle(this.targetPitch + KEY_PITCH_STEP, PITCH_LIMIT)
    } else if (event.key === 'ArrowDown') {
      this.targetPitch = clampAngle(this.targetPitch - KEY_PITCH_STEP, PITCH_LIMIT)
    } else {
      return
    }

    event.preventDefault()
    this.requestRender()
  }

  private readonly handleDoubleClick = (): void => {
    this.reset()
  }

  private attachInput(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointercancel', this.handlePointerUp)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    this.canvas.addEventListener('keydown', this.handleKeyDown)
    this.canvas.addEventListener('dblclick', this.handleDoubleClick)
  }

  private detachInput(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('keydown', this.handleKeyDown)
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick)
  }
}

export function createImageStage(options: ImageStageOptions): ImageStage {
  return new ImageStageController(options)
}
