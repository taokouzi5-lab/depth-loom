import type { ImageErrorCode } from '../../lib/image/errors'
import './upload-zone.css'

export type UploadNotice = {
  code: ImageErrorCode
  message: string
}

type UploadZoneProps = {
  onBrowse: () => void
  error?: UploadNotice | null
  onDismissError?: () => void
  isBusy?: boolean
}

export function UploadZone({
  onBrowse,
  error = null,
  onDismissError,
  isBusy = false,
}: UploadZoneProps) {
  return (
    <section className="dl-empty" aria-labelledby="dl-empty-title">
      <div className="dl-empty__copy">
        <p className="dl-eyebrow">Local depth engine</p>
        <h1 id="dl-empty-title" className="dl-empty__title">
          让一张照片，
          <br />
          拥有纵深。
        </h1>
        <p className="dl-empty__lede">
          把平面照片变成可以拖拽的 3D 视差。深度在浏览器里估计，全程不上传。
        </p>
        <div className="dl-empty__meta" aria-label="产品特性">
          <span>无需登录</span>
          <span>无需上传</span>
          <span>免费开源</span>
        </div>
      </div>

      <div className="dl-empty__action">
        <button
          type="button"
          className="dl-drop"
          onClick={onBrowse}
          disabled={isBusy}
          aria-busy={isBusy}
        >
          <span className="dl-drop__contours" aria-hidden="true">
            <svg viewBox="0 0 240 280" fill="none" role="presentation">
              <rect x="64" y="40" width="112" height="146" rx="8" stroke="currentColor" opacity="0.16" />
              <rect x="52" y="54" width="136" height="170" rx="10" stroke="currentColor" opacity="0.12" />
              <rect x="40" y="68" width="160" height="194" rx="12" stroke="currentColor" opacity="0.085" />
              <rect x="28" y="82" width="184" height="218" rx="14" stroke="currentColor" opacity="0.055" />
              <path d="M28 214h184" stroke="currentColor" opacity="0.06" />
            </svg>
            <span className="dl-drop__scan" />
          </span>

          <span className="dl-drop__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" role="presentation">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="dl-drop__title">
            {isBusy ? '正在解码图片…' : '拖入图片，或点击选择'}
          </span>
          <span className="dl-drop__hint">JPG · PNG · WebP · ≤ 20 MB</span>
          <span className="dl-drop__paste">或按 Ctrl / Cmd + V 粘贴</span>

          <span className="dl-drop__corner dl-drop__corner--tl" aria-hidden="true" />
          <span className="dl-drop__corner dl-drop__corner--tr" aria-hidden="true" />
          <span className="dl-drop__corner dl-drop__corner--bl" aria-hidden="true" />
          <span className="dl-drop__corner dl-drop__corner--br" aria-hidden="true" />
        </button>

        <p className="dl-empty__privacy">图片只在浏览器本地处理，不会上传到任何服务器。</p>

        {error && (
          <div className="dl-error" role="alert">
            <span>{error.message}</span>
            {onDismissError && (
              <button type="button" className="dl-error__dismiss" onClick={onDismissError}>
                知道了
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
