import './control-bar.css'

export type ViewMode = 'original' | 'depth'

type ControlBarProps = {
  fileName: string
  width: number
  height: number
  isBusy?: boolean
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  isDepthReady: boolean
  onReset: () => void
  onBrowse: () => void
}

export function ControlBar({
  fileName,
  width,
  height,
  isBusy = false,
  view,
  onViewChange,
  isDepthReady,
  onReset,
  onBrowse,
}: ControlBarProps) {
  const hint =
    view === 'depth'
      ? '深度图 · 越亮越近'
      : '拖拽旋转 · 滚轮 / 双指缩放'

  return (
    <div className="dl-controlbar" role="group" aria-label="视图控制">
      <span className="dl-controlbar__handle" aria-hidden="true" />

      <div className="dl-file">
        <span className="dl-file__dot" aria-hidden="true" />
        <span className="dl-file__text">
          <span className="dl-file__name" title={fileName}>
            {fileName}
          </span>
          <span className="dl-file__meta">
            {width} × {height} px · 本地
          </span>
        </span>
      </div>

      <div className="dl-viewswitch" role="group" aria-label="视图切换">
        <button
          type="button"
          className="dl-viewswitch__button"
          aria-pressed={view === 'original'}
          onClick={() => onViewChange('original')}
        >
          原图
        </button>
        <button
          type="button"
          className="dl-viewswitch__button"
          aria-pressed={view === 'depth'}
          onClick={() => onViewChange('depth')}
          disabled={!isDepthReady}
          title={isDepthReady ? '查看深度图' : '深度估计完成后可用'}
        >
          深度
        </button>
      </div>

      <p className="dl-controlbar__hint">{hint}</p>

      <div className="dl-controlbar__actions">
        <button type="button" className="dl-button dl-button--ghost" onClick={onReset} disabled={isBusy}>
          重置视角
        </button>
        <button type="button" className="dl-button dl-button--accent" onClick={onBrowse} disabled={isBusy}>
          换一张
        </button>
      </div>
    </div>
  )
}
