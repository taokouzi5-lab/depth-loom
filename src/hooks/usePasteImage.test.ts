import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePasteImage } from './usePasteImage'

function makePasteEvent(files: File[] | null): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: files === null ? null : { files },
  })
  return event as ClipboardEvent
}

function makeFile(name = 'pasted.png'): File {
  return new File(['pixels'], name, { type: 'image/png' })
}

describe('usePasteImage', () => {
  it('delivers image files from the clipboard', () => {
    const onFiles = vi.fn()
    renderHook(() => usePasteImage(onFiles))

    const file = makeFile()
    act(() => {
      window.dispatchEvent(makePasteEvent([file]))
    })

    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('ignores text pastes and missing clipboard data', () => {
    const onFiles = vi.fn()
    renderHook(() => usePasteImage(onFiles))

    act(() => {
      window.dispatchEvent(makePasteEvent([]))
      window.dispatchEvent(makePasteEvent(null))
    })

    expect(onFiles).not.toHaveBeenCalled()
  })

  it('removes the paste listener on unmount', () => {
    const onFiles = vi.fn()
    const { unmount } = renderHook(() => usePasteImage(onFiles))
    unmount()

    act(() => {
      window.dispatchEvent(makePasteEvent([makeFile()]))
    })

    expect(onFiles).not.toHaveBeenCalled()
  })
})
