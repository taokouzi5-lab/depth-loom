import type { BackgroundImage, DepthMap } from '../depth/protocol'
import type { ProcessedImage } from '../image/decode'
import type { StageView } from './depthLayer'

export interface ImageStageOptions {
  container: HTMLElement
  image: ProcessedImage
  ariaLabel?: string
}

export interface ImageStage {
  capturePng(): Promise<Blob>
  dispose(): void
  recordLoop(durationMs?: number): Promise<Blob>
  reset(): void
  setBackground(background: BackgroundImage | null): void
  setDepth(depth: DepthMap | null): void
  setImage(image: ProcessedImage): void
  setStrength(strength: number): void
  setView(view: StageView): void
}
