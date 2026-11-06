import { useEffect, useState, type ReactNode } from 'react'
import { I18nContext } from './context'
import { messages, type Locale } from './messages'

const STORAGE_KEY = 'depth-loom-locale'

function readStoredLocale(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Private browsing or blocked storage: the in-memory locale still works.
    }
  }, [locale])

  const setLocale = (next: Locale): void => {
    setLocaleState(next)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: messages[locale] }}>
      {children}
    </I18nContext.Provider>
  )
}
