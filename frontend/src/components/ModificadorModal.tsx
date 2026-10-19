import React, { useState } from 'react';
import { Plus, Minus, X, Check, UtensilsCrossed } from 'lucide-react';
import type { Producto } from '../types';
import { MODIFICADORES_POR_CATEGORIA } from '../data/menuInicial';
import { formatearMoneda } from '../utils/formateadores';
import { useRestaurante } from '../context/RestauranteContext';
import { BotonOroLiquido } from './BotonOroLiquido';

const ETIQUETAS_CATEGORIAS: Record<string, string> = {
  tacos: 'Tacos y Burritos',
  hamburguesas: 'Hamburguesas',
  papas: 'Papas Asadas y Francesas',
  antojos: 'Antojos y Complementos',
  bebidas: 'Bebidas',
  extras: 'Extras y Porciones',
};

interface ModificadorModalProps {
  producto: Producto;
  onCerrar: () => void;
  onConfirmar: (cantidad: number, notas: string, modificadores: string[]) => void;
}

export const ModificadorModal: React.FC<ModificadorModalProps> = ({
  producto,
  onCerrar,
  onConfirmar,
}) => {
  const { tema } = useRestaurante();
  const [cantidad, setCantidad] = useState<number>(1);
  const [modificadoresSeleccionados, setModificadoresSeleccionados] = useState<string[]>([]);
  const [notaPersonalizada, setNotaPersonalizada] = useState<string>('');

  const esClaro = tema === 'claro';

  // Obtener modificadores contextualmente según la categoría gastronómica del producto
  const modificadoresCategoria = MODIFICADORES_POR_CATEGORIA[producto.categoria] ?? [];
  const opcionesModificadores: string[] = Array.from(
    new Set([...(producto.modificadoresSugeridos ?? []), ...modificadoresCategoria])
  );

  const alternarModificador = (mod: string): void => {
    setModificadoresSeleccionados((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const incrementar = (): void => setCantidad((prev) => prev + 1);
  const decrementar = (): void => setCantidad((prev) => (prev > 1 ? prev - 1 : 1));

  const totalItem = producto.precio * cantidad;

  const handleConfirmar = (): void => {
    onConfirmar(cantidad, notaPersonalizada, modificadoresSeleccionados);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div
        className={`border rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden anim-entrada-modal sombra-dorada-intensa ${
          esClaro ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-amber-500/30 text-stone-100'
        }`}
      >
        {/* Cabecera del Platillo */}
        <div
          className={`p-4 md:p-5 border-b flex items-start justify-between ${
            esClaro ? 'bg-stone-100 border-stone-200' : 'bg-stone-950/80 border-stone-800'
          }`}
        >
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-500">
              Personalizar Orden
            </span>
            <h3
              className={`text-xl md:text-2xl font-black mt-0.5 ${
                esClaro ? 'text-amber-600' : 'text-amber-400'
              }`}
            >
              {producto.nombre}
            </h3>
            <p
              className={`text-xs md:text-sm mt-1 line-clamp-2 ${
                esClaro ? 'text-stone-500' : 'text-stone-400'
              }`}
            >
              {producto.descripcion}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className={`p-2 rounded-full transition-all active:scale-90 ${
              esClaro
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-700 hover:text-stone-950'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll táctil */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Selector de Cantidad */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'
            }`}
          >
            <span
              className={`font-bold text-sm ${
                esClaro ? 'text-stone-700' : 'text-stone-300'
              }`}
            >
              Cantidad de órdenes:
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={decrementar}
                disabled={cantidad <= 1}
                className={`w-11 h-11 rounded-xl disabled:opacity-30 flex items-center justify-center active:scale-95 transition-all ${
                  esClaro
                    ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-100'
                }`}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span
                className={`font-black text-2xl w-10 text-center ${
                  esClaro ? 'text-amber-600' : 'text-amber-400'
                }`}
              >
                {cantidad}
              </span>
              <button
                type="button"
                onClick={incrementar}
                className="w-11 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center active:scale-95 transition-all shadow-md shadow-amber-950/40"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Modificadores Rápidos Táctiles */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                esClaro ? 'text-stone-600' : 'text-stone-400'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              Modificadores para {ETIQUETAS_CATEGORIAS[producto.categoria] ?? 'Platillo'} (Toca para seleccionar)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {opcionesModificadores.map((opcion) => {
                const seleccionada = modificadoresSeleccionados.includes(opcion);
                return (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => alternarModificador(opcion)}
                    className={`p-3 rounded-xl text-xs md:text-sm font-semibold flex items-center justify-between text-left transition-all active:scale-95 border ${
                      seleccionada
                        ? esClaro
                          ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-xs'
                          : 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-xs'
                        : esClaro
                        ? 'bg-stone-50 border-stone-200 text-stone-800 hover:border-amber-400'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-amber-500/50'
                    }`}
                  >
                    <span>{opcion}</span>
                    {seleccionada && (
                      <Check
                        className={`w-4 h-4 shrink-0 ml-1 ${
                          esClaro ? 'text-amber-700' : 'text-amber-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas personalizadas libres */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
                esClaro ? 'text-stone-600' : 'text-stone-400'
              }`}
            >
              Instrucciones Especiales / Notas para Cocina
            </label>
            <input
              type="text"
              value={notaPersonalizada}
              onChange={(e) => setNotaPersonalizada(e.target.value)}
              placeholder="Ej. muy dorada, salsa de habanero aparte, limón extra..."
              className={`w-full rounded-xl px-4 py-3 text-sm md:text-base border transition-all focus:outline-hidden ${
                esClaro
                  ? 'bg-stone-50 border-stone-300 text-stone-900 placeholder-stone-400 focus:border-amber-500'
                  : 'bg-stone-950 border-stone-800 text-stone-100 placeholder-stone-600 focus:border-amber-500'
              }`}
            />
          </div>
        </div>

        {/* Pie con botón de confirmar */}
        <div
          className={`p-3.5 sm:p-5 border-t flex items-center justify-between gap-2.5 sm:gap-4 ${
            esClaro ? 'bg-stone-100 border-stone-200' : 'bg-stone-950 border-stone-800'
          }`}
        >
          <div className="shrink-0">
            <span
              className={`text-[11px] sm:text-xs block ${
                esClaro ? 'text-stone-500' : 'text-stone-400'
              }`}
            >
              Subtotal:
            </span>
            <span
              className={`text-lg sm:text-2xl font-black ${
                esClaro ? 'text-amber-600' : 'text-amber-400'
              }`}
            >
              {formatearMoneda(totalItem)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer ${
                esClaro
                  ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              Cancelar
            </button>
            <BotonOroLiquido
              onClick={handleConfirmar}
              className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm md:text-base shadow-lg flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] shrink-0" />
              <span className="whitespace-nowrap">Agregar a Comanda</span>
            </BotonOroLiquido>
          </div>
        </div>
      </div>
    </div>
  );
};
