import React, { useState, useMemo, useEffect, memo } from 'react';
import {
  Flame,
  Utensils,
  Coffee,
  PlusCircle,
  Search,
  Receipt,
  UtensilsCrossed,
  Plus,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import type { CategoriaProducto, Producto, FormularioProductoDTO } from '../types';
import { ModificadorModal } from './ModificadorModal';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearMoneda } from '../utils/formateadores';
import { BotonOroLiquido } from './BotonOroLiquido';
import { usePulsacionProlongada } from '../hooks/usePulsacionProlongada';
import { ModalOpcionesProducto } from './ModalOpcionesProducto';
import { ModalFormularioProducto } from './ModalFormularioProducto';
import { ModalVisorImagen } from './ModalVisorImagen';

interface ComanderoProps {
  readonly onVerCuentaMovil?: () => void;
}

interface TarjetaProductoItemProps {
  readonly prod: Producto;
  readonly esClaro: boolean;
  readonly onSeleccionar: (prod: Producto) => void;
  readonly onAbrirOpciones: (prod: Producto) => void;
}

const TarjetaProductoItem = memo<TarjetaProductoItemProps>(({
  prod,
  esClaro,
  onSeleccionar,
  onAbrirOpciones,
}) => {
  const gestos = usePulsacionProlongada(() => onAbrirOpciones(prod), {
    tiempoMs: 500,
    umbralMovimientoPx: 10,
  });

  const tieneImagen = Boolean(prod.imagenUrl && prod.imagenUrl.trim().length > 0);

  return (
    <div
      role="button"
      tabIndex={0}
      onTouchStart={gestos.onTouchStart}
      onTouchMove={gestos.onTouchMove}
      onTouchEnd={gestos.onTouchEnd}
      onTouchCancel={gestos.onTouchCancel}
      onMouseDown={gestos.onMouseDown}
      onMouseUp={gestos.onMouseUp}
      onMouseLeave={gestos.onMouseLeave}
      onContextMenu={gestos.onContextMenu}
      onClick={(e) => gestos.handleClickSeguro(e, () => onSeleccionar(prod))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSeleccionar(prod);
        }
      }}
      title="Toca para ordenar. Mantén pulsado o da clic derecho para editar, eliminar o ver foto."
      className={`tarjeta-tactil-suave group text-left p-3 sm:p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-150 active:scale-95 border min-h-[130px] cursor-pointer select-none relative ${
        esClaro
          ? 'bg-white hover:bg-amber-50/40 border-stone-200 hover:border-amber-400 hover:shadow-md hover:sombra-dorada'
          : 'bg-stone-900/90 hover:bg-stone-850 border-stone-800 hover:border-amber-500/80 hover:shadow-md hover:sombra-dorada'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {tieneImagen && (
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-amber-500/30 bg-stone-950">
            <img
              src={prod.imagenUrl}
              alt={prod.nombre}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4
              className={`font-black text-sm md:text-base leading-snug truncate transition-colors ${
                esClaro
                  ? 'text-stone-900 group-hover:text-amber-600'
                  : 'text-stone-100 group-hover:text-amber-400'
              }`}
            >
              {prod.nombre}
            </h4>
          </div>
          <p
            className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
              esClaro ? 'text-stone-500' : 'text-stone-400'
            }`}
          >
            {prod.descripcion || 'Sin descripción detallada.'}
          </p>
        </div>
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

        <div className="flex items-center gap-1.5">
          {tieneImagen && (
            <span
              className="p-1 rounded-md text-amber-500/80 hover:text-amber-400 transition-colors"
              title="Este producto cuenta con fotografía"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </span>
          )}
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
      </div>
    </div>
  );
});

TarjetaProductoItem.displayName = 'TarjetaProductoItem';

