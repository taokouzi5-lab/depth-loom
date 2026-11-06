import type {
  DepthMode,
  DepthProgress,
  DepthStatus as DepthStatusValue,
} from '../../lib/depth/protocol'
import './depth-status.css'

type DepthStatusProps = {
  status: DepthStatusValue
  progress: DepthProgress | null
  mode: DepthMode | null
  error: string | null
  onRetry: () => void
}

export function DepthStatus({
  status,
  progress,
  mode,
  error,
  onRetry,
}: DepthStatusProps) {
  if (status === 'idle') return null

  if (status === 'error') {
    return (
      <div className="dl-depth-status dl-depth-status--error" role="alert">
        <div className="dl-depth-status__copy">
          <span className="dl-depth-status__title">深度估计失败</span>
          {error && <span className="dl-depth-status__detail">{error}</span>}
        </div>
        <button type="button" className="dl-depth-status__retry" onClick={onRetry}>
          重试
        </button>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div className="dl-depth-status dl-depth-status--ready" role="status">
        <span className="dl-depth-status__dot" aria-hidden="true" />
        <span>深度已就绪</span>
        {mode && (
          <span className="dl-depth-status__badge">
            {mode === 'wasm' ? 'CPU 模式 · 较慢' : 'WebGPU'}
          </span>
        )}
      </div>
    )
  }

  const percent = progress ? Math.round(progress.progress) : null
  const title = status === 'loading' ? '正在加载深度模型' : '正在估计深度'

  return (
    <div
      className="dl-depth-status dl-depth-status--busy"
      role="status"
      aria-live="polite"
    >
      <div className="dl-depth-status__copy">
        <span className="dl-depth-status__title">{title}</span>
        <span className="dl-depth-status__detail">
          {status === 'loading' && percent !== null ? `${percent}%` : '请稍候…'}
        </span>
      </div>
      {mode === 'wasm' && (
        <span className="dl-depth-status__badge">CPU 模式 · 较慢</span>
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
