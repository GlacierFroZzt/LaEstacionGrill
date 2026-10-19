import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Flame,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Compass,
  ChefHat,
  Utensils,
  Receipt,
} from 'lucide-react';
import { PASOS_TUTORIAL } from '../services/datosTutorial';
import type { PasoTutorial } from '../types/tutorial';
import { gestorNavegacion } from '../utils/navegacionDispositivo';

interface PropsTourGuiadoFlotante {
  activo: boolean;
  alCerrar: () => void;
  onCambiarVista: (vista: 'mesas' | 'cocina') => void;
  vistaActual: 'mesas' | 'cocina';
}

export const TourGuiadoFlotante: React.FC<PropsTourGuiadoFlotante> = ({
  activo,
  alCerrar,
  onCambiarVista,
  vistaActual,
}) => {
  const [indicePaso, setIndicePaso] = useState<number>(0);
  const [vistaInicial, setVistaInicial] = useState<'mesas' | 'cocina'>('mesas');

  // Referencias para callbacks y estado previo para evitar reseteos indeseados
  const activoPrevioRef = useRef<boolean>(false);
  const alCerrarRef = useRef<() => void>(alCerrar);
  alCerrarRef.current = alCerrar;
  const onCambiarVistaRef = useRef<(vista: 'mesas' | 'cocina') => void>(onCambiarVista);
  onCambiarVistaRef.current = onCambiarVista;

  // Reiniciar solo cuando el tour pasa de inactivo a activo (apertura real)
  useEffect(() => {
    if (activo && !activoPrevioRef.current) {
      setVistaInicial(vistaActual);
      setIndicePaso(0);
    }
    activoPrevioRef.current = activo;
  }, [activo, vistaActual]);

  // Registro del botón atrás del dispositivo (Android / PWA)
  useEffect(() => {
    if (!activo) return;
    const limpiar = gestorNavegacion.empujarPaso('modal-tour', () => {
      alCerrarRef.current();
    });
    return limpiar;
  }, [activo]);

  const pasoActual: PasoTutorial = PASOS_TUTORIAL[indicePaso] || PASOS_TUTORIAL[0];
  const esUltimoPaso = indicePaso === PASOS_TUTORIAL.length - 1;
  const esPrimerPaso = indicePaso === 0;

  // Cambiar automáticamente de vista si el paso lo requiere
  const vistaRequerida = pasoActual.vistaRequerida;
  useEffect(() => {
    if (!activo) return;
    if (vistaRequerida && vistaRequerida !== vistaActual) {
      onCambiarVistaRef.current(vistaRequerida);
    }
  }, [activo, vistaRequerida, vistaActual]);

  const manejarFinalizar = useCallback(() => {
    if (vistaInicial !== vistaActual) {
      onCambiarVistaRef.current(vistaInicial);
    }
    alCerrarRef.current();
  }, [vistaInicial, vistaActual]);

  const manejarSiguiente = useCallback(() => {
    if (esUltimoPaso) {
      manejarFinalizar();
    } else {
      setIndicePaso((prev) => Math.min(prev + 1, PASOS_TUTORIAL.length - 1));
    }
  }, [esUltimoPaso, manejarFinalizar]);

  const manejarAnterior = useCallback(() => {
    setIndicePaso((prev) => Math.max(prev - 1, 0));
  }, []);

  // Navegación con teclado físico (Flechas y Escape)
  useEffect(() => {
    if (!activo) return;

    const manejarKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        manejarSiguiente();
      } else if (e.key === 'ArrowLeft') {
        manejarAnterior();
      } else if (e.key === 'Escape') {
        manejarFinalizar();
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    return () => window.removeEventListener('keydown', manejarKeyDown);
  }, [activo, manejarSiguiente, manejarAnterior, manejarFinalizar]);

  if (!activo) return null;

  const porcentajeProgreso = ((indicePaso + 1) / PASOS_TUTORIAL.length) * 100;

  // Icono dinámico según el rol del paso
  const renderIconoRol = () => {
    switch (pasoActual.rol) {
      case 'cocina':
        return <ChefHat className="w-6 h-6 text-amber-400" />;
      case 'mesero':
        return <Utensils className="w-6 h-6 text-amber-400" />;
      case 'caja':
        return <Receipt className="w-6 h-6 text-amber-400" />;
      default:
        return <Compass className="w-6 h-6 text-amber-400" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150"
    >
      {/* Contenedor Flotante Ultra Simple y Compacto */}
      <div className="relative w-full max-w-md bg-[#161412] border border-amber-500/40 rounded-3xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Barra superior delgada de progreso */}
        <div className="w-full h-1 bg-stone-900">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
            style={{ width: `${porcentajeProgreso}%` }}
          />
        </div>

        {/* Cabecera Limpia */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              {renderIconoRol()}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                Paso {indicePaso + 1} de {PASOS_TUTORIAL.length}
              </span>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                {pasoActual.titulo}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={manejarFinalizar}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors cursor-pointer"
            aria-label="Cerrar tutorial"
            title="Cerrar (Escape)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Ultra Concreto */}
        <div className="px-5 py-3 space-y-3.5 text-stone-200">
          <p className="text-sm text-stone-200 leading-snug">
            {pasoActual.descripcion}
          </p>

          {/* Viñetas Clave Concisas */}
          <div className="space-y-2 p-3 rounded-2xl bg-stone-950/70 border border-stone-850">
            {pasoActual.puntosClave.map((punto, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{punto}</span>
              </div>
            ))}
          </div>

          {/* Tip de Acción Rápida */}
          {pasoActual.accionSugerida && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/25 border border-amber-500/20 text-xs text-amber-200">
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                <strong>Tip:</strong> {pasoActual.accionSugerida}
              </span>
            </div>
          )}

          {/* Indicador de 4 puntos elegantes */}
          <div className="flex items-center justify-center gap-2 pt-1">
            {PASOS_TUTORIAL.map((_, idx) => {
              const esActivo = idx === indicePaso;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIndicePaso(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    esActivo
                      ? 'w-7 bg-amber-400 shadow-xs shadow-amber-400/50'
                      : 'w-2 bg-stone-700 hover:bg-stone-500'
                  }`}
                  aria-label={`Ir al paso ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* Pie con Botones Táctiles Grandes */}
        <div className="p-4 pt-3 border-t border-stone-800/80 bg-stone-950/60 flex items-center justify-between gap-2">
          {esPrimerPaso ? (
            <button
              type="button"
              onClick={manejarFinalizar}
              className="px-3 py-2 text-xs text-stone-400 hover:text-stone-200 font-semibold cursor-pointer transition-colors"
            >
              Omitir
            </button>
          ) : (
            <button
              type="button"
              onClick={manejarAnterior}
              className="px-3.5 py-2.5 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          )}

          <button
            type="button"
            onClick={manejarSiguiente}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 ${
              esUltimoPaso
                ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-950/50'
                : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-950/50'
            }`}
          >
            <span>{esUltimoPaso ? '¡Listo, a Vender!' : 'Siguiente'}</span>
            {esUltimoPaso ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
