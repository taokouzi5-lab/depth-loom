import { useEffect, useRef, useState } from 'react'
import type { DepthMap } from '../../lib/depth/protocol'
import { useI18n } from '../../lib/i18n/useI18n'
import type { ProcessedImage } from '../../lib/image/decode'
import type { StageView } from '../../lib/three/depthLayer'
import { createImageStage } from '../../lib/three/stage'
import type { ImageStage } from '../../lib/three/stageTypes'
import './depth-stage.css'

type DepthStageProps = {
  image: ProcessedImage
  depth: DepthMap | null
  view: StageView
  strength: number
  resetSignal?: number
  onStageReady?: (stage: ImageStage | null) => void
}

export default function DepthStage({
  image,
  depth,
  view,
  strength,
  resetSignal = 0,
  onStageReady,
}: DepthStageProps) {
  const { t } = useI18n()
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
      const stage = createImageStage({
        container,
        image,
        ariaLabel: t.stage.canvasAria,
      })
      stageRef.current = stage
      onStageReady?.(stage)
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect -- the failure only exists after WebGL init runs.
      setError(t.stage.webglError)
    }
  }, [image, onStageReady, t.stage.canvasAria, t.stage.webglError])

  useEffect(
    () => () => {
      stageRef.current?.dispose()
      stageRef.current = null
      onStageReady?.(null)
    },
    [onStageReady],
  )

  useEffect(() => {
    containerRef.current
      ?.querySelector('canvas')
      ?.setAttribute('aria-label', t.stage.canvasAria)
  }, [t.stage.canvasAria])

  useEffect(() => {
    stageRef.current?.setDepth(depth)
  }, [depth])

  useEffect(() => {
    stageRef.current?.setView(view)
  }, [view])

  useEffect(() => {
    stageRef.current?.setStrength(strength)
  }, [strength])

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

