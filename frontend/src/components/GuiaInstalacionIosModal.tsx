import React, { useEffect } from 'react';
import { Smartphone, Share, PlusSquare, CheckCircle, X, Sparkles } from 'lucide-react';
import { gestorNavegacion } from '../utils/navegacionDispositivo';

interface GuiaInstalacionIosModalProps {
  abierto: boolean;
  alCerrar: () => void;
}

export const GuiaInstalacionIosModal: React.FC<GuiaInstalacionIosModalProps> = ({
  abierto,
  alCerrar,
}) => {
  useEffect(() => {
    if (abierto) {
      const limpiar = gestorNavegacion.empujarPaso('modal-guia-ios', alCerrar);
      return limpiar;
    }
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-amber-400">
                Instalar en iPhone o iPad
              </h3>
              <p className="text-xs text-stone-400">
                Pantalla completa sin barras de navegador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all active:scale-95 cursor-pointer"
            aria-label="Cerrar guía"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Pasos */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-stone-200 text-sm">
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-700/40 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-stone-300">
              Al agregar la app a tu pantalla de inicio en <strong className="text-amber-400">Safari</strong>, funcionará como una aplicación nativa: sin barra de navegación, a toda la pantalla y con acceso instantáneo.
            </p>
          </div>

          <div className="space-y-3">
            {/* Paso 1 */}
            <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded-xl bg-stone-800 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-100 flex items-center gap-2">
                  <span>Toca el botón Compartir</span>
                  <Share className="w-4 h-4 text-sky-400" />
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  En Safari (iPhone en la barra inferior, iPad en la barra superior), pulsa el icono del cuadro con flecha hacia arriba.
                </p>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded-xl bg-stone-800 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-100 flex items-center gap-2">
                  <span>Selecciona "Añadir a pantalla de inicio"</span>
                  <PlusSquare className="w-4 h-4 text-emerald-400" />
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Desliza hacia abajo en el menú de opciones de compartir y pulsa la opción con el símbolo más (+).
                </p>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded-xl bg-stone-800 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-100 flex items-center gap-2">
                  <span>Pulsa "Añadir"</span>
                  <CheckCircle className="w-4 h-4 text-amber-400" />
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Confirma el nombre en la esquina superior derecha. El icono de LA ESTACIÓN GRILL aparecerá en tu pantalla principal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/80 flex justify-end">
          <button
            type="button"
            onClick={alCerrar}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
};
