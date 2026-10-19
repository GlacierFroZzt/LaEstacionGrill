import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { servicioActualizaciones } from './services/servicioActualizaciones'
import { servicioTelemetria } from './services/servicioTelemetria'

// Registrar inicio de la terminal en el sistema de telemetría y auditoría
if (typeof window !== 'undefined') {
  servicioTelemetria.registrarInfo('Terminal operativa iniciada', {
    pantalla: `${window.innerWidth}x${window.innerHeight}`,
    orientacion: window.innerWidth > window.innerHeight ? 'horizontal' : 'vertical',
  });
}

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
