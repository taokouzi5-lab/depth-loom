import {
  Group,
  Mesh,
  MeshBasicMaterial,
  type CanvasTexture,
  type PlaneGeometry,
  type Texture,
} from 'three'
import type { DepthMap } from '../depth/protocol'
import { applyDepthDisplacement } from './displacement'
import { createImagePlaneGeometry } from './geometry'
import { YAW_LIMIT } from './orbit'
import {
  computeLayerThreshold,
  createBackgroundCanvas,
  createBackgroundDepth,
  createForegroundTexture,
  createLayerTexture,
  createMaskCanvas,
  dilateMaskCanvas,
  LAYER_SEPARATION,
} from './layeredDepth'

export type StageView = 'original' | '3d'

// The foreground matte must extend past the occluded-side fill, otherwise the
// inpainted plate shows through the feathered edge as a halo at rest. The
// plate fill itself extends a ring beyond the mask so object pixels just
// outside the threshold cannot be duplicated behind the moving card.
const MASK_DILATION = 5
const PLATE_FILL_DILATION = 6
const BACKGROUND_TINT = 0xffffff

export class DepthLayer {
  private readonly mesh: Mesh
  private readonly imageTexture: CanvasTexture
  private readonly sourceCanvas: HTMLCanvasElement
  private readonly parent: Group
  private readonly requestRender: () => void

  private readonly layerGroup = new Group()
  private backgroundGeometry: PlaneGeometry | null = null
  private foregroundGeometry: PlaneGeometry | null = null
  private backgroundDepth: DepthMap | null = null
  private backgroundTexture: CanvasTexture | null = null
  private foregroundTexture: Texture | null = null
  private readonly layerMaterials: MeshBasicMaterial[] = []
  private backgroundMesh: Mesh | null = null
  private foregroundMesh: Mesh | null = null
  private aiBackgroundCanvas: HTMLCanvasElement | null = null

  private depth: DepthMap | null = null
  private view: StageView = 'original'
  private strength = 1
  private orbitYaw = 0

  constructor(
    mesh: Mesh,
    imageTexture: CanvasTexture,
    sourceCanvas: HTMLCanvasElement,
    parent: Group,
    requestRender: () => void,
  ) {
    this.mesh = mesh
    this.imageTexture = imageTexture
    this.sourceCanvas = sourceCanvas
    this.parent = parent
    this.requestRender = requestRender
    this.layerGroup.visible = false
    this.parent.add(this.layerGroup)
  }

  setDepth(depth: DepthMap | null): void {
    if (this.depth === depth) return
    this.depth = depth
    this.aiBackgroundCanvas = null
    this.rebuildLayers()
    this.apply()
  }

  setBackgroundCanvas(canvas: HTMLCanvasElement | null): void {
    this.aiBackgroundCanvas = canvas
    if (!canvas || !this.backgroundMesh) return

    const texture = createLayerTexture(canvas)
    const material = this.backgroundMesh.material as MeshBasicMaterial
    material.map = texture
    material.needsUpdate = true
    this.backgroundTexture?.dispose()
    this.backgroundTexture = texture
    this.requestRender()
  }

  setView(view: StageView): void {
    if (this.view === view) return
    this.view = view
    this.apply()
  }

  setStrength(strength: number): void {
    const next = Math.min(2, Math.max(0, strength))
    if (this.strength === next) return
    this.strength = next
    this.displaceLayers()
    this.updateLayerPositions()
    this.apply()
  }

  setOrbit(yaw: number): void {
    this.orbitYaw = yaw
    this.updateLayerPositions()
  }

  dispose(): void {
    this.clearLayers()
    this.aiBackgroundCanvas = null
    this.depth = null
    this.view = 'original'
    this.mesh.visible = true
    this.parent.remove(this.layerGroup)
  }

  private rebuildLayers(): void {
    this.clearLayers()
    if (!this.depth) return

    const threshold = computeLayerThreshold(this.depth)
    if (threshold === null) return

    const mask = createMaskCanvas(this.depth, threshold)
    if (!mask) return

    const expandedMask = dilateMaskCanvas(mask, MASK_DILATION) ?? mask
    const foregroundTexture = createForegroundTexture(
      this.sourceCanvas,
      expandedMask,
    )
    if (!foregroundTexture) return

    // The fallback plate erases a ring beyond the Otsu edge; the extra ring is
    // still under the dilated, feathered foreground at rest.
    const fillMask = dilateMaskCanvas(mask, PLATE_FILL_DILATION) ?? mask
    const backgroundCanvas =
      this.aiBackgroundCanvas ??
      createBackgroundCanvas(this.sourceCanvas, fillMask)
    const aspect = this.sourceCanvas.width / this.sourceCanvas.height
    this.backgroundGeometry = createImagePlaneGeometry(aspect)
    this.foregroundGeometry = createImagePlaneGeometry(aspect)
    this.backgroundDepth =
      createBackgroundDepth(this.depth, mask) ?? this.depth
    this.displaceLayers()
    this.backgroundTexture = backgroundCanvas
      ? createLayerTexture(backgroundCanvas)
      : null
    this.foregroundTexture = foregroundTexture

    const backgroundMaterial = new MeshBasicMaterial({
      map: this.backgroundTexture ?? this.imageTexture,
      color: BACKGROUND_TINT,
      toneMapped: false,
    })
    const foregroundMaterial = new MeshBasicMaterial({
      map: this.foregroundTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    this.layerMaterials.push(backgroundMaterial, foregroundMaterial)

    this.backgroundMesh = new Mesh(this.backgroundGeometry, backgroundMaterial)
    this.foregroundMesh = new Mesh(this.foregroundGeometry, foregroundMaterial)
    this.layerGroup.add(this.backgroundMesh, this.foregroundMesh)

    this.updateLayerPositions()
  }

  private displaceLayers(): void {
    // Only the plate is displaced. The foreground cutout stays a flat card so
    // its silhouette keeps the photo's exact shape; the plate gets the relief,
    // with its outer border pinned so the frame does not bend like rubber.
    if (this.backgroundGeometry && this.backgroundDepth) {
      applyDepthDisplacement(
        this.backgroundGeometry,
        this.backgroundDepth,
        this.strength,
        { scale: 0.1, edgeFalloff: 0.12 },
      )
    }
  }

  private updateLayerPositions(): void {
    // Keep both cards coplanar at rest: a permanent z offset makes the near
    // card project slightly larger and exposes the inpainted plate as a halo
    // before the user has even rotated. Separate them only while orbiting.
    const orbitRatio = Math.min(1, Math.abs(this.orbitYaw) / YAW_LIMIT)
    const separation = LAYER_SEPARATION * this.strength * orbitRatio
    if (this.backgroundMesh) this.backgroundMesh.position.z = -separation
    if (this.foregroundMesh) this.foregroundMesh.position.z = separation
  }

  private apply(): void {
    const useLayers = this.view === '3d' && this.foregroundMesh !== null
    this.mesh.visible = !useLayers
    this.layerGroup.visible = useLayers
    this.requestRender()
  }

  private clearLayers(): void {
    for (const material of this.layerMaterials) material.dispose()
    this.layerMaterials.length = 0
    this.backgroundTexture?.dispose()
    this.backgroundTexture = null
    this.foregroundTexture?.dispose()
    this.foregroundTexture = null
    this.backgroundGeometry?.dispose()
    this.backgroundGeometry = null
    this.foregroundGeometry?.dispose()
    this.foregroundGeometry = null
    this.backgroundDepth = null
    this.backgroundMesh = null
    this.foregroundMesh = null
    this.layerGroup.clear()
    this.layerGroup.visible = false
  }
}
