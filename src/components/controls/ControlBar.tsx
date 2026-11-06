import './control-bar.css'

export type ViewMode = 'original' | 'depth' | '3d'

type ControlBarProps = {
  fileName: string
  width: number
  height: number
  isBusy?: boolean
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  isDepthReady: boolean
  strength: number
  onStrengthChange: (value: number) => void
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
  strength,
  onStrengthChange,
  onReset,
  onBrowse,
}: ControlBarProps) {
  const hint =
    view === 'depth'
      ? '深度图 · 越亮越近'
      : '拖拽旋转 · 滚轮 / 双指缩放'
  const strengthDisabled = !isDepthReady || view !== '3d' || isBusy

  return (
    <div className="dl-controlbar" role="group" aria-label="视图控制">
      <span className="dl-controlbar__handle" aria-hidden="true" />

      <div className="dl-controlbar__row">
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
          <button
            type="button"
            className="dl-viewswitch__button"
            aria-pressed={view === '3d'}
            onClick={() => onViewChange('3d')}
            disabled={!isDepthReady}
            title={isDepthReady ? '查看 3D 视差' : '深度估计完成后可用'}
          >
            3D
          </button>
        </div>

        <div className="dl-controlbar__actions">
          <button type="button" className="dl-button dl-button--ghost" onClick={onReset} disabled={isBusy}>
            重置视角
          </button>
          <button type="button" className="dl-button dl-button--accent" onClick={onBrowse} disabled={isBusy}>
            换一张
          </button>
        </div>
      </div>

      <div className="dl-controlbar__row dl-controlbar__row--secondary">
        <label className="dl-strength">
          <span className="dl-strength__label">深度强度</span>
          <input
            className="dl-strength__input"
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={strength}
            onChange={(event) => onStrengthChange(Number(event.currentTarget.value))}
            disabled={strengthDisabled}
            aria-label="深度强度"
          />
          <span className="dl-strength__value">{strength.toFixed(2)}×</span>
        </label>

        <p className="dl-controlbar__hint">{hint}</p>
      </div>
    </div>
  )
}
