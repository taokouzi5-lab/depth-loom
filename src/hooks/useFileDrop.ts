import { useEffect, useRef, useState } from 'react'

function containsFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  return types ? Array.from(types).includes('Files') : false
}

/**
 * Window-level file drop. The drag counter avoids the flicker caused by
 * dragenter/dragleave firing for every child element.
 */
export function useFileDrop(onFiles: (files: File[]) => void): { isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    function handleDragEnter(event: DragEvent): void {
      if (!containsFiles(event)) return
      event.preventDefault()
      depth.current += 1
      setIsDragging(true)
    }

    function handleDragOver(event: DragEvent): void {
      if (!containsFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    function handleDragLeave(event: DragEvent): void {
      // Do not gate this on dataTransfer.types: some browsers clear the types
      // before the final dragleave, which would leave the overlay stuck.
      if (depth.current === 0) return
      event.preventDefault()
      depth.current = Math.max(0, depth.current - 1)
      if (event.relatedTarget === null || depth.current === 0) {
        depth.current = 0
        setIsDragging(false)
      }
    }

    function handleDrop(event: DragEvent): void {
      if (!containsFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setIsDragging(false)
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        onFiles(Array.from(files))
      }
    }

    function handleDragEnd(): void {
      depth.current = 0
      setIsDragging(false)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragend', handleDragEnd)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragend', handleDragEnd)
    }
  }, [onFiles])

  return { isDragging }
}
