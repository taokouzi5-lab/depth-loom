import type {
  BackgroundStatus,
  DepthMode,
  DepthProgress,
  DepthStatus as DepthStatusValue,
} from '../../lib/depth/protocol'
import { useI18n } from '../../lib/i18n/useI18n'
import './depth-status.css'

type DepthStatusProps = {
  status: DepthStatusValue
  progress: DepthProgress | null
  mode: DepthMode | null
  error: string | null
  onRetry: () => void
  backgroundStatus?: BackgroundStatus
  backgroundProgress?: DepthProgress | null
}

export function DepthStatus({
  status,
  progress,
  mode,
  error,
  onRetry,
  backgroundStatus = 'idle',
  backgroundProgress = null,
}: DepthStatusProps) {
  const { t } = useI18n()

  if (status === 'idle') return null

  if (status === 'error') {
    return (
      <div className="dl-depth-status dl-depth-status--error" role="alert">
        <div className="dl-depth-status__copy">
          <span className="dl-depth-status__title">{t.depth.errorTitle}</span>
          {error && <span className="dl-depth-status__detail">{error}</span>}
        </div>
        <button type="button" className="dl-depth-status__retry" onClick={onRetry}>
          {t.depth.retry}
        </button>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div
        className="dl-depth-status dl-depth-status--ready"
        role="status"
        data-background-status={backgroundStatus}
      >
        <span className="dl-depth-status__dot" aria-hidden="true" />
        <span>{t.depth.ready}</span>
        {mode && (
          <span className="dl-depth-status__badge">
            {mode === 'wasm' ? t.depth.cpuBadge : t.depth.webgpuBadge}
          </span>
        )}
        {backgroundStatus === 'loading' && (
          <span className="dl-depth-status__detail">
            {t.depth.inpainting}
            {backgroundProgress
              ? ` ${Math.round(backgroundProgress.progress)}%`
              : ''}
          </span>
        )}
      </div>
    )
  }

  const percent = progress ? Math.round(progress.progress) : null
  const title =
    status === 'loading' ? t.depth.loadingTitle : t.depth.estimatingTitle

  return (
    <div
      className="dl-depth-status dl-depth-status--busy"
      role="status"
      aria-live="polite"
    >
      <div className="dl-depth-status__copy">
        <span className="dl-depth-status__title">{title}</span>
        <span className="dl-depth-status__detail">
          {status === 'loading' && percent !== null ? `${percent}%` : t.depth.waiting}
        </span>
      </div>
      {mode === 'wasm' && (
        <span className="dl-depth-status__badge">{t.depth.cpuBadge}</span>
      )}
      {percent !== null && (
        <div className="dl-depth-status__track" aria-hidden="true">
          <span
            className="dl-depth-status__fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

