import { useEffect, useRef, useState } from 'react'
import type { ProcessedImage } from '../../lib/image/decode'
import { createImageStage, type ImageStage } from '../../lib/three/stage'
import './depth-stage.css'

type DepthStageProps = {
  image: ProcessedImage
  resetSignal?: number
}

export default function DepthStage({ image, resetSignal = 0 }: DepthStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<ImageStage | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Create on mount / update on image change. The renderer is reused so swapping
  // images does not leak WebGL contexts.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // WebGL initialisation is an external system: success or failure is only
    // knowable after createImageStage runs.
    // oxlint-disable-next-line react/set-state-in-effect
    setError(null)

    if (stageRef.current) {
      stageRef.current.setImage(image)
      return
    }

    try {
      stageRef.current = createImageStage({ container, image })
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect -- the failure only exists after WebGL init runs.
      setError('当前浏览器无法初始化 3D 舞台，请确认已启用 WebGL。')
    }
  }, [image])

  useEffect(
    () => () => {
      stageRef.current?.dispose()
      stageRef.current = null
    },
    [],
  )

  useEffect(() => {
    stageRef.current?.reset()
  }, [resetSignal])

  return (
    <div className="dl-stage-shell">
      <div className="dl-stage" ref={containerRef} />
      {error && (
        <div className="dl-stage-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
