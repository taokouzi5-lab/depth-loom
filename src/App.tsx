import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { AppHeader } from './components/AppHeader'
import { ControlBar } from './components/controls/ControlBar'
import { StageErrorBoundary } from './components/stage/StageErrorBoundary'
import { UploadZone, type UploadNotice } from './components/upload/UploadZone'
import { useFileDrop } from './hooks/useFileDrop'
import { usePasteImage } from './hooks/usePasteImage'
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

export default function App() {
  const [imageState, setImageState] = useState<ImageState>({ status: 'empty' })
  const [isDecoding, setIsDecoding] = useState(false)
  const [notice, setNotice] = useState<UploadNotice | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const latestJob = useRef(0)

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
                <DepthStage image={imageState.image} resetSignal={resetSignal} />
              </Suspense>
            </StageErrorBoundary>

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
