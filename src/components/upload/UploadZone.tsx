import type { ImageErrorCode } from '../../lib/image/errors'
import { useI18n } from '../../lib/i18n/useI18n'
import { SAMPLE_IMAGES, type SampleImage } from '../../lib/samples'
import './upload-zone.css'

export type UploadNotice = {
  code: ImageErrorCode
  message: string
}

type UploadZoneProps = {
  onBrowse: () => void
  onSample: (sample: SampleImage) => void
  error?: UploadNotice | null
  onDismissError?: () => void
  isBusy?: boolean
}

export function UploadZone({
  onBrowse,
  onSample,
  error = null,
  onDismissError,
  isBusy = false,
}: UploadZoneProps) {
  const { t } = useI18n()

  return (
    <section className="dl-empty" aria-labelledby="dl-empty-title">
      <div className="dl-empty__copy">
        <p className="dl-eyebrow">{t.empty.eyebrow}</p>
        <h1 id="dl-empty-title" className="dl-empty__title">
          {t.empty.titleLine1}
          <br />
          {t.empty.titleLine2}
        </h1>
        <p className="dl-empty__lede">{t.empty.lede}</p>
        <div className="dl-empty__meta">
          <span>{t.empty.features.noAccount}</span>
          <span>{t.empty.features.noUpload}</span>
          <span>{t.empty.features.openSource}</span>
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
            {isBusy ? t.empty.decoding : t.empty.dropTitle}
          </span>
          <span className="dl-drop__hint">{t.empty.dropFormat}</span>
          <span className="dl-drop__paste">{t.empty.pasteHint}</span>

          <span className="dl-drop__corner dl-drop__corner--tl" aria-hidden="true" />
          <span className="dl-drop__corner dl-drop__corner--tr" aria-hidden="true" />
          <span className="dl-drop__corner dl-drop__corner--bl" aria-hidden="true" />
          <span className="dl-drop__corner dl-drop__corner--br" aria-hidden="true" />
        </button>

        <div className="dl-samples">
          <span className="dl-samples__label">{t.empty.samplesLabel}</span>
          <div className="dl-samples__list">
            {SAMPLE_IMAGES.map((sample) => {
              const name = t.empty.sampleNames[sample.id]
              return (
                <button
                  key={sample.id}
                  type="button"
                  className="dl-sample"
                  onClick={() => onSample(sample)}
                  disabled={isBusy}
                  aria-label={t.empty.sampleAria(name)}
                >
                  <img
                    className="dl-sample__thumb"
                    src={sample.thumbnail}
                    alt=""
                    loading="lazy"
                  />
                  <span className="dl-sample__label">{name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="dl-empty__privacy">{t.empty.privacy}</p>

        {error && (
          <div className="dl-error" role="alert">
            <span>{error.message}</span>
            {onDismissError && (
              <button type="button" className="dl-error__dismiss" onClick={onDismissError}>
                {t.empty.dismissError}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

