import { LinearFilter, PlaneGeometry, SRGBColorSpace, CanvasTexture } from 'three'
import { computeDepthThreshold } from '../depth/mask'
import type { DepthMap } from '../depth/protocol'
import { createPushPullFill, FILL_MAX_WIDTH } from './fill'

/** Foreground/background separation in world units at strength 1. */
export const LAYER_SEPARATION = 0.035

/** Keep the outer frame on the foreground card so the far card never shows a
 * gap at the image edge when the group rotates. */
const BORDER_FRAME = 0.08

/** Otsu split shared with the inpainting mask. Null when the image is flat. */
export function computeLayerThreshold(depth: DepthMap): number | null {
  if (depth.width <= 0 || depth.height <= 0 || depth.data.length === 0) {
    return null
  }
  return computeDepthThreshold(depth.data)
}

function buildMaskCanvas(
  depth: DepthMap,
  threshold: number,
  includeFrame: boolean,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = depth.width
  canvas.height = depth.height
  const context = canvas.getContext('2d')
  if (!context) return null

  const frameX = Math.max(1, Math.round(depth.width * BORDER_FRAME))
  const frameY = Math.max(1, Math.round(depth.height * BORDER_FRAME))
  const image = context.createImageData(depth.width, depth.height)
  for (let index = 0; index < depth.data.length; index += 1) {
    const x = index % depth.width
    const y = Math.floor(index / depth.width)
    const inFrame =
      includeFrame &&
      (x < frameX ||
        x >= depth.width - frameX ||
        y < frameY ||
        y >= depth.height - frameY)
    const offset = index * 4
    image.data[offset] = 255
    image.data[offset + 1] = 255
    image.data[offset + 2] = 255
    image.data[offset + 3] =
      inFrame || depth.data[index] > threshold ? 255 : 0
  }
  context.putImageData(image, 0, 0)
  return canvas
}

/** White-with-alpha mask at depth-map resolution. Alpha 255 = foreground. */
export function createMaskCanvas(
  depth: DepthMap,
  threshold: number,
): HTMLCanvasElement | null {
  return buildMaskCanvas(depth, threshold, true)
}

/**
 * Mask for inpainting/background fill. Unlike the foreground matte it must not
 * include the outer frame: the frame only keeps the foreground card covering
 * the image edge, and filling it would expose blurry plate content as a band
 * when the cards separate.
 */
export function createFillMaskCanvas(
  depth: DepthMap,
  threshold: number,
): HTMLCanvasElement | null {
  return buildMaskCanvas(depth, threshold, false)
}

/**
 * The original photo with everything outside the foreground mask removed.
 * The mask is scaled with a small blur so the cutout edge is not a hard stair.
 */
export function createForegroundCanvas(
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) return null

  context.drawImage(source, 0, 0)
  context.globalCompositeOperation = 'destination-in'
  context.filter = 'blur(3px)'
  context.drawImage(mask, 0, 0, canvas.width, canvas.height)
  context.filter = 'none'
  context.globalCompositeOperation = 'source-over'
  return canvas
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

/** Flat card geometry; 5% bleed matches the single-mesh framing. */
export function createLayerGeometry(imageAspect: number): PlaneGeometry {
  return new PlaneGeometry(imageAspect * 1.05, 1.05, 1, 1)
}
