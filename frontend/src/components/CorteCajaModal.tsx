import React, { useState, useMemo } from 'react';
import {
  X,
  Lock,
  DollarSign,
  Banknote,
  CreditCard,
  QrCode,
  TrendingUp,
  Receipt,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Coins,
  User,
} from 'lucide-react';
import type { ResumenPropinaMesero } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearMoneda, formatearHoraCorta, formatearFechaCompleta } from '../utils/formateadores';
import { CalendarioHistorialTurnos } from './CalendarioHistorialTurnos';

interface CorteCajaModalProps {
  onCerrar: () => void;
}

export const CorteCajaModal: React.FC<CorteCajaModalProps> = ({ onCerrar }) => {
  const { corteActual, cuentasCerradas, reiniciarTurnoActual } = useRestaurante();

  const [pinIngresado, setPinIngresado] = useState<string>('');
  const [desbloqueado, setDesbloqueado] = useState<boolean>(false);
  const [errorPin, setErrorPin] = useState<boolean>(false);
  const [confirmandoReinicio, setConfirmandoReinicio] = useState<boolean>(false);
  const [mensajeReinicio, setMensajeReinicio] = useState<string | null>(null);
  const [pestanaActiva, setPestanaActiva] = useState<'actual' | 'calendario'>('actual');

  // Cálculo reactivo de propinas del turno actual agrupadas por mesero
  const { resumenPropinas, totalPropinasCalculado } = useMemo(() => {
    const mapaMeseros = new Map<
      string,
      {
        totalPropina: number;
        cuentasCount: number;
        propinaEfectivo: number;
        propinaTarjeta: number;
        propinaTransferencia: number;
      }
    >();

    let sumaTotal = 0;

    for (const c of cuentasCerradas) {
      const prop = Number(c.propina ?? 0);
      if (prop <= 0) continue;

      sumaTotal += prop;
      const nombreMesero = (c.mesero && c.mesero.trim()) || 'Mesero no asignado';
      const actual = mapaMeseros.get(nombreMesero) || {
        totalPropina: 0,
        cuentasCount: 0,
        propinaEfectivo: 0,
        propinaTarjeta: 0,
        propinaTransferencia: 0,
      };

      actual.totalPropina += prop;
      actual.cuentasCount += 1;

      if (c.metodoPago === 'efectivo') {
        actual.propinaEfectivo += prop;
      } else if (c.metodoPago === 'tarjeta') {
        actual.propinaTarjeta += prop;
      } else if (c.metodoPago === 'transferencia') {
        actual.propinaTransferencia += prop;
      } else if (c.metodoPago === 'mixto' && c.desgloseMixto) {
        if (c.desgloseMixto.metodo1 === 'tarjeta' || c.desgloseMixto.metodo2 === 'tarjeta') {
          actual.propinaTarjeta += prop;
        } else {
          actual.propinaEfectivo += prop;
        }
      } else {
        actual.propinaEfectivo += prop;
      }

      mapaMeseros.set(nombreMesero, actual);
    }

    const lista: ResumenPropinaMesero[] = Array.from(mapaMeseros.entries())
      .map(([mesero, datos]) => ({
        mesero,
        totalPropina: datos.totalPropina,
        cuentasCount: datos.cuentasCount,
        propinaEfectivo: datos.propinaEfectivo,
        propinaTarjeta: datos.propinaTarjeta,
        propinaTransferencia: datos.propinaTransferencia,
        porcentajeDelTotal: sumaTotal > 0 ? Math.round((datos.totalPropina / sumaTotal) * 100) : 0,
      }))
      .sort((a, b) => b.totalPropina - a.totalPropina);

    return {
      resumenPropinas: lista,
      totalPropinasCalculado: Math.max(sumaTotal, corteActual.totalPropinas ?? 0),
    };
  }, [cuentasCerradas, corteActual.totalPropinas]);

  const handleTeclaPin = (val: string): void => {
    setErrorPin(false);
    if (val === 'C') {
      setPinIngresado('');
    } else if (val === '⌫') {
      setPinIngresado((prev) => prev.slice(0, -1));
    } else if (pinIngresado.length < 4) {
      const nuevoPin = pinIngresado + val;
      setPinIngresado(nuevoPin);
      if (nuevoPin.length === 4) {
        if (nuevoPin === corteActual.pinSeguridad) {
          setDesbloqueado(true);
        } else {
          setErrorPin(true);
          setTimeout(() => setPinIngresado(''), 700);
        }
      }
    }
  };

  const handleReiniciarTurno = (): void => {
    const exito = reiniciarTurnoActual(corteActual.pinSeguridad);
    if (exito) {
      setMensajeReinicio('Turno cerrado, ventas archivadas en el historial y mesas liberadas exitosamente.');
      setConfirmandoReinicio(false);
      setTimeout(() => {
        setMensajeReinicio(null);
        onCerrar();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-stone-100">
        {/* Cabecera */}
        <div className="p-4 md:p-5 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-black text-lg md:text-xl text-amber-400">
                Historial y Corte de Caja
              </h3>
              <p className="text-xs text-stone-400">
                {formatearFechaCompleta(corteActual.fechaApertura)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Pestañas (Solo si está desbloqueado) */}
        {desbloqueado && (
          <div className="px-4 pt-3 pb-0 bg-stone-950 border-b border-stone-800/80">
            <div className="flex rounded-2xl bg-stone-900 p-1 border border-stone-800 gap-1">
              <button
                type="button"
                onClick={() => setPestanaActiva('actual')}
                className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  pestanaActiva === 'actual'
                    ? 'boton-oro-liquido shadow-md'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Turno Actual</span>
              </button>
              <button
                type="button"
                onClick={() => setPestanaActiva('calendario')}
                className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  pestanaActiva === 'calendario'
                    ? 'boton-oro-liquido shadow-md'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Historial (Calendario)</span>
              </button>
            </div>
          </div>
        )}

        {/* Contenido */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1">
          {!desbloqueado ? (
            /* Pantalla de Bloqueo por PIN */
            <div className="py-6 flex flex-col items-center justify-center max-w-xs mx-auto text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-black text-lg text-white">Ingresa el PIN de Administrador</h4>
                <p className="text-xs text-stone-400 mt-1">
                  Acceso restringido para corte de turno y métricas de venta.
                </p>
                <p className="text-[11px] text-amber-500 mt-0.5">PIN por defecto: 2430</p>
              </div>

              {/* Indicadores visuales de 4 dígitos */}
              <div className="flex gap-3 my-2">
                {[0, 1, 2, 3].map((idx) => {
                  const tieneValor = pinIngresado.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        errorPin
                          ? 'border-red-500 bg-red-500 animate-bounce'
                          : tieneValor
                          ? 'border-amber-400 bg-amber-400'
                          : 'border-stone-600 bg-stone-800'
                      }`}
                    />
                  );
                })}
              </div>

              {errorPin && (
                <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> PIN incorrecto, intenta de nuevo
                </p>
              )}

              {/* Teclado PIN táctil */}
              <div className="grid grid-cols-3 gap-2 w-full pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((tecla) => (
                  <button
                    key={tecla}
                    type="button"
                    onClick={() => handleTeclaPin(tecla)}
                    className="py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-95 font-bold text-lg text-stone-100 border border-stone-700/60 shadow-xs"
                  >
                    {tecla}
                  </button>
                ))}
              </div>
            </div>
          ) : pestanaActiva === 'calendario' ? (
            /* Vista de Calendario de Historial */
            <CalendarioHistorialTurnos />
          ) : (
            /* Vista del Turno Actual Desbloqueado */
            <div className="space-y-6">
              {mensajeReinicio && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-600 text-emerald-300 rounded-xl flex items-center gap-2 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>{mensajeReinicio}</span>
                </div>
              )}

              {/* Métricas Principales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex flex-col justify-between">
                  <span className="text-xs text-stone-400 flex items-center gap-1 font-semibold">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Venta Total
                  </span>
                  <span className="text-lg md:text-xl font-black text-emerald-400 mt-2">
                    {formatearMoneda(corteActual.totalVentas)}
                  </span>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex flex-col justify-between">
                  <span className="text-xs text-stone-400 flex items-center gap-1 font-semibold">
                    <Banknote className="w-3.5 h-3.5 text-amber-400" />
                    Efectivo
                  </span>
                  <span className="text-base md:text-lg font-black text-stone-100 mt-2">
                    {formatearMoneda(corteActual.totalEfectivo)}
                  </span>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex flex-col justify-between">
                  <span className="text-xs text-stone-400 flex items-center gap-1 font-semibold">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    Tarjetas
                  </span>
                  <span className="text-base md:text-lg font-black text-stone-100 mt-2">
                    {formatearMoneda(corteActual.totalTarjeta)}
                  </span>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex flex-col justify-between">
                  <span className="text-xs text-stone-400 flex items-center gap-1 font-semibold">
                    <QrCode className="w-3.5 h-3.5 text-blue-400" />
                    Transferencias
                  </span>
                  <span className="text-base md:text-lg font-black text-stone-100 mt-2">
                    {formatearMoneda(corteActual.totalTransferencia)}
                  </span>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-2xl border border-amber-600/40 bg-gradient-to-br from-stone-950 to-amber-950/20 flex flex-col justify-between col-span-2 sm:col-span-1">
                  <span className="text-xs text-amber-400 flex items-center gap-1 font-bold">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    Total Propinas
                  </span>
                  <span className="text-lg md:text-xl font-black text-amber-300 mt-2">
                    {formatearMoneda(totalPropinasCalculado)}
                  </span>
                </div>
              </div>

              {/* Resumen de Eficiencia */}
              <div className="grid grid-cols-2 gap-3 bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-amber-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-stone-400 block">Cuentas Cerradas</span>
                    <span className="text-lg font-black text-white">
                      {corteActual.cuentasCobradasCount} mesas
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-stone-400 block">Ticket Promedio</span>
                    <span className="text-lg font-black text-white">
                      {formatearMoneda(corteActual.ticketPromedio)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Módulo Especial: Distribución de Propinas por Mesero */}
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Propinas por Mesero ({resumenPropinas.length})
                  </h4>
                  <span className="text-xs font-black text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-full">
                    Total: {formatearMoneda(totalPropinasCalculado)}
                  </span>
                </div>

                {resumenPropinas.length === 0 ? (
                  <div className="p-4 text-center text-stone-500 bg-stone-900/60 rounded-xl border border-stone-800/60 text-xs">
                    No se han registrado propinas en las mesas cobradas de este turno.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resumenPropinas.map((item) => (
                      <div
                        key={item.mesero}
                        className="bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-xl flex flex-col justify-between transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="font-bold text-stone-100 text-sm">{item.mesero}</h5>
                              <p className="text-[11px] text-stone-400">
                                {item.cuentasCount} {item.cuentasCount === 1 ? 'mesa con propina' : 'mesas con propina'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-amber-400 block">
                              {formatearMoneda(item.totalPropina)}
                            </span>
                            <span className="text-[10px] font-semibold text-stone-400">
                              {item.porcentajeDelTotal}% del total
                            </span>
                          </div>
                        </div>

                        {/* Barra visual de proporción */}
                        <div className="w-full bg-stone-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-yellow-400 to-amber-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(5, item.porcentajeDelTotal))}%` }}
                          />
                        </div>

                        {/* Desglose de origen (Efectivo vs Tarjeta/Transf a liquidar de caja) */}
                        <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-300 flex-wrap gap-1">
                          <div className="flex items-center gap-1">
                            <Banknote className="w-3 h-3 text-emerald-400" />
                            <span>Efectivo: <strong>{formatearMoneda(item.propinaEfectivo)}</strong></span>
                          </div>
                          {(item.propinaTarjeta > 0 || item.propinaTransferencia > 0) && (
                            <div className="flex items-center gap-1 text-amber-300">
                              <CreditCard className="w-3 h-3 text-amber-400" />
                              <span>Tarjeta: <strong>{formatearMoneda(item.propinaTarjeta + item.propinaTransferencia)}</strong> (liquidar de caja)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de Cuentas Cerradas */}
              <div>
                <h4 className="font-extrabold text-sm text-stone-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  Historial de Mesas Cobradas ({cuentasCerradas.length})
                </h4>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {cuentasCerradas.length === 0 ? (
                    <div className="p-6 text-center text-stone-500 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                      Aún no hay cuentas cobradas en este turno.
                    </div>
                  ) : (
                    cuentasCerradas.map((cuenta) => (
                      <div
                        key={cuenta.id}
                        className="bg-stone-950 p-3 rounded-xl border border-stone-800 flex items-center justify-between text-xs hover:border-stone-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-100">{cuenta.nombreMesa}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold bg-stone-800 text-stone-300">
                              {cuenta.metodoPago ?? 'Efectivo'}
                            </span>
                          </div>
                          <p className="text-stone-400 text-[11px] mt-0.5">
                            Mesero: <strong className="text-stone-300">{cuenta.mesero}</strong> • Hora: {formatearHoraCorta(cuenta.horaCierre ?? cuenta.horaApertura)}
                          </p>
                          {cuenta.propina > 0 && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-950/90 text-amber-300 border border-amber-700/60 shadow-xs">
                                <Coins className="w-3 h-3 text-amber-400" />
                                Propina: {formatearMoneda(cuenta.propina)} → {cuenta.mesero}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-400 text-sm block">
                            {formatearMoneda(cuenta.total)}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {cuenta.items.length} platillos
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sección de Cierre y Reinicio de Turno */}
              <div className="pt-2 border-t border-stone-800">
                {confirmandoReinicio ? (
                  <div className="bg-red-950/40 border border-red-800/80 p-4 rounded-2xl space-y-3">
                    <p className="text-xs md:text-sm font-bold text-red-300">
                      ¿Seguro que deseas hacer el corte y reiniciar el turno? El turno actual con todas sus ventas y cuentas se archivará permanentemente en el historial, todas las mesas se liberarán a estado libre y el contador iniciará en $0.00.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmandoReinicio(false)}
                        className="flex-1 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleReiniciarTurno}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow"
                      >
                        Confirmar Reinicio
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoReinicio(true)}
                    className="w-full py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold text-xs md:text-sm flex items-center justify-center gap-2 border border-stone-700 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    Cerrar Turno / Reiniciar Corte
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
