import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../lib/i18n/messages'
import type { ImageStage } from '../lib/three/stageTypes'
import { useStageExport } from './useStageExport'

const downloadMocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  canvasToPng: vi.fn(),
}))

vi.mock('../lib/export/download', () => ({
  downloadBlob: downloadMocks.downloadBlob,
  canvasToPng: downloadMocks.canvasToPng,
}))

type Options = Parameters<typeof useStageExport>[0]

function makeStage(): ImageStage {
  return {
    capturePng: vi.fn().mockResolvedValue(new Blob(['png'])),
    recordLoop: vi.fn().mockResolvedValue(new Blob(['webm'])),
  } as unknown as ImageStage
}

function renderExport(overrides: Partial<Options> = {}) {
  const props: Options = {
    fileName: 'photo.jpg',
    view: 'original',
    isDepthReady: true,
    stageRef: { current: makeStage() },
    t: messages.zh,
    onChangeView: vi.fn(),
    ...overrides,
  }
  const hook = renderHook(() => useStageExport(props))
  return {
    ...hook,
    stageRef: props.stageRef,
    onChangeView: props.onChangeView,
  }
}

describe('useStageExport', () => {
  beforeEach(() => {
    downloadMocks.downloadBlob.mockReset()
    downloadMocks.canvasToPng.mockReset()
    downloadMocks.canvasToPng.mockResolvedValue(new Blob(['depth']))
  })

  it('captures the stage and downloads the current view as PNG', async () => {
    const { result, stageRef } = renderExport()

    await act(async () => {
      await result.current.exportPng()
    })

    expect(stageRef.current?.capturePng).toHaveBeenCalledTimes(1)
    expect(downloadMocks.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'photo-original.png',
    )
    expect(result.current.exportFeedback).toEqual({
      kind: 'info',
      text: messages.zh.app.exportPngDone,
    })
    expect(result.current.isExporting).toBe(false)
  })

  it('uses the depth canvas when the depth view is active', async () => {
    const canvas = document.createElement('canvas')
    canvas.className = 'dl-depth-canvas'
    document.body.appendChild(canvas)

    try {
      const { result } = renderExport({ view: 'depth' })

      await act(async () => {
        await result.current.exportPng()
      })

      expect(downloadMocks.canvasToPng).toHaveBeenCalledWith(canvas)
      expect(downloadMocks.downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'photo-depth.png',
      )
    } finally {
      canvas.remove()
    }
  })

  it('reports a missing stage instead of downloading', async () => {
    const { result } = renderExport({ stageRef: { current: null } })

    await act(async () => {
      await result.current.exportPng()
    })

    expect(downloadMocks.downloadBlob).not.toHaveBeenCalled()
    expect(result.current.exportFeedback).toEqual({
      kind: 'error',
      text: `${messages.zh.app.exportFailed}${messages.zh.app.stageNotReady}`,
    })
  })

  it('falls back to the localized unknown error for non-Error throws', async () => {
    const stage = {
      capturePng: vi.fn().mockRejectedValue('offline'),
    } as unknown as ImageStage
    const { result } = renderExport({ stageRef: { current: stage } })

    await act(async () => {
      await result.current.exportPng()
    })

    expect(result.current.exportFeedback).toEqual({
      kind: 'error',
      text: `${messages.zh.app.exportFailed}${messages.zh.app.unknownError}`,
    })
  })

  it('does nothing when there is no file', async () => {
    const { result, stageRef } = renderExport({ fileName: null })

    await act(async () => {
      await result.current.exportPng()
    })

    expect(stageRef.current?.capturePng).not.toHaveBeenCalled()
    expect(downloadMocks.downloadBlob).not.toHaveBeenCalled()
    expect(result.current.isExporting).toBe(false)
  })

  it('switches to 3D, records a loop, and downloads the WebM', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback): number => {
        callback(0)
        return 0
      },
    )
    const { result, stageRef, onChangeView } = renderExport()

    await act(async () => {
      await result.current.exportVideo()
    })

    expect(onChangeView).toHaveBeenCalledWith('3d')
    expect(stageRef.current?.recordLoop).toHaveBeenCalledWith(3000)
    expect(downloadMocks.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'photo-loop.webm',
    )
    expect(result.current.exportFeedback).toEqual({
      kind: 'info',
      text: messages.zh.app.exportVideoDone,
    })
  })

  it('ignores a second export fired in the same tick', async () => {
    const { result, stageRef } = renderExport()

    await act(async () => {
      const first = result.current.exportPng()
      const second = result.current.exportPng()
      await Promise.all([first, second])
    })

    expect(stageRef.current?.capturePng).toHaveBeenCalledTimes(1)
  })

  it('dismisses the export feedback', async () => {
    const { result } = renderExport()

    await act(async () => {
      await result.current.exportPng()
    })
    act(() => {
      result.current.dismissExportFeedback()
    })

    expect(result.current.exportFeedback).toBeNull()
  })
})
