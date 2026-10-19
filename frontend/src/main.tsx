import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { servicioActualizaciones } from './services/servicioActualizaciones'
import './services/servicioTelemetria'

// Exponer y disparar verificación automática inmediata en segundo plano
declare global {
  interface Window {
    servicioActualizacionesAuto?: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.servicioActualizacionesAuto = () => {
    servicioActualizaciones.verificarYActualizarSilencioso();
  };
  // Ejecutar en el milisegundo cero del arranque
  setTimeout(() => {
    servicioActualizaciones.verificarYActualizarSilencioso();
  }, 100);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
