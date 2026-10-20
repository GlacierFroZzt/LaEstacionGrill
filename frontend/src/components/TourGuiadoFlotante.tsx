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
  Minimize2,
  Maximize2,
  Sparkles,
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
  const [minimizado, setMinimizado] = useState<boolean>(false);

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
      setMinimizado(false);
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
        return <ChefHat className="w-5 h-5 text-amber-400" />;
      case 'mesero':
        return <Utensils className="w-5 h-5 text-amber-400" />;
      case 'caja':
        return <Receipt className="w-5 h-5 text-amber-400" />;
      default:
        return <Compass className="w-5 h-5 text-amber-400" />;
    }
  };

  // VISTA MINIMIZADA (Pastilla flotante interactiva para no obstruir absolutamente nada)
  if (minimizado) {
    return (
      <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-[99999] animate-in fade-in slide-in-from-bottom-3 duration-200">
        <button
          type="button"
          onClick={() => setMinimizado(false)}
          className="px-4 py-2.5 rounded-2xl bg-stone-900 border-2 border-amber-500/80 text-stone-100 font-black text-xs shadow-2xl flex items-center gap-2.5 hover:bg-stone-850 active:scale-95 transition-all cursor-pointer group"
          title="Toca para expandir el tutorial"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <div className="text-left">
            <span className="text-[10px] text-amber-400 block font-bold uppercase tracking-wider">
              Guía Activa ({indicePaso + 1}/{PASOS_TUTORIAL.length})
            </span>
            <span className="text-xs truncate max-w-[180px] block">{pasoActual.titulo}</span>
          </div>
          <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-stone-950 transition-colors ml-1">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Tutorial guiado interactivo"
      className="fixed inset-0 z-[99999] pointer-events-none select-none flex flex-col justify-end p-2.5 sm:p-4"
    >
      {/* Indicador Luminoso Superior de Modo Guía Activo */}
      <div className="pointer-events-auto mx-auto mb-2 px-3 py-1 rounded-full bg-stone-950/90 border border-amber-500/50 text-amber-300 text-[11px] font-black flex items-center gap-1.5 shadow-lg backdrop-blur-md">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        <span>Modo Guía: La pantalla es interactiva y visual en tiempo real</span>
      </div>

      {/* Dock Flotante Inferior Ergonómico (No tapa el centro ni desenfoca el fondo) */}
      <div className="pointer-events-auto relative mx-auto w-full max-w-xl bg-stone-900/95 border border-amber-500/60 rounded-3xl shadow-2xl shadow-black flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        {/* Barra superior delgada de progreso de oro líquido */}
        <div className="w-full h-1.5 bg-stone-950">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-200 transition-all duration-300 shadow-sm shadow-amber-400"
            style={{ width: `${porcentajeProgreso}%` }}
          />
        </div>

        {/* Cabecera del Dock */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              {renderIconoRol()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                  Paso {indicePaso + 1} de {PASOS_TUTORIAL.length}
                </span>
                <span className="text-[11px] text-stone-400 truncate hidden sm:inline">
                  {pasoActual.subtitulo}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate mt-0.5">
                {pasoActual.titulo}
              </h3>
            </div>
          </div>

          {/* Botones de Cabecera: Minimizar y Cerrar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMinimizado(true)}
              className="p-2 rounded-xl text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Minimizar tutorial para ver o tocar la pantalla libremente"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={manejarFinalizar}
              className="p-2 rounded-xl text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Cerrar tutorial (Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido Concreto y Visual */}
        <div className="px-4 sm:px-5 py-2.5 space-y-2 text-stone-200">
          <p className="text-xs sm:text-sm text-stone-200 leading-snug">
            {pasoActual.descripcion}
          </p>

          {/* Viñetas Clave */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            {pasoActual.puntosClave.map((punto, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[11px] sm:text-xs text-stone-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{punto}</span>
              </div>
            ))}
          </div>

          {/* Tip de Acción Rápida */}
          {pasoActual.accionSugerida && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                <strong>Acción recomendada:</strong> {pasoActual.accionSugerida}
              </span>
            </div>
          )}

          {/* Indicador de Puntos de Progreso */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {PASOS_TUTORIAL.map((_, idx) => {
              const esActivo = idx === indicePaso;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIndicePaso(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    esActivo
                      ? 'w-6 bg-amber-400 shadow-xs shadow-amber-400/50'
                      : 'w-1.5 bg-stone-700 hover:bg-stone-500'
                  }`}
                  aria-label={`Ir al paso ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* Pie con Navegación Ergonómica */}
        <div className="p-3 sm:p-3.5 pt-2 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between gap-2">
          {esPrimerPaso ? (
            <button
              type="button"
              onClick={manejarFinalizar}
              className="px-3 py-2 text-xs text-stone-400 hover:text-stone-200 font-bold cursor-pointer transition-colors"
            >
              Omitir Guía
            </button>
          ) : (
            <button
              type="button"
              onClick={manejarAnterior}
              className="px-3 py-2 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMinimizado(true)}
              className="px-3 py-2 rounded-xl text-xs text-amber-400/90 hover:text-amber-300 font-bold flex items-center gap-1 hover:bg-stone-850 cursor-pointer transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Explorar Pantalla</span>
            </button>

            <button
              type="button"
              onClick={manejarSiguiente}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 ${
                esUltimoPaso
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-950/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-950/50'
              }`}
            >
              <span>{esUltimoPaso ? '¡Listo, a Vender!' : 'Siguiente Paso'}</span>
              {esUltimoPaso ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
