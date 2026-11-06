import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createDepthWorker } from './lib/depth/workerClient'
import { I18nProvider } from './lib/i18n/I18nContext'
import './styles/tokens.css'
import './styles/global.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <App createDepthClient={createDepthWorker} />
    </I18nProvider>
  </StrictMode>,
)
