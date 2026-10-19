import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Check,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import type { EstadoPedidoCocina } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearHoraCorta } from '../utils/formateadores';
import { gestorAudioCocina, reproducirCampanaCocina } from '../utils/sonidoCocina';
import { LienzoOroLiquido } from './LienzoOroLiquido';
import { BotonOroLiquido } from './BotonOroLiquido';

export const PantallaCocina: React.FC = () => {
  const {
    pedidosCocina,
    cambiarEstadoPedidoCocina,
    alternarItemCompletadoCocina,
    nivelOroLiquido,
    tema,
  } = useRestaurante();
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedidoCocina | 'todos'>('todos');
  const [ahora, setAhora] = useState<number>(Date.now());

  const esClaro = tema === 'claro';

  // Actualizar cronómetros de cocina cada 15 segundos
  useEffect(() => {
    const intervalo = setInterval(() => {
      setAhora(Date.now());
    }, 15000);
    return () => clearInterval(intervalo);
  }, []);

  // Calcular minutos transcurridos
  const calcularMinutosEspera = (horaEnvio: string): number => {
    try {
      const ms = Math.max(0, ahora - new Date(horaEnvio).getTime());
      return Math.floor(ms / (1000 * 60));
    } catch {
      return 0;
    }
  };

  const pedidosFiltrados = pedidosCocina.filter((p) => {
    if (filtroEstado === 'todos') {
      return p.estado !== 'entregado';
    }
    return p.estado === filtroEstado;
  });

  // Resumen agregado de platillos activos para los taqueros/parrilleros
  const resumenProduccion: Record<string, number> = {};
  pedidosCocina
    .filter((p) => p.estado === 'pendiente' || p.estado === 'en_preparacion')
    .forEach((p) => {
      p.items.forEach((it) => {
        if (!it.completado) {
          resumenProduccion[it.nombre] = (resumenProduccion[it.nombre] || 0) + it.cantidad;
        }
      });
    });

  const pendientesCount = pedidosCocina.filter((p) => p.estado === 'pendiente').length;
  const enPreparacionCount = pedidosCocina.filter((p) => p.estado === 'en_preparacion').length;
  const listosCount = pedidosCocina.filter((p) => p.estado === 'listo').length;

  const fondoContenedor = esClaro
    ? nivelOroLiquido !== 'apagado'
      ? 'bg-stone-100/75 backdrop-blur-[2px] text-stone-900'
      : 'bg-stone-100 text-stone-900'
    : nivelOroLiquido !== 'apagado'
    ? 'bg-stone-950/75 backdrop-blur-[2px] text-stone-100'
    : 'bg-stone-950 text-stone-100';

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col p-3.5 sm:p-5 md:p-6 overflow-y-auto pb-24 transition-colors ${fondoContenedor}`}
    >
      {/* Cabecera de Cocina */}
      <div
        className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 border-b pb-4 ${
          esClaro ? 'border-stone-300' : 'border-stone-800'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl relative overflow-hidden text-stone-950 shadow-md border border-amber-300/80 bg-amber-500">
              {nivelOroLiquido !== 'apagado' && (
                <LienzoOroLiquido
                  key={nivelOroLiquido}
                  className="absolute inset-0 w-full h-full"
                  velocidad={0.9}
                  brillo={1.2}
                  densidadOndas={1.1}
                />
              )}
              <ChefHat className="relative z-10 w-6 h-6 stroke-[2.5]" />
            </span>
            <div>
              <h2
                className={`text-xl md:text-2xl font-black tracking-wide uppercase flex items-center gap-2 ${
                  esClaro ? 'text-amber-600' : 'text-amber-400'
                }`}
              >
                Pantalla de Cocina y Parrilla
              </h2>
              <p className={`text-xs md:text-sm ${esClaro ? 'text-stone-600' : 'text-stone-400'}`}>
                Recepción instantánea de pedidos desde las tablets de los meseros.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de Estados y Control de Audio */}
        <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm">
          <button
            type="button"
            onClick={async () => {
              await gestorAudioCocina.asegurarDesbloqueo();
              reproducirCampanaCocina();
            }}
            title="Probar / Activar alerta acústica de cocina"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
              esClaro
                ? 'border-amber-400 bg-amber-100/90 text-amber-900 hover:bg-amber-200'
                : 'border-amber-500/40 bg-amber-950/40 text-amber-400 hover:bg-amber-900/50'
            }`}
          >
            <Volume2 className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Campanilla</span>
          </button>

          {filtroEstado === 'todos' ? (
            <BotonOroLiquido
              onClick={() => setFiltroEstado('todos')}
              className="px-3.5 py-1.5 rounded-xl text-xs md:text-sm shadow-sm"
            >
              Activas ({pendientesCount + enPreparacionCount + listosCount})
            </BotonOroLiquido>
          ) : (
            <button
              type="button"
              onClick={() => setFiltroEstado('todos')}
              className={`px-3.5 py-1.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
                esClaro
                  ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              Activas ({pendientesCount + enPreparacionCount + listosCount})
            </button>
          )}

          <button
            type="button"
            onClick={() => setFiltroEstado('pendiente')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
              filtroEstado === 'pendiente'
                ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                : esClaro
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-amber-950/60 border-amber-700/50 text-amber-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pendientes ({pendientesCount})
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('en_preparacion')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
              filtroEstado === 'en_preparacion'
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                : esClaro
                ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
                : 'bg-blue-950/60 border-blue-700/50 text-blue-300'
            }`}
          >
            <Flame className="w-4 h-4" />
            Al Carbón ({enPreparacionCount})
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('listo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
              filtroEstado === 'listo'
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                : esClaro
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Listos ({listosCount})
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('entregado')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
              filtroEstado === 'entregado'
                ? 'bg-stone-700 border-stone-600 text-white shadow-sm'
                : esClaro
                ? 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50'
                : 'bg-stone-900 border-stone-800 text-stone-400'
            }`}
          >
            <span>Historial Despachadas ({pedidosCocina.filter((p) => p.estado === 'entregado').length})</span>
          </button>
        </div>
      </div>

      {/* Barra de Demanda Total en Fuego ("En el comal") */}
      {Object.keys(resumenProduccion).length > 0 && (
        <div
          className={`mb-5 p-3.5 rounded-2xl border ${
            esClaro
              ? 'bg-white/95 border-stone-200 shadow-sm text-stone-900'
              : 'bg-stone-900/90 border-stone-800 text-stone-100'
          }`}
        >
          <div
            className={`flex items-center gap-2 mb-2 text-xs font-black uppercase tracking-wider ${
              esClaro ? 'text-amber-700' : 'text-amber-400'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Demanda Acumulada en el Comal / Parrilla:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(resumenProduccion).map(([nombre, cantidad]) => (
              <div
                key={nombre}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs md:text-sm font-bold ${
                  esClaro
                    ? 'bg-stone-100 border-stone-200 text-stone-900 shadow-2xs'
                    : 'bg-stone-950 border-stone-800 text-stone-200'
                }`}
              >
                <span className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-black text-xs">
                  {cantidad}
                </span>
                <span>{nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cuadrícula de Comandas de Cocina */}
      {pedidosFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 py-16 text-center">
          <ChefHat className="w-20 h-20 mb-3 stroke-1 opacity-30 text-amber-500" />
          <h3 className={`text-xl font-bold ${esClaro ? 'text-stone-800' : 'text-stone-300'}`}>
            ¡Cocina al Día!
          </h3>
          <p className={`text-sm mt-1 max-w-sm ${esClaro ? 'text-stone-600' : 'text-stone-500'}`}>
            No hay comandas pendientes en este momento. Las nuevas órdenes enviadas por los meseros
            aparecerán aquí automáticamente con alerta sonora.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pedidosFiltrados.map((pedido) => {
            const minutos = calcularMinutosEspera(pedido.horaEnvio);

            // Semáforo de tiempo de espera
            let badgeTiempoClase = esClaro
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-emerald-950 text-emerald-400 border-emerald-600/50';
            let bordeTarjeta = esClaro ? 'border-stone-200 shadow-md' : 'border-stone-800 shadow-xl';

            if (minutos >= 20) {
              badgeTiempoClase = esClaro
                ? 'bg-red-100 text-red-900 border-red-400 animate-pulse font-black'
                : 'bg-red-950 text-red-300 border-red-500 animate-pulse font-black';
              bordeTarjeta = esClaro
                ? 'border-red-500 shadow-lg shadow-red-500/20'
                : 'border-red-600 shadow-lg shadow-red-950/60';
            } else if (minutos >= 10) {
              badgeTiempoClase = esClaro
                ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                : 'bg-amber-950 text-amber-300 border-amber-600/60 font-bold';
              bordeTarjeta = esClaro ? 'border-amber-400 shadow-md' : 'border-amber-600/60 shadow-xl';
            }

            const esListo = pedido.estado === 'listo';

            return (
              <div
                key={pedido.id}
                className={`rounded-3xl border flex flex-col justify-between overflow-hidden transition-all ${
                  esClaro
                    ? esListo
                      ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-500/10'
                      : `bg-white ${bordeTarjeta}`
                    : esListo
                    ? 'border-emerald-600 bg-stone-900/90 shadow-xl'
                    : `bg-stone-900 ${bordeTarjeta}`
                }`}
              >
                {/* Cabecera de la Comanda */}
                <div
                  className={`p-4 border-b flex items-start justify-between ${
                    esClaro ? 'bg-stone-100/90 border-stone-200' : 'bg-stone-950/90 border-stone-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span
                        className={`text-[11px] font-bold block uppercase ${
                          esClaro ? 'text-stone-600' : 'text-stone-400'
                        }`}
                      >
                        Mesero: {pedido.mesero}
                      </span>
                      {pedido.numeroRonda && pedido.numeroRonda > 1 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-stone-950 border border-amber-400 shadow-xs">
                          🔥 Ronda {pedido.numeroRonda} (Adicional)
                        </span>
                      )}
                    </div>
                    <h3
                      className={`text-2xl font-black leading-tight ${
                        esClaro ? 'text-amber-700' : 'text-amber-400'
                      }`}
                    >
                      {pedido.nombreMesa}
                    </h3>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 border ${badgeTiempoClase}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{minutos} min</span>
                    </span>
                    <span className={`text-[10px] ${esClaro ? 'text-stone-600' : 'text-stone-500'}`}>
                      {formatearHoraCorta(pedido.horaEnvio)}
                    </span>
                  </div>
                </div>

                {/* Lista de Platillos (Táctil para tachar) */}
                <div className="p-4 space-y-2.5 flex-1 overflow-y-auto max-h-72">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      esClaro ? 'text-stone-600' : 'text-stone-500'
                    }`}
                  >
                    Toca un platillo para tacharlo conforme lo sirvas:
                  </p>

                  {pedido.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => alternarItemCompletadoCocina(pedido.id, item.id)}
                      className={`p-3 rounded-2xl border cursor-pointer select-none transition-all flex items-start justify-between gap-3 ${
                        item.completado
                          ? esClaro
                            ? 'bg-emerald-50/70 border-emerald-200 text-stone-400 line-through'
                            : 'bg-emerald-950/30 border-emerald-800/40 text-stone-500 line-through'
                          : esClaro
                          ? 'bg-white border-stone-200 hover:border-amber-400 text-stone-900 shadow-2xs'
                          : 'bg-stone-950 border-stone-800 hover:border-amber-500/60 text-stone-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                            item.completado
                              ? esClaro
                                ? 'bg-stone-200 text-stone-500'
                                : 'bg-stone-800 text-stone-500'
                              : 'bg-amber-500 text-stone-950 font-black'
                          }`}
                        >
                          {item.cantidad}
                        </span>
                        <div>
                          <h4
                            className={`font-black text-sm md:text-base ${
                              item.completado
                                ? 'text-stone-400'
                                : esClaro
                                ? 'text-stone-900'
                                : 'text-stone-100'
                            }`}
                          >
                            {item.nombre}
                          </h4>

                          {/* Modificadores resaltados */}
                          {item.modificadores.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.modificadores.map((m, idx) => (
                                <span
                                  key={idx}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    esClaro
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  }`}
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.notas && (
                            <p className="text-xs font-bold text-red-500 mt-1 uppercase">
                              * {item.notas}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          item.completado
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-2xs'
                            : esClaro
                            ? 'border-stone-300 bg-stone-100 text-transparent'
                            : 'border-stone-700 bg-stone-900 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-3" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pie de Acciones de Cocina */}
                <div
                  className={`p-3 border-t flex gap-2 ${
                    esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'
                  }`}
                >
                  {pedido.estado === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => cambiarEstadoPedidoCocina(pedido.id, 'en_preparacion')}
                      className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                      Iniciar Preparación
                    </button>
                  )}

                  {pedido.estado === 'en_preparacion' && (
                    <button
                      type="button"
                      onClick={() => cambiarEstadoPedidoCocina(pedido.id, 'listo')}
                      className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marcar Todo Listo
                    </button>
                  )}

                  {pedido.estado === 'listo' && (
                    <button
                      type="button"
                      onClick={() => cambiarEstadoPedidoCocina(pedido.id, 'entregado')}
                      className={`w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                        esClaro
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                          : 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-600/40'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      Despachar / Entregado
                    </button>
                  )}

                  {pedido.estado === 'entregado' && (
                    <button
                      type="button"
                      onClick={() => cambiarEstadoPedidoCocina(pedido.id, 'en_preparacion')}
                      className={`w-full py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border active:scale-95 transition-all cursor-pointer ${
                        esClaro
                          ? 'bg-stone-200 hover:bg-stone-300 text-amber-900 border-stone-300'
                          : 'bg-stone-800 hover:bg-stone-700 text-amber-400 border-stone-700'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reabrir Pedido al Carbón</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
