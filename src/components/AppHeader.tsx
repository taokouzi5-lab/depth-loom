export function AppHeader() {
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
          本地处理 · 不上传
        </span>
        <span className="dl-header__license">MIT</span>
      </div>
    </header>
  )
}
