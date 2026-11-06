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
import type { CreateDepthClient } from './lib/depth/protocol'
import { decodeImage, type ProcessedImage } from './lib/image/decode'
import {
  IMAGE_ERROR_MESSAGES,
  ImageError,
  type ImageErrorCode,
} from './lib/image/errors'
import { validateImageFile } from './lib/image/validate'
import './styles/app.css'

const DepthStage = lazy(() => import('./components/stage/DepthStage'))

type ImageState =
  | { status: 'empty' }
  | { status: 'ready'; image: ProcessedImage }

type AppProps = {
  createDepthClient: CreateDepthClient
}

export default function App({ createDepthClient }: AppProps) {
  const [imageState, setImageState] = useState<ImageState>({ status: 'empty' })
  const [isDecoding, setIsDecoding] = useState(false)
  const [notice, setNotice] = useState<UploadNotice | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [view, setView] = useState<ViewMode>('original')
  const [strength, setStrength] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
        message: IMAGE_ERROR_MESSAGES[validation.code],
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
      setNotice({ code, message: IMAGE_ERROR_MESSAGES[code] })
    } finally {
      if (latestJob.current === job) {
        setIsDecoding(false)
      }
    }
  }, [])

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

  return (
    <div className="dl-app">
      <AppHeader />

      {!isReady && (
        <p className="dl-visually-hidden" role="status" aria-live="polite">
          {isDecoding ? '正在解码图片…' : ''}
        </p>
      )}

      <main className="dl-main">
        <div className="dl-main__frame" aria-hidden="true" />

        {isReady ? (
          <div className="dl-stage-wrap" aria-busy={isDecoding}>
            <StageErrorBoundary>
              <Suspense
                fallback={
                  <div className="dl-stage-fallback" role="status">
                    正在准备舞台…
                  </div>
                }
              >
                <DepthStage
                  image={imageState.image}
                  depth={depth.depth}
                  view={activeView === '3d' ? '3d' : 'original'}
                  strength={strength}
                  resetSignal={resetSignal}
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
                正在解码新图片…
              </div>
            )}

            {notice && (
              <div className="dl-toast" role="alert">
                <span>{notice.message}</span>
                <button
                  type="button"
                  className="dl-toast__dismiss"
                  onClick={() => setNotice(null)}
                  aria-label="关闭提示"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ) : (
          <UploadZone
            onBrowse={openFilePicker}
            error={notice}
            onDismissError={() => setNotice(null)}
            isBusy={isDecoding}
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
          onReset={() => setResetSignal((value) => value + 1)}
          onBrowse={openFilePicker}
        />
      )}

      {isDragging && (
        <div className="dl-drop-overlay" role="status">
          <div className="dl-drop-overlay__inner">
            <span className="dl-drop-overlay__label">松开，载入这张照片</span>
            <span className="dl-drop-overlay__hint">
              JPG / PNG / WebP · ≤ 20 MB
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        className="dl-visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="选择图片"
        onChange={handleFileInput}
        tabIndex={-1}
      />
    </div>
  )
}
