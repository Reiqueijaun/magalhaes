import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Garante que o navegador utilize sempre HTTPS em produção (evita bloqueio e drop de payload POST)
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1')
) {
  window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}`);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
