import { createContext } from 'react'
import { messages, type Locale, type Messages } from './messages'

export interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
}

export const I18nContext = createContext<I18nValue>({
  locale: 'zh',
  setLocale: () => undefined,
  t: messages.zh,
})
