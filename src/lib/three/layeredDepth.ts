import { LinearFilter, PlaneGeometry, SRGBColorSpace, CanvasTexture } from 'three'
import { computeDepthThreshold } from '../depth/mask'
import type { DepthMap } from '../depth/protocol'

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

/** White-with-alpha mask at depth-map resolution. Alpha 255 = foreground. */
export function createMaskCanvas(
  depth: DepthMap,
  threshold: number,
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
      x < frameX ||
      x >= depth.width - frameX ||
      y < frameY ||
      y >= depth.height - frameY
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

const FILL_LEVEL_WIDTH = 64
const FILL_ITERATIONS = 64

/**
 * Fill the masked (foreground) region at low resolution by averaging
 * neighbouring background pixels. Unlike a Gaussian blur, this never mixes
 * foreground colours into the plate, so a moved card does not leave a halo of
 * the object it uncovered.
 */
function fillHoles(image: ImageData, maskAlpha: Uint8ClampedArray): void {
  const { width, height, data } = image
  const total = width * height
  const valid = new Uint8Array(total)
  let invalid = 0

  for (let index = 0; index < total; index += 1) {
    if (maskAlpha[index * 4 + 3] < 128) {
      valid[index] = 1
    } else {
      invalid += 1
    }
  }
  if (invalid === 0 || invalid === total) return

  for (let iteration = 0; iteration < FILL_ITERATIONS; iteration += 1) {
    const snapshot = valid.slice()
    let changed = 0

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (valid[index]) continue

        let red = 0
        let green = 0
        let blue = 0
        let count = 0

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const neighbourY = y + offsetY
          if (neighbourY < 0 || neighbourY >= height) continue
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const neighbourX = x + offsetX
            if (neighbourX < 0 || neighbourX >= width) continue
            const neighbour = neighbourY * width + neighbourX
            if (!snapshot[neighbour]) continue
            red += data[neighbour * 4]
            green += data[neighbour * 4 + 1]
            blue += data[neighbour * 4 + 2]
            count += 1
          }
        }

        if (count > 0) {
          data[index * 4] = red / count
          data[index * 4 + 1] = green / count
          data[index * 4 + 2] = blue / count
          valid[index] = 1
          changed += 1
        }
      }
    }

    if (changed === 0) break
  }
}

function createInpaintedFill(
  source: HTMLCanvasElement,
  foregroundMask: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const scale = Math.min(1, FILL_LEVEL_WIDTH / source.width)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const low = document.createElement('canvas')
  low.width = width
  low.height = height
  const lowContext = low.getContext('2d')
  if (!lowContext) return null
  lowContext.drawImage(source, 0, 0, width, height)

  const lowMask = document.createElement('canvas')
  lowMask.width = width
  lowMask.height = height
  const maskContext = lowMask.getContext('2d')
  if (!maskContext) return null
  maskContext.drawImage(foregroundMask, 0, 0, width, height)

  const image = lowContext.getImageData(0, 0, width, height)
  const mask = maskContext.getImageData(0, 0, width, height)
  fillHoles(image, mask.data)
  lowContext.putImageData(image, 0, 0)

  const filled = document.createElement('canvas')
  filled.width = source.width
  filled.height = source.height
  const context = filled.getContext('2d')
  if (!context) return null
  context.filter = 'blur(6px)'
  context.drawImage(low, 0, 0, filled.width, filled.height)
  context.filter = 'none'
  return filled
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
