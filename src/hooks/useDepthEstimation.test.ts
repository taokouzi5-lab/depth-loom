import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CreateDepthClient,
  DepthWorkerResponse,
} from '../lib/depth/protocol'
import type { ProcessedImage } from '../lib/image/decode'
import { useDepthEstimation } from './useDepthEstimation'

function makeImage(fileName = 'photo.jpg'): ProcessedImage {
  return {
    canvas: document.createElement('canvas'),
    width: 16,
    height: 10,
    fileName,
    fileSize: 1024,
  }
}

describe('useDepthEstimation', () => {
  const client = {
    estimate: vi.fn(),
    dispose: vi.fn(),
  }
  let onMessage: (message: DepthWorkerResponse) => void = () => {}
  let createClient: CreateDepthClient

  beforeEach(() => {
    client.estimate.mockReset()
    client.dispose.mockReset()
    createClient = vi.fn((handler: (message: DepthWorkerResponse) => void) => {
      onMessage = handler
      return client
    })
  })

  it('runs the worker state machine from loading to ready', async () => {
    const image = makeImage()
    const { result } = renderHook(() => useDepthEstimation(image, createClient))

    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))
    const requestId = client.estimate.mock.calls[0][1] as number
    expect(result.current.status).toBe('loading')

    act(() => {
      onMessage({
        type: 'progress',
        requestId,
        loaded: 50,
        total: 100,
        progress: 50,
      })
    })
    expect(result.current.progress?.progress).toBe(50)

    act(() => {
      onMessage({ type: 'ready', requestId, mode: 'webgpu' })
    })
    expect(result.current.status).toBe('estimating')
    expect(result.current.mode).toBe('webgpu')

    const buffer = new Float32Array([0, 1, 0.5, 1]).buffer
    act(() => {
      onMessage({
        type: 'result',
        requestId,
        buffer,
        width: 2,
        height: 2,
        mode: 'webgpu',
      })
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.depth).toMatchObject({ width: 2, height: 2 })
    expect(Array.from(result.current.depth?.data ?? [])).toEqual([0, 1, 0.5, 1])
  })

  it('tracks the inpainted background and its progress', async () => {
    const image = makeImage()
    const { result } = renderHook(() => useDepthEstimation(image, createClient))
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))
    const requestId = client.estimate.mock.calls[0][1] as number

    act(() => {
      onMessage({ type: 'background-start', requestId })
    })
    expect(result.current.backgroundStatus).toBe('loading')
    expect(result.current.background).toBeNull()

    act(() => {
      onMessage({
        type: 'inpaint-progress',
        requestId,
        loaded: 40,
        total: 100,
        progress: 40,
      })
    })
    expect(result.current.backgroundProgress?.progress).toBe(40)

    const buffer = new Uint8ClampedArray([1, 2, 3, 255]).buffer
    act(() => {
      onMessage({
        type: 'background',
        requestId,
        buffer,
        width: 1,
        height: 1,
      })
    })
    expect(result.current.backgroundStatus).toBe('ready')
    expect(result.current.background).toMatchObject({ width: 1, height: 1 })
    expect(result.current.backgroundProgress).toBeNull()

    act(() => {
      onMessage({ type: 'background-error', requestId, message: 'no model' })
    })
    expect(result.current.backgroundStatus).toBe('error')
  })

  it('ignores stale background results', async () => {
    const image = makeImage()
    const { result } = renderHook(() => useDepthEstimation(image, createClient))
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))
    const requestId = client.estimate.mock.calls[0][1] as number

    act(() => {
      onMessage({
        type: 'background',
        requestId: requestId + 1,
        buffer: new Uint8ClampedArray([0, 0, 0, 255]).buffer,
        width: 1,
        height: 1,
      })
    })

    expect(result.current.backgroundStatus).toBe('idle')
    expect(result.current.background).toBeNull()
  })

  it('ignores stale request results', async () => {
    const image = makeImage()
    const { result } = renderHook(() => useDepthEstimation(image, createClient))
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))
    const requestId = client.estimate.mock.calls[0][1] as number

    act(() => {
      onMessage({
        type: 'result',
        requestId: requestId + 1,
        buffer: new Float32Array([1]).buffer,
        width: 1,
        height: 1,
        mode: 'wasm',
      })
    })

    expect(result.current.status).toBe('loading')
    expect(result.current.depth).toBeNull()
  })

  it('does not start when there is no image', () => {
    const { result } = renderHook(() => useDepthEstimation(null, createClient))
    expect(result.current.status).toBe('idle')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('starts a new request for a new image', async () => {
    const { rerender } = renderHook(
      ({ image }) => useDepthEstimation(image, createClient),
      { initialProps: { image: makeImage('first.jpg') } },
    )
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))

    rerender({ image: makeImage('second.jpg') })
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(2))

    const firstId = client.estimate.mock.calls[0][1] as number
    const secondId = client.estimate.mock.calls[1][1] as number
    expect(secondId).toBe(firstId + 1)
  })

  it('retries by disposing the worker and starting again', async () => {
    const image = makeImage()
    const { result } = renderHook(() => useDepthEstimation(image, createClient))
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))
    const requestId = client.estimate.mock.calls[0][1] as number

    act(() => {
      onMessage({ type: 'error', requestId, message: 'model failed' })
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('model failed')

    act(() => {
      result.current.retry()
    })
    await waitFor(() => expect(client.dispose).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(2))
    expect(createClient).toHaveBeenCalledTimes(2)
  })

  it('disposes the worker on unmount', async () => {
    const image = makeImage()
    const { unmount } = renderHook(() => useDepthEstimation(image, createClient))
    await waitFor(() => expect(client.estimate).toHaveBeenCalledTimes(1))

    unmount()
    expect(client.dispose).toHaveBeenCalledTimes(1)
  })
})
