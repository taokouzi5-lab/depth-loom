import { useEffect } from 'react'

/** Accept an image from the system clipboard. Text pastes are ignored. */
export function usePasteImage(onFiles: (files: File[]) => void): void {
  useEffect(() => {
    function handlePaste(event: ClipboardEvent): void {
      const files = event.clipboardData?.files
      if (!files || files.length === 0) return
      event.preventDefault()
      onFiles(Array.from(files))
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [onFiles])
}
