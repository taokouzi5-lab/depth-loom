import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { computeDepthThreshold } from '../depth/mask'
import type { DepthMap } from '../depth/protocol'
import {
  createPushPullFill,
  FILL_MAX_WIDTH,
  fillDepthWithBackground,
} from '../depth/fill'

/**
 * Foreground/background separation in world units at strength 1. Deliberately
 * small: a larger offset exposes more of the generated plate and makes the
 * scene read as two pasted photos rather than one scene with parallax.
 */
export const LAYER_SEPARATION = 0.022

/** Otsu split shared with the inpainting mask. Null when the image is flat. */
export function computeLayerThreshold(depth: DepthMap): number | null {
  if (depth.width <= 0 || depth.height <= 0 || depth.data.length === 0) {
    return null
  }
  return computeDepthThreshold(depth.data)
}

/**
 * White-with-alpha mask at depth-map resolution. Alpha 255 = foreground.
 * No artificial border: a frame would travel with the foreground card and its
 * inner edge would show as a rectangular seam (a duplicated strip of the
 * photo) whenever the cards separate.
 */
export function createMaskCanvas(
  depth: DepthMap,
  threshold: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = depth.width
  canvas.height = depth.height
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(depth.width, depth.height)
  for (let index = 0; index < depth.data.length; index += 1) {
    const offset = index * 4
    image.data[offset] = 255
    image.data[offset + 1] = 255
    image.data[offset + 2] = 255
    image.data[offset + 3] = depth.data[index] > threshold ? 255 : 0
  }
  context.putImageData(image, 0, 0)
  return canvas
}

/**
 * Foreground cutout as a data texture: RGB always comes from the photo,
 * alpha from the blurred mask. Building this from a canvas with
 * `destination-in` lets the browser unpremultiply nearly transparent edge
 * pixels, which turns their colour into bright garbage that filtering then
 * pulls into the visible silhouette as a halo. RGBA bytes uploaded directly
 * keep the edge colour identical to the photo.
 */
export function createForegroundTexture(
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
): DataTexture | null {
  const width = source.width
  const height = source.height
  const sourceContext = source.getContext('2d')
  if (!sourceContext) return null
  const sourceImage = sourceContext.getImageData(0, 0, width, height)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskContext = maskCanvas.getContext('2d')
  if (!maskContext) return null
  maskContext.filter = 'blur(3px)'
  maskContext.drawImage(mask, 0, 0, width, height)
  maskContext.filter = 'none'
  const maskImage = maskContext.getImageData(0, 0, width, height)

  const data = new Uint8Array(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    data[offset] = sourceImage.data[offset]
    data[offset + 1] = sourceImage.data[offset + 1]
    data[offset + 2] = sourceImage.data[offset + 2]
    data[offset + 3] = maskImage.data[offset + 3]
  }

  const texture = new DataTexture(
    data,
    width,
    height,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.colorSpace = SRGBColorSpace
  // DataTexture defaults to flipY = false; the source canvas is top-down.
  texture.flipY = true
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * Grow the foreground mask by a few depth-map pixels. Depth edges are soft, so
 * a threshold-only matte leaves a rim of the object in the background plate;
 * that rim becomes a visible ghost when the foreground card moves.
 */
export function dilateMaskCanvas(
  mask: HTMLCanvasElement,
  radius: number,
): HTMLCanvasElement | null {
  if (radius <= 0) return mask

  const canvas = document.createElement('canvas')
  canvas.width = mask.width
  canvas.height = mask.height
  const context = canvas.getContext('2d')
  if (!context) return null

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      if (offsetX * offsetX + offsetY * offsetY > radius * radius) continue
      context.drawImage(mask, offsetX, offsetY)
    }
  }
  return canvas
}

export function createInverseMaskCanvas(
  mask: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = mask.width
  canvas.height = mask.height
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'destination-out'
  context.drawImage(mask, 0, 0)
  context.globalCompositeOperation = 'source-over'
  return canvas
}

/**
 * Fill the masked (foreground) region from surrounding background colours with
 * a masked pyramid. The pyramid keeps local detail that a 64px averaging pass
 * loses, so a moved card does not uncover a soft white band.
 */
function createInpaintedFill(
  source: HTMLCanvasElement,
  foregroundMask: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const sourceContext = source.getContext('2d')
  if (!sourceContext) return null
  const sourceImage = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  )

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = source.width
  maskCanvas.height = source.height
  const maskContext = maskCanvas.getContext('2d')
  if (!maskContext) return null
  maskContext.drawImage(foregroundMask, 0, 0, source.width, source.height)
  const maskImage = maskContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  )

  const keepMask = new Uint8Array(source.width * source.height)
  for (let index = 0; index < keepMask.length; index += 1) {
    keepMask[index] = maskImage.data[index * 4 + 3]
  }

  const filled = createPushPullFill(sourceImage, keepMask, FILL_MAX_WIDTH)
  if (!filled) return null

  const low = document.createElement('canvas')
  low.width = filled.width
  low.height = filled.height
  const lowContext = low.getContext('2d')
  if (!lowContext) return null
  const filledImage = lowContext.createImageData(filled.width, filled.height)
  filledImage.data.set(filled.data)
  lowContext.putImageData(filledImage, 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(low, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Background plate: sharp where the photo has background, and filled with
 * neighbouring background colours where the foreground card covers it.
 */
export function createBackgroundCanvas(
  source: HTMLCanvasElement,
  foregroundMask: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const inverseMask = createInverseMaskCanvas(foregroundMask)
  if (!inverseMask) return null

  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) return null

  const fill = createInpaintedFill(source, foregroundMask)
  if (fill) context.drawImage(fill, 0, 0)

  const sharp = document.createElement('canvas')
  sharp.width = canvas.width
  sharp.height = canvas.height
  const sharpContext = sharp.getContext('2d')
  if (!sharpContext) return null

  sharpContext.drawImage(source, 0, 0)
  sharpContext.globalCompositeOperation = 'destination-in'
  sharpContext.filter = 'blur(3px)'
  sharpContext.drawImage(inverseMask, 0, 0, sharp.width, sharp.height)
  sharpContext.filter = 'none'
  sharpContext.globalCompositeOperation = 'source-over'

  context.drawImage(sharp, 0, 0)
  return canvas
}

export function createLayerTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * Depth for the displaced background mesh. Foreground depth values would make
 * the plate bulge towards the camera exactly where the cutout is; replacing
 * them with the surrounding background depth keeps the relief behind the
 * foreground instead of on top of it.
 */
export function createBackgroundDepth(
  depth: DepthMap,
  mask: HTMLCanvasElement,
): DepthMap | null {
  const context = mask.getContext('2d')
  if (!context) return null
  const image = context.getImageData(0, 0, depth.width, depth.height)
  const keepMask = new Uint8Array(depth.width * depth.height)
  for (let index = 0; index < keepMask.length; index += 1) {
    keepMask[index] = image.data[index * 4 + 3]
  }

  const data = fillDepthWithBackground(depth, keepMask)
  if (!data) return null
  return { data, width: depth.width, height: depth.height }
}
