import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowDownCircle, Sparkles, X, Smartphone, Globe } from 'lucide-react';
import { servicioActualizaciones, type ResultadoVerificacionOta, VERSION_LOCAL_POR_DEFECTO } from '../services/servicioActualizaciones';
import { BotonOroLiquido } from './BotonOroLiquido';

export interface PropsModalActualizacionOta {
  readonly abierto: boolean;
  readonly alCerrar: () => void;
}

export const ModalActualizacionOta: React.FC<PropsModalActualizacionOta> = ({
  abierto,
  alCerrar,
}) => {
  const [cargando, setCargando] = useState<boolean>(true);
  const [actualizando, setActualizando] = useState<boolean>(false);
  const [resultado, setResultado] = useState<ResultadoVerificacionOta | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const esNativo = servicioActualizaciones.esAndroidNativo();

  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;
    setCargando(true);
    setMensajeError(null);

    servicioActualizaciones
      .verificarActualizacion()
      .then((res) => {
        if (!cancelado) {
          setResultado(res);
          setCargando(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          console.error('[ModalActualizacionOta] Error:', err);
          setMensajeError('Ocurrió un inconveniente al comprobar nuevas versiones.');
          setCargando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [abierto]);

  if (!abierto) return null;

  const handleEjecutarActualizacion = async (): Promise<void> => {
    setActualizando(true);
    setMensajeError(null);
    try {
      if (resultado?.hayActualizacion) {
        await servicioActualizaciones.aplicarActualizacion();
      } else {
        // Si no hay actualización detectada por semver, re-verificar de inmediato
        const nuevoRes = await servicioActualizaciones.verificarActualizacion();
        setResultado(nuevoRes);
        if (nuevoRes.hayActualizacion) {
          await servicioActualizaciones.aplicarActualizacion();
        } else {
          setActualizando(false);
        }
      }
    } catch (err: unknown) {
      console.error('[ModalActualizacionOta] Error aplicando actualización:', err);
      setMensajeError('No se pudo aplicar la actualización automáticamente.');
      setActualizando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden text-stone-100 flex flex-col">
        {/* Cabecera Metálica */}
        <div className="p-5 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RefreshCw className={`w-5 h-5 ${cargando || actualizando ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wider text-amber-400 flex items-center gap-2">
                Actualizaciones del Sistema
                <Sparkles className="w-4 h-4 text-amber-300" />
              </h3>
              <p className="text-xs text-stone-400">Mantén tu punto de venta al día con las últimas mejoras</p>
            </div>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            disabled={actualizando}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-all active:scale-90 cursor-pointer disabled:opacity-40"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Diálogo */}
        <div className="p-6 space-y-5">
          {/* Tarjeta de Plataforma y Estado Actual */}
          <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-400">
              <span className="flex items-center gap-1.5">
                {esNativo ? (
                  <>
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    Aplicación Móvil
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 text-cyan-400" />
                    Acceso Web
                  </>
                )}
              </span>
              <span className="text-amber-400 font-mono">v{resultado?.versionActual || VERSION_LOCAL_POR_DEFECTO.version}</span>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              El sistema mantiene la aplicación optimizada automáticamente con las mejoras más recientes
              en el control de mesas, comandas y velocidad del servicio.
            </p>
          </div>

          {/* Estado de la Consulta */}
          {cargando ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-12 h-12 rounded-full border-3 border-amber-500/20 border-t-amber-500 animate-spin" />
              <p className="text-sm font-bold text-stone-300">Comprobando disponibilidad de mejoras...</p>
            </div>
          ) : actualizando ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-12 h-12 rounded-full border-3 border-amber-500/20 border-t-amber-400 animate-spin" />
              <p className="text-sm font-extrabold text-amber-300">Aplicando mejoras en el sistema...</p>
              <p className="text-xs text-stone-400">La aplicación se reiniciará en un momento.</p>
            </div>
          ) : resultado?.hayActualizacion ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-left">
              <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                <ArrowDownCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>¡Nuevas mejoras disponibles para el sistema!</span>
              </div>
              {resultado.notas && (
                <p className="text-xs text-stone-300 bg-stone-900/80 p-3 rounded-xl border border-stone-800 leading-relaxed">
                  {resultado.notas}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-emerald-300">Sistema al día</p>
                <p className="text-xs text-stone-400">
                  Cuentas con la versión más reciente. Tu equipo está listo para el servicio.
                </p>
              </div>
            </div>
          )}

          {mensajeError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{mensajeError}</span>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="p-5 border-t border-stone-800 bg-stone-950/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={alCerrar}
            disabled={actualizando}
            className="px-4 py-2.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Cerrar
          </button>

          <BotonOroLiquido
            onClick={handleEjecutarActualizacion}
            disabled={cargando || actualizando}
            className="px-5 py-2.5 rounded-xl text-xs font-black shadow-lg"
          >
            {actualizando ? (
              'Actualizando...'
            ) : resultado?.hayActualizacion ? (
              'Actualizar Ahora'
            ) : (
              'Comprobar Actualizaciones'
            )}
          </BotonOroLiquido>
        </div>
      </div>
    </div>
  );
};
