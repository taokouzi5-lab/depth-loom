import { describe, expect, it, vi } from 'vitest'
import { decodeImage } from './decode'

interface FakeCanvas {
  canvas: HTMLCanvasElement
  context: {
    imageSmoothingEnabled: boolean
    imageSmoothingQuality: ImageSmoothingQuality
    drawImage: ReturnType<typeof vi.fn>
  }
}

function fakeCanvas(context: FakeCanvas['context'] | null): FakeCanvas {
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement

  vi.spyOn(document, 'createElement').mockReturnValue(canvas)

  return {
    canvas,
    context: context ?? {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
    },
  }
}

function makeFile(name = 'photo.jpg', type = 'image/jpeg', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('decodeImage', () => {
  it('decodes with EXIF orientation and resizes to the maximum edge', async () => {
    const bitmap = {
      width: 4000,
      height: 3000,
      close: vi.fn(),
    } as unknown as ImageBitmap
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    const { canvas, context } = fakeCanvas({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
    })

    const result = await decodeImage(makeFile('portrait.jpg'))

    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), {
      imageOrientation: 'from-image',
    })
    expect(canvas.width).toBe(1024)
    expect(canvas.height).toBe(768)
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1024, 768)
    expect(context.imageSmoothingEnabled).toBe(true)
    expect(context.imageSmoothingQuality).toBe('high')
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      canvas,
      width: 1024,
      height: 768,
      fileName: 'portrait.jpg',
    })
  })

  it('leaves a small image at its original size', async () => {
    const bitmap = { width: 800, height: 600, close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const { canvas } = fakeCanvas({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
    })

    const result = await decodeImage(makeFile())

    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(result.width).toBe(800)
  })

  it('wraps a decode failure in an ImageError', async () => {
    const bitmap = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad bytes')))

    await expect(decodeImage(makeFile())).rejects.toMatchObject({
      name: 'ImageError',
      code: 'decode_failed',
    })
    expect(bitmap.close).not.toHaveBeenCalled()
  })

  it('rejects when a 2D context is unavailable', async () => {
    const bitmap = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    fakeCanvas(null)

    await expect(decodeImage(makeFile())).rejects.toMatchObject({
      code: 'canvas_unavailable',
    })
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
})
