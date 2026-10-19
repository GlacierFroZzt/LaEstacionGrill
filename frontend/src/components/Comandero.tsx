import React, { useState } from 'react';
import { Flame, Utensils, Coffee, PlusCircle, Search, Receipt, UtensilsCrossed, Sparkles } from 'lucide-react';
import type { CategoriaProducto, Producto } from '../types';
import { PRODUCTOS_INICIALES } from '../data/menuInicial';
import { ModificadorModal } from './ModificadorModal';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearMoneda } from '../utils/formateadores';
import { BotonOroLiquido } from './BotonOroLiquido';

interface ComanderoProps {
  onVerCuentaMovil?: () => void;
}

export const Comandero: React.FC<ComanderoProps> = ({ onVerCuentaMovil }) => {
  const { mesaSeleccionada, agregarProductoAComanda, tema, cuentaActiva, nivelOroLiquido } = useRestaurante();
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaProducto>('tacos');
  const [busqueda, setBusqueda] = useState<string>('');
  const [productoAEditar, setProductoAEditar] = useState<Producto | null>(null);

  const esClaro = tema === 'claro';

  if (!mesaSeleccionada) {
    return null;
  }

  // Filtrado de productos por categoría y término de búsqueda
  const productosFiltrados = PRODUCTOS_INICIALES.filter((p) => {
    const coincideCategoria = busqueda ? true : p.categoria === categoriaActiva;
    const coincideBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  const handleSeleccionarProducto = (prod: Producto): void => {
    setProductoAEditar(prod);
  };

  const handleConfirmarModificador = (
    cantidad: number,
    notas: string,
    modificadores: string[]
  ): void => {
    if (productoAEditar && mesaSeleccionada) {
      agregarProductoAComanda(
        mesaSeleccionada.id,
        productoAEditar,
        cantidad,
        notas,
        modificadores
      );
      setProductoAEditar(null);
    }
  };

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col overflow-hidden border-r transition-colors ${
        esClaro
          ? nivelOroLiquido !== 'apagado'
            ? 'bg-stone-50/75 backdrop-blur-[2px] text-stone-900 border-stone-200'
            : 'bg-stone-50 text-stone-900 border-stone-200'
          : nivelOroLiquido !== 'apagado'
          ? 'bg-stone-950/75 backdrop-blur-[2px] text-stone-100 border-stone-800'
          : 'bg-stone-950 text-stone-100 border-stone-800'
      }`}
    >
      {/* Barra de Búsqueda y Categorías */}
      <div
        className={`p-3 md:p-4 border-b space-y-3 ${
          esClaro
            ? 'bg-stone-100/90 border-stone-200'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        {/* Input de Búsqueda Rápida */}
        <div className="relative">
          <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar taco, hamburguesa, papa, alitas, bebida..."
            className={`w-full rounded-xl pl-11 pr-4 py-2.5 text-sm md:text-base border transition-all focus:outline-hidden ${
              esClaro
                ? 'bg-white border-stone-300 text-stone-900 placeholder-stone-400 focus:border-amber-500'
                : 'bg-stone-950 border-stone-700 text-stone-100 placeholder-stone-500 focus:border-amber-500'
            }`}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded font-medium ${
                esClaro
                  ? 'bg-stone-200 text-stone-700 hover:text-stone-900'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Pestañas de Categorías de LA ESTACIÓN GRILL (Desplazamiento horizontal fluido sin cortes) */}
        {!busqueda && (
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {categoriaActiva === 'tacos' ? (
              <BotonOroLiquido
                onClick={() => setCategoriaActiva('tacos')}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">1. Tacos</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setCategoriaActiva('tacos')}
                className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border shrink-0 cursor-pointer ${
                  esClaro
                    ? 'bg-white border-stone-300 text-stone-700 hover:text-stone-950'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">1. Tacos</span>
              </button>
            )}

            {categoriaActiva === 'hamburguesas' ? (
              <BotonOroLiquido
                onClick={() => setCategoriaActiva('hamburguesas')}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">2. Burgers</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setCategoriaActiva('hamburguesas')}
                className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border shrink-0 cursor-pointer ${
                  esClaro
                    ? 'bg-white border-stone-300 text-stone-700 hover:text-stone-950'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">2. Burgers</span>
              </button>
            )}

            {categoriaActiva === 'papas' ? (
              <BotonOroLiquido
                onClick={() => setCategoriaActiva('papas')}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">3. Papas</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setCategoriaActiva('papas')}
                className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border shrink-0 cursor-pointer ${
                  esClaro
                    ? 'bg-white border-stone-300 text-stone-700 hover:text-stone-950'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">3. Papas</span>
              </button>
            )}

            {categoriaActiva === 'antojos' ? (
              <BotonOroLiquido
                onClick={() => setCategoriaActiva('antojos')}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">4. Antojos</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setCategoriaActiva('antojos')}
                className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border shrink-0 cursor-pointer ${
                  esClaro
                    ? 'bg-white border-stone-300 text-stone-700 hover:text-stone-950'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">4. Antojos</span>
              </button>
            )}

            {categoriaActiva === 'bebidas' ? (
              <BotonOroLiquido
                onClick={() => setCategoriaActiva('bebidas')}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">5. Bebidas</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setCategoriaActiva('bebidas')}
                className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border shrink-0 cursor-pointer ${
                  esClaro
                    ? 'bg-white border-stone-300 text-stone-700 hover:text-stone-950'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">5. Bebidas</span>
              </button>
            )}

            {categoriaActiva === 'extras' ? (
              <BotonOroLiquido
                onClick={() => setCategoriaActiva('extras')}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">6. Extras</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setCategoriaActiva('extras')}
                className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border shrink-0 cursor-pointer ${
                  esClaro
                    ? 'bg-white border-stone-300 text-stone-700 hover:text-stone-950'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">6. Extras</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cuadrícula de Productos */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 pb-24">
        {productosFiltrados.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-stone-400">
            <Utensils className="w-12 h-12 mb-2 stroke-1 opacity-40" />
            <p className="text-sm">No se encontraron productos con ese criterio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
            {productosFiltrados.map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => handleSeleccionarProducto(prod)}
                className={`tarjeta-tactil-suave group text-left p-3.5 md:p-4 rounded-2xl flex flex-col justify-between transition-all duration-150 active:scale-95 border min-h-[125px] ${
                  esClaro
                    ? 'bg-white hover:bg-amber-50/40 border-stone-200 hover:border-amber-400 hover:shadow-md hover:sombra-dorada'
                    : 'bg-stone-900/90 hover:bg-stone-850 border-stone-800 hover:border-amber-500/80 hover:shadow-md hover:sombra-dorada'
                }`}
              >
                <div>
                  <h4
                    className={`font-extrabold text-sm md:text-base leading-snug transition-colors ${
                      esClaro
                        ? 'text-stone-900 group-hover:text-amber-600'
                        : 'text-stone-100 group-hover:text-amber-400'
                    }`}
                  >
                    {prod.nombre}
                  </h4>
                  <p
                    className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                      esClaro ? 'text-stone-500' : 'text-stone-400'
                    }`}
                  >
                    {prod.descripcion}
                  </p>
                </div>

                <div
                  className={`flex items-center justify-between mt-3 pt-2 border-t ${
                    esClaro ? 'border-stone-100' : 'border-stone-800/80'
                  }`}
                >
                  <span
                    className={`font-black text-base md:text-lg ${
                      esClaro ? 'text-amber-700' : 'text-amber-400'
                    }`}
                  >
                    {formatearMoneda(prod.precio)}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all ${
                      esClaro
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 group-hover:bg-amber-500 group-hover:text-stone-950 font-black'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-700/60 group-hover:bg-amber-500 group-hover:text-stone-950 font-black'
                    }`}
                  >
                    + Ordenar
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante para celular y tablet vertical si hay platillos seleccionados */}
      {cuentaActiva && cuentaActiva.items.length > 0 && onVerCuentaMovil && (
        <div
          style={{
            bottom: 'calc(3.75rem + var(--safe-bottom))',
          }}
          className="lg:hidden fixed left-3 right-3 z-30"
        >
          <button
            type="button"
            onClick={onVerCuentaMovil}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-2xl flex items-center justify-between active:scale-98 transition-all"
          >
            <span className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <span>
                Ver Cuenta ({cuentaActiva.items.reduce((s, it) => s + it.cantidad, 0)} platillos)
              </span>
            </span>
            <span>{formatearMoneda(cuentaActiva.total)} ➔</span>
          </button>
        </div>
      )}

      {/* Modal de Modificadores */}
      {productoAEditar && (
        <ModificadorModal
          producto={productoAEditar}
          onCerrar={() => setProductoAEditar(null)}
          onConfirmar={handleConfirmarModificador}
        />
      )}
    </div>
  );
};
