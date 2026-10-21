import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ShieldCheck, Flame, Delete, AlertCircle, CheckCircle2, ShieldAlert, Timer } from 'lucide-react';
import { servicioSeguridadPin } from '../services/servicioSeguridadPin';

export const PantallaBloqueoPin: React.FC = () => {
  const [pin, setPin] = useState<string>('');
  const [errorMensaje, setErrorMensaje] = useState<string>('');
  const [sacudir, setSacudir] = useState<boolean>(false);
  const [exito, setExito] = useState<boolean>(false);
  const [validando, setValidando] = useState<boolean>(false);
  const [segundosBloqueo, setSegundosBloqueo] = useState<number>(() =>
    servicioSeguridadPin.obtenerSegundosRestantesBloqueo()
  );

  // Reloj de cuenta regresiva para el bloqueo temporal anti-fuerza bruta
  useEffect(() => {
    if (segundosBloqueo <= 0) return;

    const timer = setInterval(() => {
      setSegundosBloqueo((prev) => {
        if (prev <= 1) {
          setErrorMensaje('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [segundosBloqueo]);

  const estaBloqueadoPorTiempo = segundosBloqueo > 0;

  const procesarIntentoPin = useCallback(
    async (pinIngresado: string) => {
      if (estaBloqueadoPorTiempo || validando) return;

      setValidando(true);

      // Retardo deliberado de seguridad (350ms) para neutralizar ataques automatizados de bots
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (servicioSeguridadPin.validarPin(pinIngresado)) {
        setExito(true);
        setErrorMensaje('');
        setTimeout(() => {
          servicioSeguridadPin.desbloquear();
        }, 300);
      } else {
        const resultadoFallo = servicioSeguridadPin.registrarIntentoFallido();
        setSacudir(true);
        setErrorMensaje(resultadoFallo.mensaje);
        setPin('');

        if (resultadoFallo.bloqueado) {
          setSegundosBloqueo(resultadoFallo.segundosBloqueo);
        }

        setTimeout(() => {
          setSacudir(false);
          setValidando(false);
        }, 400);
      }
    },
    [estaBloqueadoPorTiempo, validando]
  );

  const manejarPulsarDigito = useCallback(
    (digito: string) => {
      if (exito || validando || estaBloqueadoPorTiempo) return;
      setErrorMensaje('');

      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const nuevoPin = prev + digito;
        if (nuevoPin.length === 6) {
          // Disparar validación al sexto dígito
          setTimeout(() => procesarIntentoPin(nuevoPin), 50);
        }
        return nuevoPin;
      });
    },
    [exito, validando, estaBloqueadoPorTiempo, procesarIntentoPin]
  );

  const manejarBorrar = useCallback(() => {
    if (exito || validando || estaBloqueadoPorTiempo) return;
    setErrorMensaje('');
    setPin((prev) => prev.slice(0, -1));
  }, [exito, validando, estaBloqueadoPorTiempo]);

  const manejarLimpiar = useCallback(() => {
    if (exito || validando || estaBloqueadoPorTiempo) return;
    setErrorMensaje('');
    setPin('');
  }, [exito, validando, estaBloqueadoPorTiempo]);

  // Soporte para teclado físico (PC / Laptop)
  useEffect(() => {
    const manejarKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        manejarPulsarDigito(e.key);
      } else if (e.key === 'Backspace') {
        manejarBorrar();
      } else if (e.key === 'Escape') {
        manejarLimpiar();
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    return () => window.removeEventListener('keydown', manejarKeyDown);
  }, [manejarPulsarDigito, manejarBorrar, manejarLimpiar]);

  const formatearTiempoBloqueo = (segundos: number): string => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    if (min > 0) {
      return `${min}m ${seg < 10 ? '0' : ''}${seg}s`;
    }
    return `${seg}s`;
  };

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-4 bg-[#0d0c0a] text-stone-100 select-none overflow-y-auto">
      {/* Fondo ambiental sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center animate-in fade-in duration-300">
        {/* Emblema / Identidad */}
        <div
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl border flex items-center justify-center mb-4 shadow-xl transition-colors duration-300 ${
            exito
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-950/40'
              : estaBloqueadoPorTiempo
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-rose-950/50'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-amber-950/40'
          }`}
        >
          {exito ? (
            <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-400 animate-in zoom-in-75 duration-200" />
          ) : estaBloqueadoPorTiempo ? (
            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400 animate-pulse" />
          ) : (
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span>La Estación Grill</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1">
          {estaBloqueadoPorTiempo ? 'Terminal en Pausa de Seguridad' : 'Terminal Autorizada'}
        </h1>
        <p className="text-xs sm:text-sm text-stone-400 mb-5 max-w-xs">
          {estaBloqueadoPorTiempo
            ? 'Protección anti-fuerza bruta activada por múltiples intentos erróneos.'
            : 'Ingresa el código PIN de 6 dígitos para operar el sistema.'}
        </p>

        {/* Indicadores de los 6 dígitos o Contador de Bloqueo */}
        {estaBloqueadoPorTiempo ? (
          <div className="flex flex-col items-center justify-center p-3.5 mb-5 rounded-2xl bg-rose-950/30 border border-rose-900/60 w-full animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-400 font-mono font-black text-xl mb-1">
              <Timer className="w-5 h-5 animate-spin" />
              <span>{formatearTiempoBloqueo(segundosBloqueo)}</span>
            </div>
            <span className="text-[11px] text-rose-300/80">
              Espera a que el temporizador finalice para reintentar
            </span>
          </div>
        ) : (
          <div
            className={`flex items-center justify-center gap-3 sm:gap-3.5 mb-5 transition-transform duration-200 ${
              sacudir ? 'translate-x-[-10px] animate-bounce' : ''
            }`}
          >
            {[0, 1, 2, 3, 4, 5].map((indice) => {
              const tieneValor = pin.length > indice;
              return (
                <div
                  key={indice}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 transition-all duration-200 ${
                    exito
                      ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                      : tieneValor
                      ? 'bg-amber-400 border-amber-400 scale-110 shadow-lg shadow-amber-500/50'
                      : 'border-stone-700 bg-stone-900/60'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Mensaje de Error / Estado */}
        {errorMensaje && !estaBloqueadoPorTiempo ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-medium mb-4 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMensaje}</span>
          </div>
        ) : (
          <div className="h-7 mb-4" />
        )}

        {/* Teclado Numérico Ergonómico Táctil */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[290px] mb-5">
          {[
            '1', '2', '3',
            '4', '5', '6',
            '7', '8', '9',
          ].map((numero) => (
            <button
              key={numero}
              type="button"
              onClick={() => manejarPulsarDigito(numero)}
              disabled={exito || validando || estaBloqueadoPorTiempo}
              className="h-16 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 hover:bg-stone-800 active:bg-amber-500/20 active:border-amber-500/60 text-2xl font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              {numero}
            </button>
          ))}

          {/* Botón Limpiar C */}
          <button
            type="button"
            onClick={manejarLimpiar}
            disabled={exito || validando || estaBloqueadoPorTiempo || pin.length === 0}
            className="h-16 rounded-2xl bg-stone-950/80 border border-stone-800 hover:bg-stone-900 active:scale-95 text-xs font-bold text-stone-400 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            LIMPIAR
          </button>

          {/* Botón 0 */}
          <button
            type="button"
            onClick={() => manejarPulsarDigito('0')}
            disabled={exito || validando || estaBloqueadoPorTiempo}
            className="h-16 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 hover:bg-stone-800 active:bg-amber-500/20 active:border-amber-500/60 text-2xl font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            0
          </button>

          {/* Botón Borrar ⌫ */}
          <button
            type="button"
            onClick={manejarBorrar}
            disabled={exito || validando || estaBloqueadoPorTiempo || pin.length === 0}
            className="h-16 rounded-2xl bg-stone-950/80 border border-stone-800 hover:bg-stone-900 active:scale-95 flex items-center justify-center text-stone-300 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Borrar último dígito"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Nota de seguridad discreta */}
        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-900 text-[11px] text-stone-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>Terminal protegida · Acceso exclusivo para personal autorizado</span>
        </div>
      </div>
    </div>
  );
};
