import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { servicioTelemetria } from '../services/servicioTelemetria';

export interface PropsErrorBoundary {
  children: ReactNode;
}

export interface EstadoErrorBoundary {
  tieneError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<PropsErrorBoundary, EstadoErrorBoundary> {
  public override state: EstadoErrorBoundary = {
    tieneError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): EstadoErrorBoundary {
    return { tieneError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary Global] Excepción no controlada en interfaz:', error, errorInfo);
    
    const mensaje = error.message || String(error);
    const esErrorChunk =
      mensaje.includes('Failed to fetch dynamically imported module') ||
      mensaje.includes('Importing a module script failed') ||
      mensaje.includes('error loading dynamically imported module');

    if (esErrorChunk) {
      const yaSeRecargo = sessionStorage.getItem('taqueria_recarga_error_boundary_v1');
      if (!yaSeRecargo) {
        sessionStorage.setItem('taqueria_recarga_error_boundary_v1', 'true');
        servicioTelemetria.registrarAdvertencia(
          'Desincronización de paquetes tras despliegue detectada. Recargando versión fresca...',
          { error: mensaje, origen: 'ErrorBoundary' }
        );
        window.location.reload();
        return;
      }
    }

    // Transmitir crash en segundo plano hacia Supabase y almacenamiento local
    servicioTelemetria.registrarCrash(error, {
      componentStack: errorInfo.componentStack,
      origenError: 'React ErrorBoundary',
    });
  }

  private handleReintentar = (): void => {
    this.setState({ tieneError: false, error: null });
    window.location.reload();
  };

  private handleRecargarApp = (): void => {
    try {
      sessionStorage.clear();
      window.location.reload();
    } catch (e: unknown) {
      console.error('[ErrorBoundary] Error al limpiar sesión temporal:', e);
      window.location.reload();
    }
  };

  public override render(): ReactNode {
    if (this.state.tieneError) {
      return (
        <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-stone-950 text-stone-100 p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-400 tracking-wide uppercase mb-2">
            La Estación Grill
          </h2>
          <p className="text-sm sm:text-base text-stone-300 max-w-md mb-2">
            Ocurrió un evento inesperado en la pantalla. Los datos de tus mesas y comandas están protegidos y respaldados.
          </p>
          {this.state.error && (
            <div className="text-[11px] font-mono text-stone-400 bg-stone-900/90 border border-stone-800 p-3 rounded-xl max-w-md w-full mb-6 text-left overflow-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={this.handleReintentar}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <button
              type="button"
              onClick={this.handleRecargarApp}
              className="py-3 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recargar app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
