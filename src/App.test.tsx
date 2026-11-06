import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { CreateDepthClient } from './lib/depth/protocol'
import { I18nProvider } from './lib/i18n/I18nContext'
import { ImageError } from './lib/image/errors'

const mocks = vi.hoisted(() => ({
  decodeImage: vi.fn(),
  retryDepth: vi.fn(),
}))

vi.mock('./lib/image/decode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/image/decode')>()
  return { ...actual, decodeImage: mocks.decodeImage }
})

vi.mock('./hooks/useDepthEstimation', () => ({
  useDepthEstimation: () => ({
    status: 'idle',
    progress: null,
    mode: null,
    depth: null,
    error: null,
    retry: mocks.retryDepth,
  }),
}))

vi.mock('./components/stage/DepthStage', () => ({
  default: ({
    image,
    resetSignal = 0,
  }: {
    image: { fileName: string; width: number; height: number }
    resetSignal?: number
  }) => (
    <div data-testid="depth-stage">
      stage:{image.fileName}:{image.width}x{image.height}:reset:{resetSignal}
    </div>
  ),
}))

type DecodedImage = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  fileName: string
  fileSize: number
}

const createDepthClient: CreateDepthClient = vi.fn(() => ({
  estimate: vi.fn(),
  dispose: vi.fn(),
}))

function renderApp() {
  return render(
    <I18nProvider>
      <App createDepthClient={createDepthClient} />
    </I18nProvider>,
  )
}

function makeFile(name = 'demo.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array(2048)], name, { type })
}

function decodedImage(fileName: string, width: number, height: number): DecodedImage {
  return {
    canvas: document.createElement('canvas'),
    width,
    height,
    fileName,
    fileSize: 2048,
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function dropFile(file: File): void {
  fireEvent.drop(window, {
    dataTransfer: { files: [file], types: ['Files'] },
  })
}

describe('App', () => {
  beforeEach(() => {
    mocks.decodeImage.mockReset()
    mocks.decodeImage.mockResolvedValue({
      canvas: document.createElement('canvas'),
      width: 800,
      height: 600,
      fileName: 'demo.jpg',
      fileSize: 2048,
    })
  })

  it('starts on the empty state', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: /让一张照片/ })).toBeInTheDocument()
    expect(screen.queryByTestId('depth-stage')).not.toBeInTheDocument()
  })

  it('switches the interface to English and back', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: '切换到英文' }))
    expect(screen.getByRole('heading', { name: /Give a photo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to Chinese' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Chinese' }))
    expect(screen.getByRole('heading', { name: /让一张照片/ })).toBeInTheDocument()
  })

  it('decodes a dropped image and lazy-mounts the stage', async () => {
    renderApp()

    dropFile(makeFile())

    expect(await screen.findByTestId('depth-stage')).toHaveTextContent(
      'stage:demo.jpg:800x600',
    )
    expect(mocks.decodeImage).toHaveBeenCalledWith(expect.any(File))
    expect(screen.queryByRole('heading', { name: /让一张照片/ })).not.toBeInTheDocument()
  })

  it('accepts an image from the file input', async () => {
    const { container } = renderApp()
    const input = container.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    if (!input) return

    fireEvent.change(input, { target: { files: [makeFile('picked.png', 'image/png')] } })

    expect(await screen.findByTestId('depth-stage')).toBeInTheDocument()
    expect(mocks.decodeImage).toHaveBeenCalledOnce()
  })

  it('accepts a pasted image', async () => {
    renderApp()

    fireEvent.paste(window, {
      clipboardData: { files: [makeFile('pasted.webp', 'image/webp')] },
    })

    expect(await screen.findByTestId('depth-stage')).toBeInTheDocument()
    expect(mocks.decodeImage).toHaveBeenCalledOnce()
  })

  it('loads a built-in sample through fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array(8)], { type: 'image/jpeg' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /加载示例：山景/ }))

    expect(await screen.findByTestId('depth-stage')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/samples/landscape.jpg'))
    const decodedFile = mocks.decodeImage.mock.calls[0][0] as File
    expect(decodedFile.name).toBe('landscape.jpg')
    expect(decodedFile.type).toBe('image/jpeg')
  })

  it('rejects an unsupported file without calling the decoder', async () => {
    renderApp()

    dropFile(makeFile('animation.gif', 'image/gif'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '只支持 JPG、PNG 或 WebP',
    )
    expect(mocks.decodeImage).not.toHaveBeenCalled()
  })

  it('keeps the current stage when a replacement image fails to decode', async () => {
    renderApp()
    dropFile(makeFile())
    await screen.findByTestId('depth-stage')

    mocks.decodeImage.mockRejectedValueOnce(
      new ImageError('decode_failed', 'decode failed'),
    )
    dropFile(makeFile('broken.jpg'))

    expect(await screen.findByRole('alert')).toHaveTextContent('图片解码失败')
    expect(screen.getByTestId('depth-stage')).toBeInTheDocument()
  })

  it('lets the newest decode win when results resolve out of order', async () => {
    const first = deferred<DecodedImage>()
    const second = deferred<DecodedImage>()
    mocks.decodeImage
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    renderApp()
    dropFile(makeFile('first.jpg'))
    dropFile(makeFile('second.jpg'))

    await waitFor(() => expect(mocks.decodeImage).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve(decodedImage('second.jpg', 200, 100))
      await second.promise
    })
    expect(await screen.findByTestId('depth-stage')).toHaveTextContent(
      'stage:second.jpg:200x100',
    )

    await act(async () => {
      first.resolve(decodedImage('first.jpg', 800, 600))
      await first.promise
    })
    await waitFor(() => {
      expect(screen.getByTestId('depth-stage')).toHaveTextContent(
        'stage:second.jpg:200x100',
      )
    })
  })

  it('resets the stage from the control bar', async () => {
    renderApp()
    dropFile(makeFile())
    const stage = await screen.findByTestId('depth-stage')
    expect(stage).toHaveTextContent('reset:0')

    fireEvent.click(screen.getByRole('button', { name: /重置视角/ }))

    expect(screen.getByTestId('depth-stage')).toHaveTextContent('reset:1')
  })
})
