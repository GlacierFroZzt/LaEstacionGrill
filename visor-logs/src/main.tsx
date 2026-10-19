import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

// Exponer y disparar verificación automática inmediata de la Terminal en segundo plano
declare global {
  interface Window {
    servicioActualizacionesAuto?: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.servicioActualizacionesAuto = async () => {
    try {
      const puenteOta = (window as unknown as {
        AndroidOtaBridge?: {
          descargarYActualizar: (url?: string) => void;
        };
      }).AndroidOtaBridge;

      if (!puenteOta) return;

      const res = await fetch(
        `https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/terminal-version.json?t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const data = await res.json();
      const versionLocal = localStorage.getItem('terminal_version_local') || '1.0.0';
      if (data.version && data.version !== versionLocal) {
        localStorage.setItem('terminal_version_local', data.version);
        puenteOta.descargarYActualizar(
          'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/terminal-bundle.zip'
        );
      }
    } catch (err: unknown) {
      console.warn('[Terminal] Error al comprobar actualización OTA:', err);
    }
  };

  // Comprobar actualización tras montar
  setTimeout(() => {
    window.servicioActualizacionesAuto?.();
  }, 300);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
