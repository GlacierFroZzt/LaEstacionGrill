import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, Users, Bike, AlertCircle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import type { Mesa, TipoArea } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { BotonOroLiquido } from './BotonOroLiquido';
import { gestorNavegacion } from '../utils/navegacionDispositivo';
import { formatearMoneda, formatearTiempoTranscurrido } from '../utils/formateadores';

interface ModalMoverMesaProps {
  readonly mesaOrigen: Mesa | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onExito?: (mesaDestino: Mesa) => void;
}

export const ModalMoverMesa: React.FC<ModalMoverMesaProps> = ({
  mesaOrigen,
  isOpen,
  onClose,
  onExito,
}) => {
  const { mesas, cuentaActiva, moverMesa, tema } = useRestaurante();
  const [mesaDestinoId, setMesaDestinoId] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState<TipoArea | 'todas'>('todas');
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const esClaro = tema === 'claro';

  useEffect(() => {
    if (isOpen) {
      setMesaDestinoId(null);
      setErrorMensaje(null);
      // Pre-filtrar al área correspondiente a la mesa de origen
      if (mesaOrigen) {
        setFiltroArea(mesaOrigen.area);
      }
    }
  }, [isOpen, mesaOrigen]);

  // Manejador del botón atrás en dispositivos móviles / tablets
  useEffect(() => {
    if (isOpen) {
      return gestorNavegacion.empujarPaso('modal-mover-mesa', onClose);
    }
  }, [isOpen, onClose]);

  // Manejo de atajo Escape para cerrar
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

  if (!isOpen || !mesaOrigen) {
    return null;
  }

  // Filtrar mesas candidatas que estén libres y sean distintas de la de origen
  const mesasLibresTotales = mesas.filter(
    (m) => m.id !== mesaOrigen.id && m.estado === 'libre'
  );

  const mesasLibresFiltradas = mesasLibresTotales.filter((m) => {
    if (filtroArea === 'todas') return true;
    return m.area === filtroArea;
  });

  const mesaDestinoSeleccionada = mesasLibresTotales.find((m) => m.id === mesaDestinoId) ?? null;

  const handleConfirmarMover = (): void => {
    if (!mesaDestinoId) {
      setErrorMensaje('Selecciona una mesa libre de destino.');
      return;
    }

    const resultado = moverMesa(mesaOrigen.id, mesaDestinoId);
    if (!resultado.exito) {
      setErrorMensaje(resultado.mensaje);
      return;
    }

    if (onExito && mesaDestinoSeleccionada) {
      onExito(mesaDestinoSeleccionada);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/85 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border p-4 sm:p-6 max-h-[90vh] flex flex-col transition-all ${
          esClaro
            ? 'bg-white border-stone-200 text-stone-900 shadow-stone-900/20'
            : 'bg-stone-900 border-stone-800 text-stone-100 shadow-stone-950/80'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-700/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">Mover Comanda de Mesa</h3>
              <p className="text-xs text-stone-400">
                Cambiar orden actual a otra mesa desocupada
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

        {/* Resumen de la Mesa Origen */}
        <div
          className={`mt-3 p-3 rounded-xl border flex items-center justify-between gap-3 ${
            esClaro
              ? 'bg-amber-50/70 border-amber-200 text-stone-900'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 block">
              Mesa de Origen
            </span>
            <div className="flex items-center gap-2 font-black text-base sm:text-lg text-amber-400">
              {mesaOrigen.area === 'domicilio' ? (
                <Bike className="w-4 h-4 text-cyan-400" />
              ) : (
                <Users className="w-4 h-4 text-amber-400" />
              )}
              <span>{mesaOrigen.nombre}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
              <span>{cuentaActiva?.mesero ?? mesaOrigen.meseroAsignado ?? 'Sin mesero'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                {formatearTiempoTranscurrido(mesaOrigen.horaApertura)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-stone-400 block">Consumo actual</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 flex items-center justify-end">
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
              {formatearMoneda(mesaOrigen.totalParcial || (cuentaActiva?.total ?? 0))}
            </span>
          </div>
        </div>

        {/* Pestañas de filtrado de zonas libres */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Destino Disponible:
          </span>
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border text-xs ${
              esClaro ? 'bg-stone-100 border-stone-200' : 'bg-stone-950 border-stone-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setFiltroArea('todas')}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroArea === 'todas'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Todas ({mesasLibresTotales.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroArea('mesa')}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroArea === 'mesa'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Mesas ({mesasLibresTotales.filter((m) => m.area === 'mesa').length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroArea('domicilio')}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroArea === 'domicilio'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Domicilio ({mesasLibresTotales.filter((m) => m.area === 'domicilio').length})
            </button>
          </div>
        </div>

        {/* Listado de Mesas Libres (Scroll táctil) */}
        <div className="mt-2 flex-1 min-h-[140px] max-h-[260px] overflow-y-auto p-1 space-y-2">
          {mesasLibresFiltradas.length === 0 ? (
            <div
              className={`p-6 text-center rounded-xl border flex flex-col items-center justify-center ${
                esClaro ? 'bg-stone-50 border-stone-200 text-stone-500' : 'bg-stone-950/60 border-stone-800 text-stone-400'
              }`}
            >
              <AlertCircle className="w-8 h-8 text-amber-500/80 mb-2" />
              <p className="font-bold text-sm">No hay mesas libres en esta zona.</p>
              <p className="text-xs mt-1 text-stone-400">
                Puedes agregar una nueva mesa en la pantalla de mesas para realizar el traslado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {mesasLibresFiltradas.map((mesa) => {
                const estaSeleccionada = mesa.id === mesaDestinoId;
                const esDomicilio = mesa.area === 'domicilio';

                return (
                  <button
                    key={mesa.id}
                    type="button"
                    onClick={() => {
                      setMesaDestinoId(mesa.id);
                      if (errorMensaje) setErrorMensaje(null);
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 active:scale-95 cursor-pointer select-none ${
                      estaSeleccionada
                        ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40 text-amber-300 shadow-md'
                        : esClaro
                        ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-900'
                        : 'bg-stone-950/80 hover:bg-stone-800/80 border-stone-800 text-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="font-extrabold text-sm truncate flex items-center gap-1.5">
                        {esDomicilio ? (
                          <Bike className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{mesa.nombre}</span>
                      </span>
                      {estaSeleccionada ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Libre" />
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 mt-2 font-medium">
                      {esDomicilio ? 'A Domicilio' : `Capacidad ${mesa.capacidad}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {errorMensaje && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-xs font-semibold text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMensaje}</span>
          </div>
        )}

        {/* Pie de acciones */}
        <div className="mt-4 pt-3 border-t border-stone-700/30 flex items-center justify-end gap-2">
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
            onClick={handleConfirmarMover}
            disabled={!mesaDestinoId}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-lg disabled:opacity-40"
          >
            <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
            <span>
              {mesaDestinoSeleccionada
                ? `Mover a ${mesaDestinoSeleccionada.nombre}`
                : 'Selecciona una Mesa'}
            </span>
          </BotonOroLiquido>
        </div>
      </div>
    </div>
  );
};
