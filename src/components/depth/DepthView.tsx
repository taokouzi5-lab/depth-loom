import { useEffect, useRef } from 'react'
import type { DepthMap } from '../../lib/depth/protocol'
import { depthToRgba } from '../../lib/depth/normalize'
import type { ProcessedImage } from '../../lib/image/decode'
import './depth-view.css'

type DepthViewProps = {
  image: ProcessedImage
  depth: DepthMap
}

export function DepthView({ image, depth }: DepthViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = image.width
    canvas.height = image.height

    const context = canvas.getContext('2d')
    if (!context) return

    const source = document.createElement('canvas')
    source.width = depth.width
    source.height = depth.height
    const sourceContext = source.getContext('2d')
    if (!sourceContext) return

    sourceContext.putImageData(
      new ImageData(depthToRgba(depth.data), depth.width, depth.height),
      0,
      0,
    )

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, 0, 0, image.width, image.height)
  }, [depth, image])

  return (
    <div className="dl-depth-view">
      <div className="dl-depth-view__label" aria-hidden="true">
        <span>DEPTH MAP</span>
        <span>越亮越近</span>
      </div>
      <canvas
        ref={canvasRef}
        className="dl-depth-canvas"
        role="img"
        aria-label="深度图，越亮表示越近"
      />
    </div>
  )
}
