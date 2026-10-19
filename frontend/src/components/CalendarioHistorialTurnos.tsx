import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Banknote,
  CreditCard,
  QrCode,
  Clock,
  Receipt,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Coins,
  ChefHat,
} from 'lucide-react';
import { useRestaurante } from '../context/RestauranteContext';
import type { TurnoCerrado, Cuenta } from '../types';
import {
  formatearMoneda,
  formatearHoraCorta,
  formatearFechaCompleta,
} from '../utils/formateadores';

const NOMBRES_MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Convierte un objeto Date o ISO string a clave YYYY-MM-DD local.
 */
function obtenerClaveFechaLocal(fechaInput: Date | string): string {
  const d = typeof fechaInput === 'string' ? new Date(fechaInput) : fechaInput;
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

interface CeldaDiaCalendario {
  readonly fecha: Date;
  readonly claveFecha: string;
  readonly numeroDia: number;
  readonly esDelMesActual: boolean;
  readonly esHoy: boolean;
  readonly turnos: readonly TurnoCerrado[];
  readonly totalVentasDia: number;
}

export const CalendarioHistorialTurnos: React.FC = () => {
  const { historialTurnos, corteActual, tema, cargarHistorialTurnos } = useRestaurante();

  const fechaHoy = useMemo(() => new Date(), []);
  const [mesActual, setMesActual] = useState<number>(() => fechaHoy.getMonth());
  const [anioActual, setAnioActual] = useState<number>(() => fechaHoy.getFullYear());
  const [claveDiaSeleccionado, setClaveDiaSeleccionado] = useState<string>(() =>
    obtenerClaveFechaLocal(fechaHoy)
  );
  const [turnosExpandidos, setTurnosExpandidos] = useState<Record<string, boolean>>({});
  const [cargandoRemoto, setCargandoRemoto] = useState<boolean>(false);

  // Cargar historial remoto de Supabase al montar
  useEffect(() => {
    cargarHistorialTurnos().catch((err: unknown) => {
      console.warn('[CalendarioHistorialTurnos] No se pudo sincronizar historial remoto:', err);
    });
  }, [cargarHistorialTurnos]);

  const alternarExpansionTurno = (turnoId: string): void => {
    setTurnosExpandidos((prev) => ({
      ...prev,
      [turnoId]: !prev[turnoId],
    }));
  };

  const handleRefrescar = async (): Promise<void> => {
    setCargandoRemoto(true);
    try {
      await cargarHistorialTurnos();
    } finally {
      setCargandoRemoto(false);
    }
  };

  const irAlMesAnterior = (): void => {
    if (mesActual === 0) {
      setMesActual(11);
      setAnioActual((prev) => prev - 1);
    } else {
      setMesActual((prev) => prev - 1);
    }
  };

  const irAlMesSiguiente = (): void => {
    if (mesActual === 11) {
      setMesActual(0);
      setAnioActual((prev) => prev + 1);
    } else {
      setMesActual((prev) => prev + 1);
    }
  };

  const irAHoy = (): void => {
    const hoy = new Date();
    setMesActual(hoy.getMonth());
    setAnioActual(hoy.getFullYear());
    setClaveDiaSeleccionado(obtenerClaveFechaLocal(hoy));
  };

  // Agrupar turnos por fecha YYYY-MM-DD
  const turnosPorFecha = useMemo(() => {
    const mapa = new Map<string, TurnoCerrado[]>();
    for (const turno of historialTurnos) {
      const clave = obtenerClaveFechaLocal(turno.fechaApertura);
      const lista = mapa.get(clave) ?? [];
      lista.push(turno);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [historialTurnos]);

  // Generar la matriz de días para el mes seleccionado
  const celdasCalendario = useMemo<CeldaDiaCalendario[]>(() => {
    const primerDiaMes = new Date(anioActual, mesActual, 1);
    const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0);

    // Ajuste de día de la semana (0 = Domingo -> cambiar a 6, 1 = Lunes -> 0)
    let diaInicioSemana = primerDiaMes.getDay() - 1;
    if (diaInicioSemana === -1) diaInicioSemana = 6;

    const celdas: CeldaDiaCalendario[] = [];
    const claveHoy = obtenerClaveFechaLocal(new Date());

    // Días del mes anterior para rellenar
    const diasMesAnterior = new Date(anioActual, mesActual, 0).getDate();
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
      const fecha = new Date(anioActual, mesActual - 1, diasMesAnterior - i);
      const clave = obtenerClaveFechaLocal(fecha);
      const turnos = turnosPorFecha.get(clave) ?? [];
      const totalVentasDia = turnos.reduce((acc, t) => acc + t.totalVentas, 0);
      celdas.push({
        fecha,
        claveFecha: clave,
        numeroDia: fecha.getDate(),
        esDelMesActual: false,
        esHoy: clave === claveHoy,
        turnos,
        totalVentasDia,
      });
    }

    // Días del mes actual
    for (let d = 1; d <= ultimoDiaMes.getDate(); d++) {
      const fecha = new Date(anioActual, mesActual, d);
      const clave = obtenerClaveFechaLocal(fecha);
      const turnos = turnosPorFecha.get(clave) ?? [];
      const totalVentasDia = turnos.reduce((acc, t) => acc + t.totalVentas, 0);
      celdas.push({
        fecha,
        claveFecha: clave,
        numeroDia: d,
        esDelMesActual: true,
        esHoy: clave === claveHoy,
        turnos,
        totalVentasDia,
      });
    }

    // Días del mes siguiente para completar la cuadrícula (hasta múltiplos de 7)
    const celdasRestantes = (7 - (celdas.length % 7)) % 7;
    for (let d = 1; d <= celdasRestantes; d++) {
      const fecha = new Date(anioActual, mesActual + 1, d);
      const clave = obtenerClaveFechaLocal(fecha);
      const turnos = turnosPorFecha.get(clave) ?? [];
      const totalVentasDia = turnos.reduce((acc, t) => acc + t.totalVentas, 0);
      celdas.push({
        fecha,
        claveFecha: clave,
        numeroDia: d,
        esDelMesActual: false,
        esHoy: clave === claveHoy,
        turnos,
        totalVentasDia,
      });
    }

    return celdas;
  }, [anioActual, mesActual, turnosPorFecha]);

  // Métricas del mes en curso
  const metricasMes = useMemo(() => {
    let totalMes = 0;
    let turnosMesCount = 0;
    for (const celda of celdasCalendario) {
      if (celda.esDelMesActual) {
        totalMes += celda.totalVentasDia;
        turnosMesCount += celda.turnos.length;
      }
    }
    return { totalMes, turnosMesCount };
  }, [celdasCalendario]);

  // Turnos del día seleccionado
  const turnosDiaSeleccionado = useMemo(() => {
    return turnosPorFecha.get(claveDiaSeleccionado) ?? [];
  }, [turnosPorFecha, claveDiaSeleccionado]);

  // Total ventas del día seleccionado
  const totalVentasDiaSeleccionado = useMemo(() => {
    return turnosDiaSeleccionado.reduce((acc, t) => acc + t.totalVentas, 0);
  }, [turnosDiaSeleccionado]);

  const esHoySeleccionado = useMemo(() => {
    return claveDiaSeleccionado === obtenerClaveFechaLocal(new Date());
  }, [claveDiaSeleccionado]);

  const esClaro = tema === 'claro';

  return (
    <div className="space-y-5 text-stone-100">
      {/* Barra de Navegación del Mes */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
          esClaro ? 'bg-stone-100 border-stone-200 text-stone-900' : 'bg-stone-950 border-stone-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-base sm:text-lg capitalize text-amber-400">
              {NOMBRES_MESES[mesActual]} {anioActual}
            </h4>
            <p className="text-[11px] text-stone-400">
              {metricasMes.turnosMesCount} turno(s) archivado(s) • Total:{' '}
              <span className="font-bold text-emerald-400">
                {formatearMoneda(metricasMes.totalMes)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <button
            type="button"
            onClick={irAHoy}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              esClaro
                ? 'bg-white hover:bg-stone-200 border-stone-300 text-stone-800'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleRefrescar}
            disabled={cargandoRemoto}
            title="Sincronizar turnos desde la nube"
            className={`p-2 rounded-xl text-xs transition-all border ${
              esClaro
                ? 'bg-white hover:bg-stone-200 border-stone-300 text-stone-800'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${cargandoRemoto ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={irAlMesAnterior}
            className={`p-2 rounded-xl text-xs transition-all border ${
              esClaro
                ? 'bg-white hover:bg-stone-200 border-stone-300 text-stone-800'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={irAlMesSiguiente}
            className={`p-2 rounded-xl text-xs transition-all border ${
              esClaro
                ? 'bg-white hover:bg-stone-200 border-stone-300 text-stone-800'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cuadrícula de Calendario */}
      <div
        className={`p-3 sm:p-4 rounded-2xl border ${
          esClaro ? 'bg-white border-stone-200' : 'bg-stone-950 border-stone-800'
        }`}
      >
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-stone-400 py-1"
            >
              {dia}
            </div>
          ))}
        </div>

        {/* Celdas de los días */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {celdasCalendario.map((celda) => {
            const estaSeleccionada = celda.claveFecha === claveDiaSeleccionado;
            const tieneTurnos = celda.turnos.length > 0;

            return (
              <button
                key={celda.claveFecha}
                type="button"
                onClick={() => setClaveDiaSeleccionado(celda.claveFecha)}
                className={`min-h-[58px] sm:min-h-[72px] p-1.5 sm:p-2 rounded-xl flex flex-col justify-between items-start transition-all text-left relative border cursor-pointer active:scale-95 ${
                  estaSeleccionada
                    ? 'ring-2 ring-amber-400 border-amber-500 bg-amber-500/15'
                    : tieneTurnos
                    ? esClaro
                      ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/70'
                      : 'bg-stone-900/80 border-stone-700 hover:bg-stone-800'
                    : esClaro
                    ? 'bg-stone-50 border-stone-200/60 hover:bg-stone-100 opacity-60'
                    : 'bg-stone-900/40 border-stone-800/60 hover:bg-stone-900 opacity-50'
                } ${!celda.esDelMesActual ? 'opacity-30' : ''}`}
              >
                {/* Cabecera de la celda: Número de día y badge de hoy */}
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`text-xs sm:text-sm font-extrabold ${
                      celda.esHoy
                        ? 'w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-xs'
                        : estaSeleccionada
                        ? 'text-amber-400 font-black'
                        : esClaro
                        ? 'text-stone-800'
                        : 'text-stone-200'
                    }`}
                  >
                    {celda.numeroDia}
                  </span>
                  {tieneTurnos && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs" />
                  )}
                </div>

                {/* Contenido inferior: Monto o turnos */}
                <div className="w-full mt-1">
                  {tieneTurnos ? (
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-black text-emerald-400 block truncate">
                        {formatearMoneda(celda.totalVentasDia)}
                      </span>
                      <span className="text-[9px] text-stone-400 hidden sm:block truncate">
                        {celda.turnos.length} turno(s)
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-stone-500 block truncate">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del Día Seleccionado */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
          esClaro ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-950 border-stone-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-base sm:text-lg text-amber-400">
                {formatearFechaCompleta(new Date(`${claveDiaSeleccionado}T12:00:00`))}
              </h4>
              {esHoySeleccionado && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  Hoy
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {turnosDiaSeleccionado.length === 0
                ? 'Sin turnos cerrados en esta fecha'
                : `${turnosDiaSeleccionado.length} turno(s) cerrado(s) registrado(s)`}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-stone-400 block">Venta Total del Día</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400">
              {formatearMoneda(totalVentasDiaSeleccionado)}
            </span>
          </div>
        </div>

        {/* Si es hoy y el corte en vivo tiene ventas, mostrar aviso */}
        {esHoySeleccionado && corteActual.totalVentas > 0 && (
          <div className="p-3 bg-amber-950/40 border border-amber-600/50 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Hay un turno <strong>en curso</strong> actualmente con ventas de{' '}
                <strong className="text-emerald-400">{formatearMoneda(corteActual.totalVentas)}</strong>.
              </span>
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
              En Vivo
            </span>
          </div>
        )}

        {/* Lista de Turnos del Día */}
        {turnosDiaSeleccionado.length === 0 ? (
          <div className="py-8 text-center text-stone-500 text-xs flex flex-col items-center justify-center space-y-2">
            <Receipt className="w-8 h-8 opacity-40 text-stone-500" />
            <p>No se registraron cierres de turno en esta fecha.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {turnosDiaSeleccionado.map((turno, index) => {
              const estaExpandido = Boolean(turnosExpandidos[turno.id]);
              const cuentas = turno.cuentasCobradas ?? [];

              return (
                <div
                  key={turno.id}
                  className={`rounded-2xl border p-4 space-y-3 transition-all ${
                    esClaro
                      ? 'bg-stone-50 border-stone-200'
                      : 'bg-stone-900/90 border-stone-700/80'
                  }`}
                >
                  {/* Encabezado del turno */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-black text-xs">
                        #{turnosDiaSeleccionado.length - index}
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-stone-100 flex items-center gap-1.5">
                          Turno {turnosDiaSeleccionado.length - index}
                        </span>
                        <p className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-500" />
                          {formatearHoraCorta(turno.fechaApertura)} -{' '}
                          {formatearHoraCorta(turno.fechaCierre)}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-stone-400 block font-semibold">Total Turno</span>
                      <span className="text-lg font-black text-emerald-400">
                        {formatearMoneda(turno.totalVentas)}
                      </span>
                    </div>
                  </div>

                  {/* Desglose Financiero */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800">
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold">
                        <Banknote className="w-3 h-3 text-amber-400" /> Efectivo
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-100 mt-1 block">
                        {formatearMoneda(turno.totalEfectivo)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800">
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold">
                        <CreditCard className="w-3 h-3 text-amber-400" /> Tarjeta
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-100 mt-1 block">
                        {formatearMoneda(turno.totalTarjeta)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800">
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold">
                        <QrCode className="w-3 h-3 text-blue-400" /> Transf.
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-100 mt-1 block">
                        {formatearMoneda(turno.totalTransferencia)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/60">
                      <span className="text-[10px] text-amber-400 flex items-center gap-1 font-bold">
                        <Coins className="w-3 h-3 text-amber-400" /> Propinas
                      </span>
                      <span className="text-xs sm:text-sm font-black text-amber-300 mt-1 block">
                        {formatearMoneda(
                          cuentas.reduce((acc, c) => acc + (Number(c.propina) || 0), Number(turno.totalPropinas) || 0)
                        )}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold">
                        <TrendingUp className="w-3 h-3 text-emerald-400" /> Mesas / Prom.
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-100 mt-1 block truncate">
                        {turno.cuentasCobradasCount} • {formatearMoneda(turno.ticketPromedio)}
                      </span>
                    </div>
                  </div>

                  {/* Botón Acordeón de Cuentas y Platillos */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => alternarExpansionTurno(turno.id)}
                      className="w-full py-2 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs font-bold text-amber-400 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" />
                        Ver mesas, platillos y propinas ({cuentas.length})
                      </span>
                      {estaExpandido ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {estaExpandido && (
                      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                        {cuentas.length === 0 ? (
                          <p className="text-[11px] text-stone-500 p-3 bg-stone-950/50 rounded-xl text-center">
                            No se conservaron detalles de cuentas para este turno archivado.
                          </p>
                        ) : (
                          cuentas.map((cta: Cuenta) => (
                            <div
                              key={cta.id}
                              className="p-2.5 bg-stone-950 rounded-xl border border-stone-800 space-y-1.5 text-xs hover:border-stone-700 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-stone-200">
                                    {cta.nombreMesa}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold bg-stone-800 text-stone-300">
                                    {cta.metodoPago ?? 'Efectivo'}
                                  </span>
                                </div>
                                <span className="font-black text-emerald-400">
                                  {formatearMoneda(cta.total)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-stone-400">
                                <span>Mesero: <strong className="text-stone-300">{cta.mesero}</strong></span>
                                <span>
                                  Hora: {formatearHoraCorta(cta.horaCierre ?? cta.horaApertura)}
                                </span>
                              </div>

                              {Number(cta.propina ?? 0) > 0 && (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-950/90 text-amber-300 border border-amber-700/60 shadow-xs">
                                    <Coins className="w-3 h-3 text-amber-400" />
                                    Propina: {formatearMoneda(cta.propina)} → {cta.mesero}
                                  </span>
                                </div>
                              )}

                              {/* Desglose de platillos */}
                              {cta.items && cta.items.length > 0 && (
                                <div className="pt-1 border-t border-stone-800/80 text-[11px] text-stone-300 space-y-0.5">
                                  {cta.items.map((it) => (
                                    <div key={it.id} className="flex justify-between">
                                      <span>
                                        {it.cantidad}x {it.nombre}
                                        {it.notas ? ` (${it.notas})` : ''}
                                      </span>
                                      <span className="text-stone-400">
                                        {formatearMoneda(it.precioUnitario * it.cantidad)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        {/* Sección de Comandas de Cocina Archivadas del Turno */}
                        {turno.pedidosCocinaArchivados && turno.pedidosCocinaArchivados.length > 0 && (
                          <div className="pt-2 border-t border-stone-800 space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1.5 px-1">
                              <ChefHat className="w-3.5 h-3.5" />
                              Comandas de Cocina Despachadas ({turno.pedidosCocinaArchivados.length})
                            </span>
                            {turno.pedidosCocinaArchivados.map((pedido) => (
                              <div
                                key={pedido.id}
                                className="p-2 bg-stone-950/80 rounded-lg border border-stone-800 text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between text-stone-300 font-bold">
                                  <span>{pedido.nombreMesa} (Mesero: {pedido.mesero})</span>
                                  <span className="text-stone-500 font-normal">
                                    {formatearHoraCorta(pedido.horaEnvio)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 text-[10px] text-stone-400">
                                  {pedido.items.map((it) => (
                                    <span
                                      key={it.id}
                                      className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300"
                                    >
                                      {it.cantidad}x {it.nombre}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
