import React, { useState, useEffect } from 'react';
import { Lock, RefreshCw, AlertTriangle, PhoneCall, WifiOff, ShieldAlert } from 'lucide-react';
import { type EstadoLicencia, servicioLicencia } from '../services/servicioLicencia';

interface PropsPantallaBloqueoLicencia {
  estado: EstadoLicencia;
}

export const PantallaBloqueoLicencia: React.FC<PropsPantallaBloqueoLicencia> = ({ estado }) => {
  const [comprobando, setComprobando] = useState<boolean>(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);
  const [estaEnLinea, setEstaEnLinea] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = (): void => setEstaEnLinea(true);
    const handleOffline = (): void => setEstaEnLinea(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Evitar que la tecla Escape o atajos intenten cerrar la vista
    const prevenirTeclas = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', prevenirTeclas, true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', prevenirTeclas, true);
    };
  }, []);

  const manejarReverificacion = async (): Promise<void> => {
    setComprobando(true);
    setMensajeEstado(null);

    try {
      const nuevoEstado = await servicioLicencia.verificarEstadoServidor();
      if (nuevoEstado.activa) {
        setMensajeEstado('¡Pago confirmado! Reactivando sistema...');
      } else {
        setMensajeEstado('El servicio continúa suspendido. Si ya realizó su pago, confirme que su comprobante fue validado.');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al conectar';
      console.error('[PantallaBloqueoLicencia] Error al comprobar estado:', err);
      setMensajeEstado(`No se pudo verificar el estado: ${errorMsg}`);
    } finally {
      setComprobando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999999] bg-stone-950 flex items-center justify-center p-4 select-none overflow-y-auto"
      style={{ touchAction: 'none' }}
    >
      <div className="w-full max-w-lg bg-stone-900 border border-amber-600/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-stone-100 flex flex-col items-center text-center animate-fade-in relative">
        {/* Insignia de Seguridad */}
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-5 text-amber-500 shadow-inner">
          <Lock className="w-10 h-10 animate-pulse" />
        </div>

        {/* Encabezado */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-800 text-red-300 text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Acceso Restringido</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-amber-400 mb-2 tracking-tight">
          {estado.titulo || 'Servicio Temporalmente Suspendido'}
        </h2>

        <p className="text-sm text-stone-300 leading-relaxed mb-6 font-medium">
          {estado.mensaje ||
            'El acceso al sistema ha sido suspendido por falta de pago de la suscripción o licencia del servicio.'}
        </p>

        {/* Caja de Contacto y Regularización */}
        <div className="w-full bg-stone-950/80 border border-stone-800 rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1.5 uppercase tracking-wide">
            <PhoneCall className="w-4 h-4" />
            <span>Atención y Regularización de Cuenta:</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed font-mono break-words">
            {estado.contacto || 'Favor de comunicarse con el proveedor del software para reactivar el servicio.'}
          </p>
        </div>

        {/* Alerta si está sin conexión */}
        {!estaEnLinea && (
          <div className="w-full bg-amber-950/40 border border-amber-700/50 rounded-xl p-3 mb-5 flex items-center gap-2.5 text-xs text-amber-200 text-left">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Dispositivo sin conexión a internet. Para verificar la reactivación del servicio, conecte el dispositivo a la red.
            </span>
          </div>
        )}

        {/* Mensaje de retroalimentación de prueba */}
        {mensajeEstado && (
          <div
            className={`w-full p-3 rounded-xl mb-4 text-xs font-medium border flex items-start gap-2 text-left ${
              mensajeEstado.includes('confirmado')
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : 'bg-amber-950/60 border-amber-800 text-amber-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{mensajeEstado}</span>
          </div>
        )}

        {/* Botón de Comprobación */}
        <button
          onClick={manejarReverificacion}
          disabled={comprobando || !estaEnLinea}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${comprobando ? 'animate-spin' : ''}`} />
          <span>{comprobando ? 'Comprobando estado en la nube...' : '🔄 Comprobar Pago / Actualizar'}</span>
        </button>

        <p className="text-[11px] text-stone-500 mt-4">
          Una vez verificado su pago en el servidor, el acceso se restaurará de forma automática.
        </p>
      </div>
    </div>
  );
};
