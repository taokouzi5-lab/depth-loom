import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n/useI18n'
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
  isExporting: boolean
  onExportPng: () => void
  onExportVideo: () => void
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
  isExporting,
  onExportPng,
  onExportVideo,
  onReset,
  onBrowse,
}: ControlBarProps) {
  const { t } = useI18n()
  const [isExportOpen, setIsExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isExportOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!exportRef.current?.contains(event.target as Node)) {
        setIsExportOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [isExportOpen])

  const hint =
    view === 'depth' ? t.controls.hintDepth : t.controls.hintOriginal
  const strengthDisabled = !isDepthReady || view !== '3d' || isBusy

  return (
    <div className="dl-controlbar" role="group" aria-label={t.controls.group}>
      <span className="dl-controlbar__handle" aria-hidden="true" />

      <div className="dl-controlbar__row">
        <div className="dl-file">
          <span className="dl-file__dot" aria-hidden="true" />
          <span className="dl-file__text">
            <span className="dl-file__name" title={fileName}>
              {fileName}
            </span>
            <span className="dl-file__meta">
              {width} × {height} px · {t.controls.local}
            </span>
          </span>
        </div>

        <div className="dl-viewswitch" role="group" aria-label={t.controls.viewGroup}>
          <button
            type="button"
            className="dl-viewswitch__button"
            aria-pressed={view === 'original'}
            onClick={() => onViewChange('original')}
          >
            {t.controls.original}
          </button>
          <button
            type="button"
            className="dl-viewswitch__button"
            aria-pressed={view === 'depth'}
            onClick={() => onViewChange('depth')}
            disabled={!isDepthReady}
            title={isDepthReady ? t.controls.viewDepthTitle : t.controls.videoDisabledTitle}
          >
            {t.controls.depth}
          </button>
          <button
            type="button"
            className="dl-viewswitch__button"
            aria-pressed={view === '3d'}
            onClick={() => onViewChange('3d')}
            disabled={!isDepthReady}
            title={isDepthReady ? t.controls.view3dTitle : t.controls.videoDisabledTitle}
          >
            {t.controls.threeD}
          </button>
        </div>

        <div className="dl-controlbar__actions">
          <button type="button" className="dl-button dl-button--ghost" onClick={onReset} disabled={isBusy}>
            {t.controls.reset}
          </button>

          <div className="dl-export" ref={exportRef}>
            <button
              type="button"
              className="dl-button dl-button--ghost"
              onClick={() => setIsExportOpen((open) => !open)}
              aria-expanded={isExportOpen}
              aria-haspopup="menu"
              disabled={isExporting || isBusy}
            >
              {isExporting ? t.controls.exporting : t.controls.export}
            </button>
            {isExportOpen && (
              <div className="dl-export__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="dl-export__item"
                  onClick={() => {
                    setIsExportOpen(false)
                    onExportPng()
                  }}
                >
                  {t.controls.png}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dl-export__item"
                  onClick={() => {
                    setIsExportOpen(false)
                    onExportVideo()
                  }}
                  disabled={!isDepthReady || isExporting}
                  title={isDepthReady ? t.controls.videoReadyTitle : t.controls.videoDisabledTitle}
                >
                  {t.controls.webm}
                </button>
              </div>
            )}
          </div>

          <button type="button" className="dl-button dl-button--accent" onClick={onBrowse} disabled={isBusy}>
            {t.controls.browse}
          </button>
        </div>
      </div>

      <div className="dl-controlbar__row dl-controlbar__row--secondary">
        <label className="dl-strength">
          <span className="dl-strength__label">{t.controls.strength}</span>
          <input
            className="dl-strength__input"
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={strength}
            onChange={(event) => onStrengthChange(Number(event.currentTarget.value))}
            disabled={strengthDisabled}
            aria-label={t.controls.strength}
          />
          <span className="dl-strength__value">{strength.toFixed(2)}×</span>
        </label>

        <p className="dl-controlbar__hint">{hint}</p>
      </div>
    </div>
  )
}

