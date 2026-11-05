import { ImageError } from './errors'
import { fitWithin, MAX_IMAGE_EDGE } from './resize'

export interface ProcessedImage {
  /** Resized, EXIF-oriented pixels ready to be uploaded as a texture. */
  canvas: HTMLCanvasElement
  width: number
  height: number
  fileName: string
  fileSize: number
}

/**
 * Decode a user file with EXIF orientation applied, then downscale it so the
 * longest edge is at most 1024px. The source bitmap is closed immediately after
 * drawing to keep mobile memory pressure low.
 */
export async function decodeImage(file: File): Promise<ProcessedImage> {
  let bitmap: ImageBitmap

  try {
    // `from-image` makes portrait phone photos upright before we ever draw them.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError('decode_failed', 'The browser could not decode this image.')
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new ImageError('canvas_unavailable', 'A 2D canvas context is not available.')
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, target.width, target.height)

    return {
      canvas,
      width: target.width,
      height: target.height,
      fileName: file.name,
      fileSize: file.size,
    }
  } finally {
    bitmap.close()
  }
}
