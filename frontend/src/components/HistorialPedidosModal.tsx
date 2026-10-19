import React, { useState } from 'react';
import {
  X,
  ClipboardList,
  Clock,
  Search,
  CheckCircle2,
  Flame,
  RotateCcw,
  Printer,
  User,
} from 'lucide-react';
import type { PedidoCocina, EstadoPedidoCocina } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearHoraCorta } from '../utils/formateadores';

interface HistorialPedidosModalProps {
  onCerrar: () => void;
}

export const HistorialPedidosModal: React.FC<HistorialPedidosModalProps> = ({ onCerrar }) => {
  const { pedidosCocina, cambiarEstadoPedidoCocina } = useRestaurante();
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedidoCocina | 'todos'>('todos');

  // Filtrado reactivo de pedidos
  const pedidosFiltrados = pedidosCocina.filter((pedido) => {
    const coincideEstado = filtroEstado === 'todos' ? true : pedido.estado === filtroEstado;
    const termino = busqueda.toLowerCase().trim();
    const coincideBusqueda =
      termino === '' ||
      pedido.nombreMesa.toLowerCase().includes(termino) ||
      pedido.mesero.toLowerCase().includes(termino) ||
      pedido.items.some((it) => it.nombre.toLowerCase().includes(termino));

    return coincideEstado && coincideBusqueda;
  });

  // Estadísticas del historial
  const totalOrdenes = pedidosCocina.length;
  const pendientes = pedidosCocina.filter((p) => p.estado === 'pendiente' || p.estado === 'en_preparacion').length;
  const entregadas = pedidosCocina.filter((p) => p.estado === 'entregado').length;

  const handleReimprimirComanda = (_pedido: PedidoCocina): void => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-3 md:p-6">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] overflow-hidden text-stone-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-4 md:p-5 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-md sombra-dorada">
              <ClipboardList className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-amber-400">
                Historial de Órdenes y Comandas
              </h3>
              <p className="text-xs text-stone-400">
                Registro de todos los pedidos enviados a cocina y parrilla en el turno.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros, Búsqueda y KPIs */}
        <div className="p-4 bg-stone-950/80 border-b border-stone-800 space-y-3">
          {/* Métricas rápidas */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <div className="bg-stone-900 p-2 sm:p-2.5 rounded-xl border border-stone-800 flex flex-col xs:flex-row items-start xs:items-center justify-between text-[11px] sm:text-xs">
              <span className="text-stone-400 font-semibold truncate">Enviadas:</span>
              <span className="font-black text-white text-sm sm:text-base">{totalOrdenes}</span>
            </div>
            <div className="bg-stone-900 p-2 sm:p-2.5 rounded-xl border border-stone-800 flex flex-col xs:flex-row items-start xs:items-center justify-between text-[11px] sm:text-xs">
              <span className="text-amber-400 font-semibold flex items-center gap-1 truncate">
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Cocina:</span>
              </span>
              <span className="font-black text-amber-300 text-sm sm:text-base">{pendientes}</span>
            </div>
            <div className="bg-stone-900 p-2 sm:p-2.5 rounded-xl border border-stone-800 flex flex-col xs:flex-row items-start xs:items-center justify-between text-[11px] sm:text-xs">
              <span className="text-emerald-400 font-semibold flex items-center gap-1 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Listas:</span>
              </span>
              <span className="font-black text-emerald-300 text-sm sm:text-base">{entregadas}</span>
            </div>
          </div>

          {/* Buscador y Pestañas de estado */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por mesa, mesero o platillo..."
                className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-9 pr-4 py-2 text-stone-100 placeholder-stone-500 text-xs md:text-sm focus:outline-hidden focus:border-amber-500"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-stone-800 px-1.5 py-0.5 rounded text-stone-400 hover:text-white"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className={`px-3 py-1.5 rounded-xl font-black whitespace-nowrap active:scale-95 transition-all ${
                  filtroEstado === 'todos'
                    ? 'boton-oro-liquido shadow-md'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Todas ({totalOrdenes})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('pendiente')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap active:scale-95 transition-all ${
                  filtroEstado === 'pendiente'
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('en_preparacion')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap active:scale-95 transition-all ${
                  filtroEstado === 'en_preparacion'
                    ? 'bg-blue-600 text-white'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Al Carbón
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('listo')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap active:scale-95 transition-all ${
                  filtroEstado === 'listo'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Listas
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('entregado')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap active:scale-95 transition-all ${
                  filtroEstado === 'entregado'
                    ? 'bg-stone-700 text-white'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Despachadas ({entregadas})
              </button>
            </div>
          </div>
        </div>

        {/* Listado de Pedidos */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 pb-20">
          {pedidosFiltrados.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-stone-500 text-center">
              <ClipboardList className="w-14 h-14 mb-2 opacity-30 text-amber-500" />
              <p className="font-bold text-stone-400">No hay órdenes que coincidan con la búsqueda.</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Las órdenes enviadas por los meseros aparecerán registradas aquí permanentemente.
              </p>
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              let badgeColor = 'bg-stone-800 text-stone-300 border-stone-700';
              let estadoTexto = 'Pendiente';

              if (pedido.estado === 'pendiente') {
                badgeColor = 'bg-amber-950/80 border-amber-600/60 text-amber-300';
                estadoTexto = 'Pendiente en Cocina';
              } else if (pedido.estado === 'en_preparacion') {
                badgeColor = 'bg-blue-950/80 border-blue-600/60 text-blue-300';
                estadoTexto = 'En Asador / Plancha';
              } else if (pedido.estado === 'listo') {
                badgeColor = 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300';
                estadoTexto = 'Listo para Servir';
              } else if (pedido.estado === 'entregado') {
                badgeColor = 'bg-stone-800 border-stone-700 text-stone-400';
                estadoTexto = 'Entregado a Mesa';
              }

              return (
                <div
                  key={pedido.id}
                  className="bg-stone-950 rounded-2xl border border-stone-800 p-4 shadow-sm hover:border-stone-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Información Principal de la Mesa */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-black text-lg text-amber-400">
                        {pedido.nombreMesa}
                      </span>
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                        {estadoTexto}
                      </span>
                      <span className="text-xs text-stone-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        {pedido.mesero}
                      </span>
                      <span className="text-xs text-stone-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-stone-500" />
                        {formatearHoraCorta(pedido.horaEnvio)}
                      </span>
                    </div>

                    {/* Desglose de platillos */}
                    <div className="bg-stone-900/90 rounded-xl p-3 border border-stone-800/80 space-y-1">
                      {pedido.items.map((it) => (
                        <div key={it.id} className="text-xs flex items-start gap-2">
                          <span className="font-black text-amber-400 w-5 shrink-0">
                            {it.cantidad}x
                          </span>
                          <div>
                            <span className="font-bold text-stone-200">{it.nombre}</span>
                            {it.modificadores.length > 0 && (
                              <span className="text-stone-400 text-[11px] ml-1.5 italic">
                                ({it.modificadores.join(', ')})
                              </span>
                            )}
                            {it.notas && (
                              <span className="text-red-400 text-[11px] font-semibold ml-1.5 uppercase">
                                * {it.notas}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReimprimirComanda(pedido)}
                      className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all border border-stone-700 cursor-pointer"
                      title="Reimprimir Ticket de Comanda"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>Reimprimir</span>
                    </button>

                    {pedido.estado === 'entregado' ? (
                      <button
                        type="button"
                        onClick={() => cambiarEstadoPedidoCocina(pedido.id, 'en_preparacion')}
                        className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all border border-stone-700"
                        title="Reabrir Comanda para cocina"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <span>Reabrir</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => cambiarEstadoPedidoCocina(pedido.id, 'entregado')}
                        className="py-2 px-3 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Marcar Entregado</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
