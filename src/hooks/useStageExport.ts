import { useCallback, useRef, useState, type RefObject } from 'react'
import type { ViewMode } from '../components/controls/ControlBar'
import { canvasToPng, downloadBlob } from '../lib/export/download'
import type { Messages } from '../lib/i18n/messages'
import type { ImageStage } from '../lib/three/stageTypes'

export type ExportFeedback = {
  kind: 'info' | 'error'
  text: string
}

type UseStageExportOptions = {
  fileName: string | null
  view: ViewMode
  isDepthReady: boolean
  stageRef: RefObject<ImageStage | null>
  t: Messages
  onChangeView: (view: ViewMode) => void
}

function exportBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'depth-loom'
}

export function useStageExport({
  fileName,
  view,
  isDepthReady,
  stageRef,
  t,
  onChangeView,
}: UseStageExportOptions) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback | null>(null)
  // A ref closes the same-tick gap before `isExporting` re-renders.
  const exportingRef = useRef(false)

  const exportPng = useCallback(async () => {
    if (exportingRef.current || fileName === null) return
    exportingRef.current = true
    setIsExporting(true)
    setExportFeedback(null)

    try {
      let blob: Blob

      if (view === 'depth') {
        const depthCanvas =
          document.querySelector<HTMLCanvasElement>('canvas.dl-depth-canvas')
        if (!depthCanvas) throw new Error(t.app.depthNotReady)
        blob = await canvasToPng(depthCanvas)
      } else {
        const stage = stageRef.current
        if (!stage) throw new Error(t.app.stageNotReady)
        blob = await stage.capturePng()
      }

      downloadBlob(blob, `${exportBaseName(fileName)}-${view}.png`)
      setExportFeedback({ kind: 'info', text: t.app.exportPngDone })
    } catch (error) {
      setExportFeedback({
        kind: 'error',
        text: `${t.app.exportFailed}${
          error instanceof Error ? error.message : t.app.unknownError
        }`,
      })
    } finally {
      exportingRef.current = false
      setIsExporting(false)
    }
  }, [fileName, stageRef, t, view])

  const exportVideo = useCallback(async () => {
    if (exportingRef.current || !isDepthReady) return
    exportingRef.current = true
    setIsExporting(true)
    setExportFeedback(null)

    try {
      if (view !== '3d') {
        onChangeView('3d')
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
      }

      const stage = stageRef.current
      if (!stage) throw new Error(t.app.stageNotReady)
      const blob = await stage.recordLoop(3000)
      const base = fileName ? exportBaseName(fileName) : 'depth-loom'
      downloadBlob(blob, `${base}-loop.webm`)
      setExportFeedback({ kind: 'info', text: t.app.exportVideoDone })
    } catch (error) {
      setExportFeedback({
        kind: 'error',
        text: `${t.app.exportFailed}${
          error instanceof Error ? error.message : t.app.unknownError
        }`,
      })
    } finally {
      exportingRef.current = false
      setIsExporting(false)
    }
  }, [fileName, isDepthReady, onChangeView, stageRef, t, view])

  const dismissExportFeedback = useCallback(() => {
    setExportFeedback(null)
  }, [])

  return {
    isExporting,
    exportFeedback,
    dismissExportFeedback,
    exportPng,
    exportVideo,
  }
}
