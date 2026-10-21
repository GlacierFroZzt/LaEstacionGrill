import React, { useState } from 'react';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Printer,
  CreditCard,
  Clock,
  User,
  AlertTriangle,
  Receipt,
  ChefHat,
  Check,
  RotateCw,
  CupSoda,
  Pencil,
  ArrowRightLeft,
} from 'lucide-react';
import { useRestaurante, esItemParaCocina } from '../context/RestauranteContext';
import { formatearMoneda, formatearTiempoTranscurrido, formatearHoraCorta } from '../utils/formateadores';
import { BotonOroLiquido } from './BotonOroLiquido';
import { ModalRenombrarMesa } from './ModalRenombrarMesa';
import { ModalMoverMesa } from './ModalMoverMesa';

interface DetalleCuentaProps {
  onAbrirCobro: () => void;
  onVolverMenuMovil?: () => void;
}

export const DetalleCuenta: React.FC<DetalleCuentaProps> = ({
  onAbrirCobro,
  onVolverMenuMovil,
}) => {
  const {
    mesaSeleccionada,
    cuentaActiva,
    seleccionarMesa,
    modificarCantidadItem,
    eliminarItemComanda,
    liberarMesaManual,
    imprimirTicket,
    enviarComandaACocina,
    tema,
  } = useRestaurante();

  const [confirmandoLiberar, setConfirmandoLiberar] = useState<boolean>(false);
  const [comandaEnviadaFeedback, setComandaEnviadaFeedback] = useState<string | null>(null);
  const [modalRenombrarAbierto, setModalRenombrarAbierto] = useState<boolean>(false);
  const [modalMoverAbierto, setModalMoverAbierto] = useState<boolean>(false);

  const esClaro = tema === 'claro';

  if (!mesaSeleccionada) {
    return null;
  }

  const items = cuentaActiva?.items ?? [];
  const subtotal = cuentaActiva?.subtotal ?? 0;
  const total = cuentaActiva?.total ?? 0;

  const totalNuevosPorEnviar = items.reduce(
    (acc, it) =>
      acc + (esItemParaCocina(it) ? Math.max(0, it.cantidad - (it.cantidadEnviadaCocina ?? 0)) : 0),
    0
  );
  const totalItemsEnviados = items.reduce(
    (acc, it) => acc + (esItemParaCocina(it) ? (it.cantidadEnviadaCocina ?? 0) : 0),
    0
  );

  const handleEnviarCocina = (forzarReenvio?: boolean): void => {
    const res = enviarComandaACocina(mesaSeleccionada.id, forzarReenvio);
    setComandaEnviadaFeedback(res.mensaje);
    setTimeout(() => setComandaEnviadaFeedback(null), 3500);
  };

  return (
    <aside
      className={`w-full lg:w-[390px] xl:w-[440px] flex flex-col h-full shadow-2xl z-10 border-l ${
        esClaro
          ? 'bg-white border-stone-200 text-stone-900'
          : 'bg-stone-900 border-stone-800 text-stone-100'
      }`}
    >
      {/* Cabecera de la Mesa */}
      <div
        className={`p-3.5 sm:p-4 border-b flex items-center justify-between ${
          esClaro ? 'bg-stone-100 border-stone-200' : 'bg-stone-950 border-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (onVolverMenuMovil && window.innerWidth < 1024) {
                onVolverMenuMovil();
              } else {
                seleccionarMesa(null);
              }
            }}
            className={`p-2 rounded-xl active:scale-95 transition-all shrink-0 ${
              esClaro
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-700 hover:text-stone-950'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white'
            }`}
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3
                className={`font-black text-lg sm:text-xl truncate ${
                  esClaro ? 'text-amber-600' : 'text-amber-400'
                }`}
              >
                {mesaSeleccionada.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setModalRenombrarAbierto(true)}
                className="p-1 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0"
                title="Configurar nombre o personas en la mesa"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {mesaSeleccionada.area !== 'domicilio' && (
                <button
                  type="button"
                  onClick={() => setModalRenombrarAbierto(true)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                    esClaro
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                  }`}
                  title="Toca para cambiar el número de personas en la mesa"
                >
                  <span>👥 {mesaSeleccionada.capacidad} pers.</span>
                </button>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                  esClaro
                    ? 'bg-stone-200 text-stone-700 border-stone-300'
                    : 'bg-stone-800 text-stone-300 border-stone-700'
                }`}
              >
                {mesaSeleccionada.area === 'domicilio' ? 'A Domicilio' : 'Mesa'}
              </span>
            </div>
            <div
              className={`flex items-center gap-3 text-xs mt-0.5 ${
                esClaro ? 'text-stone-500' : 'text-stone-400'
              }`}
            >
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-amber-400" />
                {cuentaActiva?.mesero ?? mesaSeleccionada.meseroAsignado ?? 'Sin mesero'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                {formatearTiempoTranscurrido(mesaSeleccionada.horaApertura)}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones de Cabecera: Mover Mesa y Comanda */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setModalMoverAbierto(true)}
            className={`p-2 sm:px-2.5 sm:py-2 rounded-xl font-bold active:scale-95 transition-all flex items-center gap-1 text-xs border ${
              esClaro
                ? 'bg-stone-200 hover:bg-stone-300 text-blue-700 border-stone-300'
                : 'bg-stone-800 hover:bg-stone-700 text-blue-400 border-stone-700'
            }`}
            title="Mover o transferir comanda a otra mesa libre"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden sm:inline">Mover</span>
          </button>

          {/* Botón Imprimir Comanda Cocina */}
          <button
            type="button"
            onClick={() => imprimirTicket('cocina')}
            disabled={items.length === 0}
            className={`p-2 sm:px-2.5 sm:py-2 rounded-xl disabled:opacity-40 font-bold active:scale-95 transition-all flex items-center gap-1 text-xs border ${
              esClaro
                ? 'bg-stone-200 hover:bg-stone-300 text-amber-700 border-stone-300'
                : 'bg-stone-800 hover:bg-stone-700 text-amber-400 border-stone-700'
            }`}
            title="Imprimir ticket para cocina / barra"
          >
            <ChefHat className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Comanda</span>
          </button>
        </div>
      </div>

      {/* Listado de Productos Pedidos (Scroll táctil) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 pb-8">
        {items.length === 0 ? (
          <div
            className={`h-full flex flex-col items-center justify-center p-6 text-center ${
              esClaro ? 'text-stone-400' : 'text-stone-500'
            }`}
          >
            <Receipt className="w-16 h-16 stroke-1 mb-2 opacity-30 text-stone-400" />
            <p className="font-semibold text-base">Comanda sin platillos</p>
            <p className="text-xs mt-1 max-w-[220px]">
              Toca los platillos y bebidas en el menú de la izquierda para agregarlos a la cuenta.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-2xl border flex flex-col gap-2 shadow-xs transition-colors ${
                esClaro
                  ? 'bg-stone-50 border-stone-200 text-stone-900'
                  : 'bg-stone-950 border-stone-800/90 text-stone-100'
              }`}
            >
              {/* Título y subtotal */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-extrabold text-sm leading-tight">
                    {item.nombre}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`text-xs ${
                        esClaro ? 'text-stone-500' : 'text-stone-400'
                      }`}
                    >
                      {formatearMoneda(item.precioUnitario)} c/u
                    </span>

                    {/* Badge de estado en cocina o servicio directo de mesero */}
                    {!esItemParaCocina(item) ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                          esClaro
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-sky-950/70 text-sky-300 border-sky-700/60'
                        }`}
                        title="Bebida sin preparación llevada directamente por el mesero"
                      >
                        <CupSoda className="w-3 h-3 text-sky-500" />
                        Bebida · Mesero
                      </span>
                    ) : (item.cantidadEnviadaCocina ?? 0) === 0 ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                          esClaro
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Por enviar
                      </span>
                    ) : item.cantidad === (item.cantidadEnviadaCocina ?? 0) ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                          esClaro
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                        }`}
                      >
                        <Check className="w-3 h-3 text-emerald-500" />
                        En cocina
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                          esClaro
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                        }`}
                      >
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>{item.cantidadEnviadaCocina} en cocina</span>
                        <span className="text-amber-500 font-extrabold">
                          (+{item.cantidad - (item.cantidadEnviadaCocina ?? 0)} nuevo)
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`font-black text-base ${
                    esClaro ? 'text-emerald-600' : 'text-emerald-400'
                  }`}
                >
                  {formatearMoneda(item.precioUnitario * item.cantidad)}
                </span>
              </div>

              {/* Modificadores y notas */}
              {(item.modificadoresSeleccionados.length > 0 || item.notas) && (
                <div
                  className={`p-2 rounded-xl text-xs space-y-1 border ${
                    esClaro
                      ? 'bg-amber-50/80 border-amber-200/80 text-stone-800'
                      : 'bg-stone-900/80 border-stone-800 text-stone-300'
                  }`}
                >
                  {item.modificadoresSeleccionados.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.modificadoresSeleccionados.map((mod, idx) => (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded-md font-medium text-[11px] border ${
                            esClaro
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notas && (
                    <p
                      className={`italic text-[11px] ${
                        esClaro ? 'text-stone-600' : 'text-stone-300'
                      }`}
                    >
                      Nota: "{item.notas}"
                    </p>
                  )}
                </div>
              )}

              {/* Controles Táctiles de Cantidad */}
              <div
                className={`flex items-center justify-between pt-1 border-t ${
                  esClaro ? 'border-stone-200' : 'border-stone-900'
                }`}
              >
                <span
                  className={`text-[11px] ${
                    esClaro ? 'text-stone-400' : 'text-stone-500'
                  }`}
                >
                  {formatearHoraCorta(item.fechaAgregado)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => modificarCantidadItem(mesaSeleccionada.id, item.id, -1)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all ${
                      esClaro
                        ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <span
                    className={`font-black text-base w-6 text-center ${
                      esClaro ? 'text-amber-600' : 'text-amber-400'
                    }`}
                  >
                    {item.cantidad}
                  </span>

                  <button
                    type="button"
                    onClick={() => modificarCantidadItem(mesaSeleccionada.id, item.id, 1)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all ${
                      esClaro
                        ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => eliminarItemComanda(mesaSeleccionada.id, item.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all ml-1 border ${
                      esClaro
                        ? 'bg-red-100 hover:bg-red-200 text-red-600 border-red-200'
                        : 'bg-red-950/60 hover:bg-red-900 text-red-400 border-red-900/40'
                    }`}
                    title="Eliminar este platillo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen Financiero y Acciones */}
      <div
        className={`p-4 border-t space-y-3 ${
          esClaro ? 'bg-stone-100 border-stone-200' : 'bg-stone-950 border-stone-800'
        }`}
      >
        <div className="space-y-1.5 text-xs md:text-sm">
          <div
            className={`flex justify-between ${
              esClaro ? 'text-stone-600' : 'text-stone-400'
            }`}
          >
            <span>Subtotal de consumo:</span>
            <span
              className={`font-bold ${
                esClaro ? 'text-stone-900' : 'text-stone-200'
              }`}
            >
              {formatearMoneda(subtotal)}
            </span>
          </div>

          <div
            className={`flex justify-between items-baseline pt-2 border-t ${
              esClaro ? 'border-stone-300' : 'border-stone-800'
            }`}
          >
            <span
              className={`font-extrabold text-base ${
                esClaro ? 'text-stone-900' : 'text-stone-200'
              }`}
            >
              Total a Pagar:
            </span>
            <span
              className={`font-black text-2xl ${
                esClaro ? 'text-emerald-600' : 'text-emerald-400'
              }`}
            >
              {formatearMoneda(total)}
            </span>
          </div>
        </div>

        {/* Botones de Cocina, Cobro e Impresión */}
        <div className="space-y-2 pt-1">
          {/* Alerta de confirmación de envío */}
          {comandaEnviadaFeedback && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-xs font-bold text-amber-500 flex items-center gap-2 animate-in fade-in">
              <ChefHat className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{comandaEnviadaFeedback}</span>
            </div>
          )}

          {/* Botón Principal: Enviar a Cocina (Incremental o Inicial) */}
          {totalNuevosPorEnviar > 0 ? (
            <BotonOroLiquido
              onClick={() => handleEnviarCocina(false)}
              disabled={items.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl text-sm md:text-base flex items-center justify-center gap-2 shadow-xl"
            >
              <ChefHat className="w-5 h-5 stroke-[2.5]" />
              <span>
                {totalItemsEnviados === 0
                  ? `Mandar a Cocina (${totalNuevosPorEnviar} platillo${totalNuevosPorEnviar > 1 ? 's' : ''})`
                  : `Mandar a Cocina (${totalNuevosPorEnviar} nuevo${totalNuevosPorEnviar > 1 ? 's' : ''})`}
              </span>
            </BotonOroLiquido>
          ) : totalItemsEnviados > 0 ? (
            <div className="flex gap-2">
              <div
                className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 border select-none ${
                  esClaro
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                }`}
              >
                <Check className="w-4 h-4 text-emerald-500" />
                <span>✓ Todo enviado a cocina</span>
              </div>
              <button
                type="button"
                onClick={() => handleEnviarCocina(true)}
                className={`px-3 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border active:scale-95 transition-all cursor-pointer ${
                  esClaro
                    ? 'bg-stone-200 hover:bg-stone-300 text-stone-700 border-stone-300'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                }`}
                title="Re-enviar la comanda completa a cocina"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Re-enviar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-3 px-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 opacity-40 bg-stone-800 text-stone-400"
            >
              <ChefHat className="w-5 h-5" />
              <span>Sin platillos para enviar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAbrirCobro}
            disabled={items.length === 0}
            className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
          >
            <CreditCard className="w-5 h-5 stroke-[2.5] shrink-0" />
            <span className="truncate">Cobrar y Cerrar Cuenta ({formatearMoneda(total)})</span>
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => imprimirTicket('cliente')}
              disabled={items.length === 0}
              className={`py-2 px-2 rounded-xl disabled:opacity-40 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all border ${
                esClaro
                  ? 'bg-stone-200 hover:bg-stone-300 text-stone-800 border-stone-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
              }`}
              title="Imprimir ticket para el cliente"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Ticket</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMoverAbierto(true)}
              className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all border ${
                esClaro
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border-blue-800/60'
              }`}
              title="Mover cuenta a otra mesa desocupada"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">Mover</span>
            </button>

            {confirmandoLiberar ? (
              <div className="flex gap-1 col-span-1">
                <button
                  type="button"
                  onClick={() => {
                    liberarMesaManual(mesaSeleccionada.id);
                    setConfirmandoLiberar(false);
                    seleccionarMesa(null);
                  }}
                  className="w-full py-2 rounded-xl bg-red-700 text-white text-[11px] font-black active:scale-95"
                >
                  Sí, Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoLiberar(true)}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all border ${
                  esClaro
                    ? 'bg-stone-100 hover:bg-red-50 text-red-600 border-stone-300'
                    : 'bg-stone-900 hover:bg-red-950/40 text-red-400 border-stone-800'
                }`}
                title="Cancelar orden y liberar mesa"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="truncate">Cancelar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modales de Gestión de Mesa */}
      <ModalRenombrarMesa
        mesa={mesaSeleccionada}
        isOpen={modalRenombrarAbierto}
        onClose={() => setModalRenombrarAbierto(false)}
      />
      <ModalMoverMesa
        mesaOrigen={mesaSeleccionada}
        isOpen={modalMoverAbierto}
        onClose={() => setModalMoverAbierto(false)}
      />
    </aside>
  );
};
