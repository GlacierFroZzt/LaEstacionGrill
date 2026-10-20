import React, { useEffect } from 'react';
import { Eye, Edit3, Trash2, X, Image as ImageIcon } from 'lucide-react';
import type { Producto } from '../types';
import { formatearMoneda } from '../utils/formateadores';

interface ModalOpcionesProductoProps {
  readonly producto: Producto | null;
  readonly abierto: boolean;
  readonly onCerrar: () => void;
  readonly onVerImagen: (producto: Producto) => void;
  readonly onEditar: (producto: Producto) => void;
  readonly onEliminar: (producto: Producto) => void;
  readonly esClaro?: boolean;
}

export const ModalOpcionesProducto: React.FC<ModalOpcionesProductoProps> = ({
  producto,
  abierto,
  onCerrar,
  onVerImagen,
  onEditar,
  onEliminar,
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

  const tieneImagen = Boolean(producto.imagenUrl && producto.imagenUrl.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-opciones-producto"
    >
      <div
        className={`w-full max-w-sm rounded-3xl overflow-hidden border shadow-2xl transition-all ${
          esClaro
            ? 'bg-white border-stone-200 text-stone-900 shadow-amber-950/20'
            : 'bg-stone-900 border-amber-500/40 text-stone-100 shadow-black/90'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del Producto */}
        <div
          className={`p-4 border-b flex items-center justify-between gap-3 ${
            esClaro ? 'border-stone-100 bg-amber-50/50' : 'border-stone-800 bg-stone-950/40'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {tieneImagen ? (
              <img
                src={producto.imagenUrl}
                alt={producto.nombre}
                className="w-12 h-12 rounded-xl object-cover border border-amber-500/40 shrink-0"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  esClaro
                    ? 'bg-stone-100 border-stone-200 text-stone-400'
                    : 'bg-stone-800 border-stone-700 text-stone-500'
                }`}
              >
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 block truncate">
                {producto.categoria}
              </span>
              <h3
                id="titulo-opciones-producto"
                className="font-black text-base truncate leading-tight"
              >
                {producto.nombre}
              </h3>
              <p
                className={`text-xs font-bold ${
                  esClaro ? 'text-amber-800' : 'text-amber-400'
                }`}
              >
                {formatearMoneda(producto.precio)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className={`p-2 rounded-full transition-colors ${
              esClaro
                ? 'hover:bg-stone-200 text-stone-500'
                : 'hover:bg-stone-800 text-stone-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Acciones */}
        <div className="p-3 space-y-2">
          {/* Opción 1: Ver Imagen Ampliada */}
          <button
            type="button"
            onClick={() => {
              onCerrar();
              onVerImagen(producto);
            }}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-left transition-all active:scale-98 ${
              tieneImagen
                ? esClaro
                  ? 'hover:bg-amber-50 text-stone-800 hover:text-amber-700'
                  : 'hover:bg-stone-800 text-stone-200 hover:text-amber-400'
                : esClaro
                ? 'hover:bg-stone-100 text-stone-600'
                : 'hover:bg-stone-800 text-stone-400'
            }`}
          >
            <div
              className={`p-2.5 rounded-xl ${
                tieneImagen
                  ? 'bg-amber-500/20 text-amber-500'
                  : esClaro
                  ? 'bg-stone-100 text-stone-400'
                  : 'bg-stone-800 text-stone-500'
              }`}
            >
              <Eye className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>Ver imagen</span>
                {!tieneImagen && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-700/40 text-stone-400">
                    Sin foto
                  </span>
                )}
              </div>
              <p className="text-xs font-normal opacity-70">
                {tieneImagen
                  ? 'Previsualizar fotografía en tamaño completo'
                  : 'Este producto aún no tiene fotografía cargada'}
              </p>
            </div>
          </button>

          {/* Opción 2: Editar Producto */}
          <button
            type="button"
            onClick={() => {
              onCerrar();
              onEditar(producto);
            }}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-left transition-all active:scale-98 ${
              esClaro
                ? 'hover:bg-amber-50 text-stone-800 hover:text-amber-700'
                : 'hover:bg-stone-800 text-stone-200 hover:text-amber-400'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span>Editar producto e imagen</span>
              <p className="text-xs font-normal opacity-70">
                Modificar nombre, precio, categoría o cambiar foto
              </p>
            </div>
          </button>

          {/* Opción 3: Eliminar Producto */}
          <button
            type="button"
            onClick={() => {
              onCerrar();
              onEliminar(producto);
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-left text-red-500 hover:bg-red-500/15 transition-all active:scale-98"
          >
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span>Eliminar del menú</span>
              <p className="text-xs font-normal opacity-70">
                Retirar permanentemente este platillo del catálogo
              </p>
            </div>
          </button>
        </div>

        {/* Botón Cancelar */}
        <div
          className={`p-3 border-t ${
            esClaro ? 'border-stone-100 bg-stone-50' : 'border-stone-800 bg-stone-950/30'
          }`}
        >
          <button
            type="button"
            onClick={onCerrar}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
              esClaro
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
