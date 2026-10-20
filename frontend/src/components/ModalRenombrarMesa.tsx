import React, { useState, useEffect, useRef } from 'react';
import { Pencil, X, Check, AlertCircle } from 'lucide-react';
import type { Mesa } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { BotonOroLiquido } from './BotonOroLiquido';
import { gestorNavegacion } from '../utils/navegacionDispositivo';

interface ModalRenombrarMesaProps {
  readonly mesa: Mesa | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onExito?: (nuevoNombre: string) => void;
}

export const ModalRenombrarMesa: React.FC<ModalRenombrarMesaProps> = ({
  mesa,
  isOpen,
  onClose,
  onExito,
}) => {
  const { cambiarNombreMesa, tema } = useRestaurante();
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const esClaro = tema === 'claro';

  useEffect(() => {
    if (isOpen && mesa) {
      setNuevoNombre(mesa.nombre);
      setErrorValidacion(null);
      // Auto-enfoque al abrir
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [isOpen, mesa]);

  // Manejador del botón atrás en móviles
  useEffect(() => {
    if (isOpen) {
      return gestorNavegacion.empujarPaso('modal-renombrar-mesa', onClose);
    }
  }, [isOpen, onClose]);

  // Soporte de atajos de teclado
  useEffect(() => {
    if (!isOpen) return;

    const manejarKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    return () => window.removeEventListener('keydown', manejarKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mesa) {
    return null;
  }

  const handleGuardar = (e?: React.FormEvent): void => {
    if (e) e.preventDefault();
    setErrorValidacion(null);

    const nombreLimpio = nuevoNombre.trim();
    if (!nombreLimpio) {
      setErrorValidacion('El nombre de la mesa no puede estar vacío.');
      return;
    }

    const resultado = cambiarNombreMesa(mesa.id, nombreLimpio);
    if (!resultado.exito) {
      setErrorValidacion(resultado.mensaje);
      return;
    }

    if (onExito) {
      onExito(nombreLimpio);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 sm:p-6 transition-all ${
          esClaro
            ? 'bg-white border-stone-200 text-stone-900 shadow-stone-900/20'
            : 'bg-stone-900 border-stone-800 text-stone-100 shadow-stone-950/80'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-700/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">Cambiar Nombre de Mesa</h3>
              <p className="text-xs text-stone-400">
                Identificador actual: <span className="font-bold text-amber-400">{mesa.nombre}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="input-nombre-mesa"
              className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                esClaro ? 'text-stone-700' : 'text-stone-300'
              }`}
            >
              Nuevo Nombre o Etiqueta
            </label>
            <input
              id="input-nombre-mesa"
              ref={inputRef}
              type="text"
              value={nuevoNombre}
              onChange={(e) => {
                setNuevoNombre(e.target.value);
                if (errorValidacion) setErrorValidacion(null);
              }}
              placeholder="Ej. Mesa 4, Terraza VIP, Juan..."
              maxLength={40}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold focus:outline-hidden transition-all ${
                esClaro
                  ? 'bg-stone-50 border-stone-300 focus:border-amber-500 text-stone-900'
                  : 'bg-stone-950 border-stone-700 focus:border-amber-500 text-stone-100'
              }`}
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Este nombre se mostrará en las comandas, tickets y en la pantalla de cocina.
            </p>
          </div>

          {errorValidacion && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-xs font-semibold text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorValidacion}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-700/30">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                esClaro
                  ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              Cancelar
            </button>
            <BotonOroLiquido
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-lg"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Guardar Nombre</span>
            </BotonOroLiquido>
          </div>
        </form>
      </div>
    </div>
  );
};
