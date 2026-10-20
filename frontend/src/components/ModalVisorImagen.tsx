import React, { useEffect } from 'react';
import { X, Edit3, ImageOff } from 'lucide-react';
import type { Producto } from '../types';
import { formatearMoneda } from '../utils/formateadores';

interface ModalVisorImagenProps {
  readonly producto: Producto | null;
  readonly abierto: boolean;
  readonly onCerrar: () => void;
  readonly onEditar?: (producto: Producto) => void;
  readonly esClaro?: boolean;
}

export const ModalVisorImagen: React.FC<ModalVisorImagenProps> = ({
  producto,
  abierto,
  onCerrar,
  onEditar,
  esClaro = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && abierto) {
        onCerrar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, onCerrar]);

  if (!abierto || !producto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-visor-imagen"
    >
      <div
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden border shadow-2xl transition-all ${
          esClaro
            ? 'bg-white border-stone-200 text-stone-900 shadow-amber-900/20'
            : 'bg-stone-900 border-amber-500/40 text-stone-100 shadow-black/80'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con Botón de Cierre */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {onEditar && (
            <button
              type="button"
              onClick={() => {
                onCerrar();
                onEditar(producto);
              }}
              className="p-2.5 rounded-full bg-stone-950/70 hover:bg-amber-600 text-white backdrop-blur-md transition-colors shadow-lg active:scale-95"
              title="Editar este producto"
            >
              <Edit3 className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            className="p-2.5 rounded-full bg-stone-950/70 hover:bg-red-600 text-white backdrop-blur-md transition-colors shadow-lg active:scale-95"
            title="Cerrar visor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenedor de la Imagen */}
        <div className="relative w-full bg-stone-950 flex items-center justify-center min-h-[240px] max-h-[55vh] overflow-hidden">
          {producto.imagenUrl ? (
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="w-full h-full object-contain max-h-[55vh] transition-transform duration-300 select-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-stone-500">
              <ImageOff className="w-16 h-16 mb-2 stroke-1 opacity-50" />
              <p className="text-sm font-medium">Este producto aún no cuenta con una fotografía.</p>
            </div>
          )}
        </div>

        {/* Ficha de Detalles del Platillo */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/30">
                {producto.categoria}
              </span>
              <h3
                id="titulo-visor-imagen"
                className={`text-xl font-black mt-1.5 leading-snug ${
                  esClaro ? 'text-stone-900' : 'text-stone-100'
                }`}
              >
                {producto.nombre}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`text-2xl font-black ${
                  esClaro ? 'text-amber-700' : 'text-amber-400'
                }`}
              >
                {formatearMoneda(producto.precio)}
              </span>
            </div>
          </div>

          {producto.descripcion && (
            <p
              className={`text-sm mt-2.5 leading-relaxed ${
                esClaro ? 'text-stone-600' : 'text-stone-300'
              }`}
            >
              {producto.descripcion}
            </p>
          )}

          {producto.modificadoresSugeridos && producto.modificadoresSugeridos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-stone-800/60">
              <span className="text-xs font-bold text-stone-400 block mb-1.5">
                Modificadores disponibles:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {producto.modificadoresSugeridos.map((mod, idx) => (
                  <span
                    key={`${mod}-${idx}`}
                    className={`text-[11px] px-2 py-0.5 rounded-lg border ${
                      esClaro
                        ? 'bg-stone-100 border-stone-200 text-stone-700'
                        : 'bg-stone-800/80 border-stone-700 text-stone-300'
                    }`}
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onCerrar}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                esClaro
                  ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
              }`}
            >
              Cerrar
            </button>
            {onEditar && (
              <button
                type="button"
                onClick={() => {
                  onCerrar();
                  onEditar(producto);
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 font-black"
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar Platillo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
