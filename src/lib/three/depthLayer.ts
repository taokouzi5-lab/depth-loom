import type {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'
import type { DepthMap } from '../depth/protocol'
import { applyDepthDisplacement, clearDepthDisplacement } from './displacement'
import { createDepthMaterial, createDepthTexture } from './depthMaterial'

export type StageView = 'original' | '3d'

export class DepthLayer {
  private readonly mesh: Mesh
  private readonly geometry: PlaneGeometry
  private readonly baseMaterial: MeshBasicMaterial
  private readonly imageTexture: CanvasTexture
  private readonly requestRender: () => void

  private depth: DepthMap | null = null
  private depthTexture: CanvasTexture | null = null
  private depthMaterial: ShaderMaterial | null = null
  private view: StageView = 'original'
  private strength = 1

  constructor(
    mesh: Mesh,
    geometry: PlaneGeometry,
    baseMaterial: MeshBasicMaterial,
    imageTexture: CanvasTexture,
    requestRender: () => void,
  ) {
    this.mesh = mesh
    this.geometry = geometry
    this.baseMaterial = baseMaterial
    this.imageTexture = imageTexture
    this.requestRender = requestRender
  }

  setDepth(depth: DepthMap | null): void {
    if (this.depth === depth) return
    this.disposeDepthMaterial()
    this.depth = depth

    if (depth) {
      this.depthTexture = createDepthTexture(depth)
      this.depthMaterial = createDepthMaterial({
        image: this.imageTexture,
        depth,
        depthTexture: this.depthTexture,
        strength: this.strength,
      })
    }

    this.apply()
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
    if (this.depthMaterial) {
      this.depthMaterial.uniforms.uStrength.value = next
    }
    this.apply()
  }

  dispose(): void {
    this.disposeDepthMaterial()
    this.depth = null
    this.view = 'original'
    this.mesh.material = this.baseMaterial
  }

  private apply(): void {
    if (this.view === '3d' && this.depth && this.depthMaterial) {
      applyDepthDisplacement(this.geometry, this.depth, this.strength)
      this.mesh.material = this.depthMaterial
    } else {
      clearDepthDisplacement(this.geometry)
      this.mesh.material = this.baseMaterial
    }
    this.requestRender()
  }

  private disposeDepthMaterial(): void {
    if (this.depthMaterial) {
      this.depthMaterial.dispose()
      this.depthMaterial = null
    }
    if (this.depthTexture) {
      this.depthTexture.dispose()
      this.depthTexture = null
    }
  }
}
