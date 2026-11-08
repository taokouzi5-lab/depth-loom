import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { AppHeader } from './components/AppHeader'
import {
  ControlBar,
  type ViewMode,
} from './components/controls/ControlBar'
import { DepthStatus } from './components/depth/DepthStatus'
import { DepthView } from './components/depth/DepthView'
import { StageErrorBoundary } from './components/stage/StageErrorBoundary'
import { UploadZone, type UploadNotice } from './components/upload/UploadZone'
import { useDepthEstimation } from './hooks/useDepthEstimation'
import { useFileDrop } from './hooks/useFileDrop'
import { usePasteImage } from './hooks/usePasteImage'
import { useStageExport } from './hooks/useStageExport'
import type { CreateDepthClient } from './lib/depth/protocol'
import { useI18n } from './lib/i18n/useI18n'
import { decodeImage, type ProcessedImage } from './lib/image/decode'
import { ImageError, type ImageErrorCode } from './lib/image/errors'
import { validateImageFile } from './lib/image/validate'
import type { SampleImage } from './lib/samples'
import type { ImageStage } from './lib/three/stageTypes'
import './styles/app.css'

const DepthStage = lazy(() => import('./components/stage/DepthStage'))

type ImageState =
  | { status: 'empty' }
  | { status: 'ready'; image: ProcessedImage }

type AppProps = {
  createDepthClient: CreateDepthClient
}

