import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileDrop } from './useFileDrop'

function makeDragEvent(
  type: string,
  options: { files?: File[]; types?: string[]; relatedTarget?: EventTarget | null } = {},
): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: options.files ?? [],
      types: options.types ?? ['Files'],
      dropEffect: 'none',
    },
  })
  Object.defineProperty(event, 'relatedTarget', {
    value: options.relatedTarget ?? null,
  })
  return event as DragEvent
}

function makeFile(name = 'photo.jpg'): File {
  return new File(['pixels'], name, { type: 'image/jpeg' })
}

describe('useFileDrop', () => {
  it('tracks dragging state and delivers dropped files', () => {
    const onFiles = vi.fn()
    const { result } = renderHook(() => useFileDrop(onFiles))
    expect(result.current.isDragging).toBe(false)

    act(() => {
      window.dispatchEvent(makeDragEvent('dragenter'))
    })
    expect(result.current.isDragging).toBe(true)

    const file = makeFile()
    act(() => {
      window.dispatchEvent(makeDragEvent('drop', { files: [file] }))
    })
    expect(result.current.isDragging).toBe(false)
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('ignores drags that do not carry files', () => {
    const onFiles = vi.fn()
    const { result } = renderHook(() => useFileDrop(onFiles))

    act(() => {
      window.dispatchEvent(makeDragEvent('dragenter', { types: ['text/plain'] }))
    })
    expect(result.current.isDragging).toBe(false)

    act(() => {
      window.dispatchEvent(makeDragEvent('drop', { types: ['text/plain'] }))
    })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('uses a drag counter to avoid flicker over child elements', () => {
    const { result } = renderHook(() => useFileDrop(vi.fn()))

    act(() => {
      window.dispatchEvent(makeDragEvent('dragenter'))
      window.dispatchEvent(makeDragEvent('dragenter'))
    })
    expect(result.current.isDragging).toBe(true)

    act(() => {
      window.dispatchEvent(
        makeDragEvent('dragleave', { relatedTarget: document.body }),
      )
    })
    expect(result.current.isDragging).toBe(true)

    act(() => {
      window.dispatchEvent(makeDragEvent('dragleave', { relatedTarget: null }))
    })
    expect(result.current.isDragging).toBe(false)
  })

  it('resets when the drag ends', () => {
    const { result } = renderHook(() => useFileDrop(vi.fn()))

    act(() => {
      window.dispatchEvent(makeDragEvent('dragenter'))
    })
    expect(result.current.isDragging).toBe(true)

    act(() => {
      window.dispatchEvent(makeDragEvent('dragend'))
    })
    expect(result.current.isDragging).toBe(false)
  })

  it('removes listeners on unmount', () => {
    const onFiles = vi.fn()
    const { unmount } = renderHook(() => useFileDrop(onFiles))
    unmount()

    act(() => {
      window.dispatchEvent(makeDragEvent('drop', { files: [makeFile()] }))
    })
    expect(onFiles).not.toHaveBeenCalled()
  })
})
