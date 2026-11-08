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
import { damp } from './orbit'
import {
  createStageCaptureApi,
  type StageCaptureApi,
} from './stageCapture'
import { createStageInput, type StageInput } from './stageInput'
import type { ImageStage, ImageStageOptions } from './stageTypes'
import { createImageTexture } from './textures'

const FOV_DEG = 45
const DESKTOP_FILL = 0.8
const MOBILE_FILL = 0.72
const MOBILE_WIDTH = 640
const DRAG_LAMBDA = 14
const SETTLE_EPSILON = 0.0002
const MAX_DPR = 2

class ImageStageController implements ImageStage {
  private readonly container: HTMLElement
  private readonly renderer: WebGLRenderer
  private readonly canvas: HTMLCanvasElement
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FOV_DEG, 1, 0.1, 100)
  private readonly group = new Group()
  private readonly mesh: Mesh
  private readonly resizeObserver: ResizeObserver
  private readonly input: StageInput

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

    this.input = createStageInput({
      canvas: this.canvas,
      viewportWidth: () => this.viewportWidth(),
      viewportHeight: () => this.viewportHeight(),
      getTargetYaw: () => this.targetYaw,
      getTargetPitch: () => this.targetPitch,
      getTargetZoom: () => this.targetZoom,
      setTargetYaw: (value) => {
        this.targetYaw = value
      },
      setTargetPitch: (value) => {
        this.targetPitch = value
      },
      setTargetZoom: (value) => {
        this.targetZoom = value
      },
      reset: () => this.reset(),
      requestRender: () => this.requestRender(),
    })

    this.resizeObserver = new ResizeObserver(() => {
      this.fitCamera()
      this.requestRender()
    })
    this.resizeObserver.observe(container)

    this.input.attach()
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
    this.input.detach()
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

}

export function createImageStage(options: ImageStageOptions): ImageStage {
  return new ImageStageController(options)
}
