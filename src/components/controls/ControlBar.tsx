import './control-bar.css'

type ControlBarProps = {
  fileName: string
  width: number
  height: number
  isBusy?: boolean
  onReset: () => void
  onBrowse: () => void
}

export function ControlBar({
  fileName,
  width,
  height,
  isBusy = false,
  onReset,
  onBrowse,
}: ControlBarProps) {
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

      <p className="dl-controlbar__hint">拖拽旋转 · 滚轮 / 双指缩放</p>

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
