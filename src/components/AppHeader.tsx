import { useI18n } from '../lib/i18n/useI18n'

export function AppHeader() {
  const { locale, setLocale, t } = useI18n()
  const nextLocale = locale === 'zh' ? 'en' : 'zh'

  return (
    <header className="dl-header">
      <div className="dl-wordmark">
        <span className="dl-wordmark__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation">
            <path className="dl-wordmark__layer dl-wordmark__layer--accent" d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
            <path className="dl-wordmark__layer" d="m3 12 9 4.5 9-4.5" />
            <path className="dl-wordmark__layer" d="m3 16.5 9 4.5 9-4.5" />
          </svg>
        </span>
        <span className="dl-wordmark__text">DEPTH LOOM</span>
        <span className="dl-wordmark__tag">2D → 3D</span>
      </div>

      <div className="dl-header__meta">
        <span className="dl-status">
          <span className="dl-status__dot" aria-hidden="true" />
          {t.header.privacy}
        </span>
        <button
          type="button"
          className="dl-lang"
          onClick={() => setLocale(nextLocale)}
          aria-label={t.header.switchLabel}
          title={t.header.switchLabel}
        >
          {locale === 'zh' ? 'EN' : '中文'}
        </button>
        <span className="dl-header__license">MIT</span>
      </div>
    </header>
  )
}

