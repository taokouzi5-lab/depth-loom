export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Flatten a transparent WebGL/depth canvas onto the app background. */
export function canvasToPng(
  canvas: HTMLCanvasElement,
  background = '#0a0a0b',
): Promise<Blob> {
  if (canvas.width === 0 || canvas.height === 0) {
    return Promise.reject(new Error('The canvas has no pixels to export.'))
  }

  const output = document.createElement('canvas')
  output.width = canvas.width
  output.height = canvas.height
  const context = output.getContext('2d')
  if (!context) {
    return Promise.reject(new Error('Could not create an export canvas.'))
  }

  context.fillStyle = background
  context.fillRect(0, 0, output.width, output.height)
  context.drawImage(canvas, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    output.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not encode the PNG.'))
      }
    }, 'image/png')
  })
}