export default function App({ createDepthClient }: AppProps) {
  const { t } = useI18n()
  const [imageState, setImageState] = useState<ImageState>({ status: 'empty' })
  const [isDecoding, setIsDecoding] = useState(false)
  const [isFetchingSample, setIsFetchingSample] = useState(false)
  const [notice, setNotice] = useState<UploadNotice | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [view, setView] = useState<ViewMode>('original')
  const [strength, setStrength] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<ImageStage | null>(null)
  const latestJob = useRef(0)
  const userChoseView = useRef(false)

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.ok) {
      setNotice({
        code: validation.code,
        message: t.errors[validation.code],
      })
      return
    }

    const job = latestJob.current + 1
    latestJob.current = job
    setIsDecoding(true)
    setNotice(null)

    try {
      const image = await decodeImage(file)
      if (latestJob.current !== job) return
      setImageState({ status: 'ready', image })
      setResetSignal(0)
      setView('original')
      setStrength(1)
      userChoseView.current = false
    } catch (error) {
      if (latestJob.current !== job) return
      const code: ImageErrorCode =
        error instanceof ImageError ? error.code : 'decode_failed'
      setNotice({ code, message: t.errors[code] })
    } finally {
      if (latestJob.current === job) {
        setIsDecoding(false)
      }
    }
  }, [t])

  const handleSample = useCallback(
    async (sample: SampleImage) => {
      if (isDecoding || isFetchingSample) return
      setIsFetchingSample(true)
      setNotice(null)

      try {
        const response = await fetch(sample.src)
        if (!response.ok) {
          throw new Error(`Sample request failed: ${response.status}`)
        }
        const blob = await response.blob()
        const file = new File([blob], sample.fileName, {
          type: blob.type || 'image/jpeg',
        })
        await handleFiles([file])
      } catch {
        setNotice({
          code: 'decode_failed',
          message: t.errors.sampleFailed,
        })
      } finally {
        setIsFetchingSample(false)
      }
    },
    [handleFiles, isDecoding, isFetchingSample, t],
  )

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.currentTarget.files
      if (files) {
        void handleFiles(Array.from(files))
      }
      // Allow selecting the same file again after a failed attempt.
      event.currentTarget.value = ''
    },
    [handleFiles],
  )

  const { isDragging } = useFileDrop(handleFiles)
  usePasteImage(handleFiles)

  const isReady = imageState.status === 'ready'
  // `?depth=off` is a lightweight original-only mode. It also lets upload E2E
  // tests skip the ~50 MB model download they do not need.
  const isDepthDisabled =
    new URLSearchParams(window.location.search).get('depth') === 'off'
  const depth = useDepthEstimation(
    isReady && !isDepthDisabled ? imageState.image : null,
    createDepthClient,
  )
  const isDepthReady = depth.status === 'ready' && depth.depth !== null
  const activeView: ViewMode =
    isDepthReady && view === 'depth'
      ? 'depth'
      : isDepthReady && view === '3d'
        ? '3d'
        : 'original'

  useEffect(() => {
    if (isDepthReady && !userChoseView.current) {
      // Bring the photo to life once the first depth result lands. If the user
      // already picked a view (including original), respect that choice.
      // oxlint-disable-next-line react/set-state-in-effect
      setView('3d')
    }
  }, [isDepthReady])

  const handleViewChange = useCallback((next: ViewMode) => {
    userChoseView.current = true
    setView(next)
  }, [])

  const handleStrengthChange = useCallback((next: number) => {
    setStrength(next)
  }, [])

  const handleStageReady = useCallback((stage: ImageStage | null) => {
    stageRef.current = stage
  }, [])

  const {
    isExporting,
    exportFeedback,
    dismissExportFeedback,
    exportPng,
    exportVideo,
  } = useStageExport({
    fileName: imageState.status === 'ready' ? imageState.image.fileName : null,
    view: activeView,
    isDepthReady,
    stageRef,
    t,
    onChangeView: handleViewChange,
  })

  useEffect(() => {
    // A new image starts a fresh session; an old export notice would be stale.
    dismissExportFeedback()
  }, [imageState, dismissExportFeedback])

  return (
    <div className="dl-app">
      <AppHeader />

      {!isReady && (
        <p className="dl-visually-hidden" role="status" aria-live="polite">
          {isDecoding ? t.app.decodingStatus : ''}
        </p>
      )}

      <main className="dl-main">
        <div className="dl-main__frame" aria-hidden="true" />

        {isReady ? (
          <div className="dl-stage-wrap" aria-busy={isDecoding}>
            <StageErrorBoundary
              message={t.stage.boundaryMessage}
              reloadLabel={t.stage.reload}
            >
              <Suspense
                fallback={
                  <div className="dl-stage-fallback" role="status">
                    {t.app.stageFallback}
                  </div>
                }
              >
                <DepthStage
                  image={imageState.image}
                  depth={depth.depth}
                  view={activeView === '3d' ? '3d' : 'original'}
                  strength={strength}
                  resetSignal={resetSignal}
                  onStageReady={handleStageReady}
                />
              </Suspense>
            </StageErrorBoundary>

            {activeView === 'depth' &&
              depth.depth &&
              imageState.status === 'ready' && (
                <DepthView image={imageState.image} depth={depth.depth} />
              )}

            {(depth.status === 'loading' || depth.status === 'estimating') && (
              <div className="dl-depth-scan" aria-hidden="true" />
            )}

            <DepthStatus
              status={depth.status}
              progress={depth.progress}
              mode={depth.mode}
              error={depth.error}
              onRetry={() => {
                userChoseView.current = false
                setView('original')
                depth.retry()
              }}
            />

            {isDecoding && (
              <div className="dl-busy-pill" role="status">
                {t.app.decodingNew}
              </div>
            )}

            {notice && (
              <div className="dl-toast" role="alert">
                <span>{notice.message}</span>
                <button
                  type="button"
                  className="dl-toast__dismiss"
                  onClick={() => setNotice(null)}
                  aria-label={t.app.closeNotice}
                >
                  ×
                </button>
              </div>
            )}

            {exportFeedback && (
              <div
                className={`dl-toast${exportFeedback.kind === 'info' ? ' dl-toast--info' : ''}`}
                role={exportFeedback.kind === 'error' ? 'alert' : 'status'}
              >
                <span>{exportFeedback.text}</span>
                <button
                  type="button"
                  className="dl-toast__dismiss"
                  onClick={dismissExportFeedback}
                  aria-label={t.app.closeExportNotice}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ) : (
          <UploadZone
            onBrowse={openFilePicker}
            onSample={(sample) => void handleSample(sample)}
            error={notice}
            onDismissError={() => setNotice(null)}
            isBusy={isDecoding || isFetchingSample}
          />
        )}
      </main>

      {isReady && (
        <ControlBar
          fileName={imageState.image.fileName}
          width={imageState.image.width}
          height={imageState.image.height}
          isBusy={isDecoding}
          view={activeView}
          onViewChange={handleViewChange}
          isDepthReady={isDepthReady}
          strength={strength}
          onStrengthChange={handleStrengthChange}
          isExporting={isExporting}
          onExportPng={() => void exportPng()}
          onExportVideo={() => void exportVideo()}
          onReset={() => setResetSignal((value) => value + 1)}
          onBrowse={openFilePicker}
        />
      )}

      {isDragging && (
        <div className="dl-drop-overlay" role="status">
          <div className="dl-drop-overlay__inner">
            <span className="dl-drop-overlay__label">
              {t.app.dropOverlayTitle}
            </span>
            <span className="dl-drop-overlay__hint">
              {t.app.dropOverlayHint}
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        className="dl-visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t.app.selectImage}
        onChange={handleFileInput}
        tabIndex={-1}
      />
    </div>
  )
}

