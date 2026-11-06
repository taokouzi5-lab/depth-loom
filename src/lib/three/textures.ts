import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type WebGLRenderer,
} from 'three'
import type { ProcessedImage } from '../image/decode'

const MAX_ANISOTROPY = 8

export function createImageTexture(
  renderer: WebGLRenderer,
  image: ProcessedImage,
): CanvasTexture {
  const texture = new CanvasTexture(image.canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = Math.min(
    MAX_ANISOTROPY,
    renderer.capabilities.getMaxAnisotropy(),
  )
  texture.needsUpdate = true
  return texture
}
