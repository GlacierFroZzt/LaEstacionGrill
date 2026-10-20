import React, { type ComponentType, type LazyExoticComponent } from 'react';

const CLAVE_STORAGE_RECARGA = 'taqueria_recarga_chunk_auto_v1';

/**
 * Envoltorio resiliente para React.lazy que intercepta errores de desincronización de chunks
 * (típico 'Failed to fetch dynamically imported module' cuando se despliega una nueva versión en producción).
 * Si la descarga del módulo falla por cambio de versión, recarga la aplicación automáticamente
 * una vez para obtener los archivos frescos sin bloquear al usuario.
 */
export function lazyConReintento<T extends ComponentType<any>>(
  importador: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const componente = await importador();
      // Si la carga fue exitosa, limpiar cualquier bandera de recarga previa
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(CLAVE_STORAGE_RECARGA);
      }
      return componente;
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);
      const esErrorDeChunk =
        mensaje.includes('Failed to fetch dynamically imported module') ||
        mensaje.includes('Importing a module script failed') ||
        mensaje.includes('error loading dynamically imported module') ||
        mensaje.includes('Failed to load module script');

      if (esErrorDeChunk && typeof window !== 'undefined') {
        const yaSeRecargo = sessionStorage.getItem(CLAVE_STORAGE_RECARGA);
        if (!yaSeRecargo) {
          sessionStorage.setItem(CLAVE_STORAGE_RECARGA, Date.now().toString());
          console.warn(
            '[lazyConReintento] Nueva versión detectada en el servidor. Recargando aplicación con los módulos actualizados...'
          );
          window.location.reload();
          // Retornar promesa en espera para no emitir errores mientras el navegador refresca
          return new Promise<{ default: T }>(() => {});
        }
      }

      console.error('[lazyConReintento] Error al importar módulo dinámico:', error);
      throw error;
    }
  });
}