export const Comandero: React.FC<ComanderoProps> = ({ onVerCuentaMovil }) => {
  const {
    mesaSeleccionada,
    agregarProductoAComanda,
    tema,
    cuentaActiva,
    nivelOroLiquido,
    productos,
    agregarProducto,
    editarProducto,
    eliminarProducto,
    pasoTutorialDemo,
  } = useRestaurante();

  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaProducto>('tacos');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modales de Comanda y Modificadores
  const [productoAComandar, setProductoAComandar] = useState<Producto | null>(null);

  // Estados de Gestión de Productos (CRUD e Imagen)
  const [productoSeleccionadoOpciones, setProductoSeleccionadoOpciones] = useState<Producto | null>(
    null
  );
  const [modalOpcionesAbierto, setModalOpcionesAbierto] = useState<boolean>(false);

  const [productoParaEditar, setProductoParaEditar] = useState<Producto | null>(null);
  const [modalFormularioAbierto, setModalFormularioAbierto] = useState<boolean>(false);

  const [productoParaVisor, setProductoParaVisor] = useState<Producto | null>(null);
  const [modalVisorAbierto, setModalVisorAbierto] = useState<boolean>(false);

  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState<boolean>(false);

  // Abrir automáticamente el menú contextual real de opciones del platillo en el Paso 3 del tutorial
  useEffect(() => {
    if (pasoTutorialDemo === 3 && productos.length > 0) {
      setProductoSeleccionadoOpciones(productos[0]);
      setModalOpcionesAbierto(true);
    } else if (pasoTutorialDemo !== 3) {
      setModalOpcionesAbierto(false);
    }
  }, [pasoTutorialDemo, productos]);

  const esClaro = tema === 'claro';

  // Filtrado de productos por categoría y término de búsqueda
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideCategoria = busqueda ? true : p.categoria === categoriaActiva;
      const coincideBusqueda =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(busqueda.toLowerCase());
      return coincideCategoria && coincideBusqueda;
    });
  }, [productos, busqueda, categoriaActiva]);

  if (!mesaSeleccionada) {
    return null;
  }

  // Manejador de selección para ordenar
  const handleSeleccionarParaOrdenar = (prod: Producto): void => {
    setProductoAComandar(prod);
  };

  const handleConfirmarModificador = (
    cantidad: number,
    notas: string,
    modificadores: string[]
  ): void => {
    if (productoAComandar && mesaSeleccionada) {
      agregarProductoAComanda(
        mesaSeleccionada.id,
        productoAComandar,
        cantidad,
        notas,
        modificadores
      );
      setProductoAComandar(null);
    }
  };

  // Manejadores de Opciones de Gestión (Pulsación Prolongada / Clic Derecho)
  const handleAbrirOpciones = (prod: Producto): void => {
    setProductoSeleccionadoOpciones(prod);
    setModalOpcionesAbierto(true);
  };

  const handleAbrirVisorImagen = (prod: Producto): void => {
    setProductoParaVisor(prod);
    setModalVisorAbierto(true);
  };

  const handleAbrirEditar = (prod: Producto): void => {
    setProductoParaEditar(prod);
    setModalFormularioAbierto(true);
  };

  const handleAbrirNuevo = (): void => {
    setProductoParaEditar(null);
    setModalFormularioAbierto(true);
  };

  const handleSolicitarEliminar = (prod: Producto): void => {
    setProductoAEliminar(prod);
    setModalEliminarAbierto(true);
  };

  const handleConfirmarEliminar = async (): Promise<void> => {
    if (productoAEliminar) {
      try {
        await eliminarProducto(productoAEliminar.id);
        setModalEliminarAbierto(false);
        setProductoAEliminar(null);
      } catch (err: unknown) {
        console.error('[Comandero.handleConfirmarEliminar] Error al eliminar:', err);
      }
    }
  };

  const handleGuardarProducto = async (datos: FormularioProductoDTO): Promise<void> => {
    if (productoParaEditar) {
      await editarProducto(productoParaEditar.id, datos);
    } else {
      await agregarProducto(datos);
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
      {/* Barra de Búsqueda, Acciones y Categorías */}
      <div
        className={`p-3 md:p-4 border-b space-y-3 ${
          esClaro ? 'bg-stone-100/90 border-stone-200' : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        {/* Fila Superior: Buscador y Botón Nuevo Platillo */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar taco, burger, papa, bebida..."
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

          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="py-2.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 shrink-0 transition-all cursor-pointer"
            title="Dar de alta un nuevo platillo o bebida en el menú"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Nuevo Platillo</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>

        {/* Pestañas de Categorías con Desplazamiento Horizontal Suave */}
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
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
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
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.5]" />
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
            <button
              type="button"
              onClick={handleAbrirNuevo}
              className="mt-3 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 font-bold text-xs flex items-center gap-1.5 border border-amber-500/40 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar a esta categoría</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
            {productosFiltrados.map((prod) => (
              <TarjetaProductoItem
                key={prod.id}
                prod={prod}
                esClaro={esClaro}
                onSeleccionar={handleSeleccionarParaOrdenar}
                onAbrirOpciones={handleAbrirOpciones}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante para celular y tablet vertical si hay platillos en la cuenta */}
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

      {/* Modal de Modificadores (al dar tap normal en un producto) */}
      {productoAComandar && (
        <ModificadorModal
          producto={productoAComandar}
          onCerrar={() => setProductoAComandar(null)}
          onConfirmar={handleConfirmarModificador}
        />
      )}

      {/* Menú Contextual de Opciones (al mantener pulsado o clic derecho) */}
      <ModalOpcionesProducto
        producto={productoSeleccionadoOpciones}
        abierto={modalOpcionesAbierto}
        onCerrar={() => {
          setModalOpcionesAbierto(false);
          setProductoSeleccionadoOpciones(null);
        }}
        onVerImagen={(prod) => {
          handleAbrirVisorImagen(prod);
        }}
        onEditar={(prod) => {
          handleAbrirEditar(prod);
        }}
        onEliminar={(prod) => {
          handleSolicitarEliminar(prod);
        }}
        esClaro={esClaro}
      />

      {/* Visor de Imagen Ampliada */}
      <ModalVisorImagen
        producto={productoParaVisor}
        abierto={modalVisorAbierto}
        onCerrar={() => {
          setModalVisorAbierto(false);
          setProductoParaVisor(null);
        }}
        onEditar={(prod) => {
          handleAbrirEditar(prod);
        }}
        esClaro={esClaro}
      />

      {/* Modal Formulario de Producto (Crear o Editar) */}
      <ModalFormularioProducto
        abierto={modalFormularioAbierto}
        productoParaEditar={productoParaEditar}
        categoriaInicial={categoriaActiva}
        onCerrar={() => {
          setModalFormularioAbierto(false);
          setProductoParaEditar(null);
        }}
        onGuardar={handleGuardarProducto}
        esClaro={esClaro}
      />

      {/* Modal de Confirmación para Eliminar Producto */}
      {modalEliminarAbierto && productoAEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full max-w-md rounded-3xl overflow-hidden border p-5 sm:p-6 shadow-2xl ${
              esClaro
                ? 'bg-white border-stone-200 text-stone-900'
                : 'bg-stone-900 border-red-500/40 text-stone-100'
            }`}
          >
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-3 rounded-2xl bg-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black leading-tight">¿Eliminar este producto?</h3>
            </div>

            <p className="text-sm text-stone-300 leading-relaxed mb-4">
              Estás a punto de retirar{' '}
              <strong className="text-amber-400 font-extrabold">{productoAEliminar.nombre}</strong>{' '}
              del menú general de la taquería. Ya no estará disponible para nuevas órdenes. Las
              cuentas anteriores y activas mantendrán su historial intacto.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalEliminarAbierto(false);
                  setProductoAEliminar(null);
                }}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  esClaro
                    ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                className="py-2.5 px-5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
