import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Banknote,
  CreditCard,
  QrCode,
  DollarSign,
  Percent,
  Users,
  Layers,
  Sparkles,
  Printer,
  FileText,
} from 'lucide-react';
import type { MetodoPago, DesglosePagoMixto, DivisionCuentaInfo, Cuenta } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearMoneda } from '../utils/formateadores';
import { LienzoOroLiquido } from './LienzoOroLiquido';
import { BotonOroLiquido } from './BotonOroLiquido';
import { ModalFacturacionSat } from './ModalFacturacionSat';

interface ModalCobroProps {
  onCerrar: () => void;
  onCobroExitoso: () => void;
}

export const ModalCobro: React.FC<ModalCobroProps> = ({ onCerrar, onCobroExitoso }) => {
  const { mesaSeleccionada, cuentaActiva, cerrarYCobrarCuenta, imprimirTicket } = useRestaurante();

  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [porcentajePropina, setPorcentajePropina] = useState<number>(10);
  const [efectivoRecibidoTexto, setEfectivoRecibidoTexto] = useState<string>('');
  const [cobroProcesado, setCobroProcesado] = useState<boolean>(false);
  const [cuentaFinalCerrada, setCuentaFinalCerrada] = useState<Cuenta | null>(null);
  const [modalFacturacionAbierto, setModalFacturacionAbierto] = useState<boolean>(false);

  // Estados para División de Cuenta
  const [personasDivision, setPersonasDivision] = useState<number>(1);

  // Estados para Pago Mixto (2 Métodos de pago)
  const [metodoMixto1, setMetodoMixto1] = useState<MetodoPago>('efectivo');
  const [montoMixto1Texto, setMontoMixto1Texto] = useState<string>('');
  const [metodoMixto2, setMetodoMixto2] = useState<MetodoPago>('tarjeta');

  // Estado congelado para preservar los datos de cobro en pantalla de éxito
  const [resumenExito, setResumenExito] = useState<{
    nombreMesa: string;
    totalAPagar: number;
    cambioCalculado: number;
    metodoPago: MetodoPago;
    metodoMixto1?: MetodoPago;
    metodoMixto2?: MetodoPago;
    montoMixto1?: number;
    montoMixto2?: number;
    personasDivision: number;
    montoPorPersona: number;
  } | null>(null);

  // Si no se ha procesado el cobro, requerimos mesa y cuenta activa
  if (!cobroProcesado && (!mesaSeleccionada || !cuentaActiva)) {
    return null;
  }

  const subtotal = cuentaActiva?.subtotal ?? 0;
  const propina = Math.round((subtotal * porcentajePropina) / 100);
  const totalAPagar = subtotal + propina;

  // Cálculo de división por persona
  const montoPorPersona = Math.round((totalAPagar / Math.max(1, personasDivision)) * 100) / 100;

  // Cálculo para Pago Mixto
  const montoMixto1 = parseFloat(montoMixto1Texto) || 0;
  const montoMixto2 = Math.max(0, totalAPagar - montoMixto1);

  // Manejo de cambio en efectivo
  let efectivoRecibidoNumero = 0;
  let cambio = 0;
  let efectivoEsSuficiente = true;

  if (metodoPago === 'efectivo') {
    efectivoRecibidoNumero = parseFloat(efectivoRecibidoTexto) || 0;
    cambio = Math.max(0, efectivoRecibidoNumero - totalAPagar);
    efectivoEsSuficiente = efectivoRecibidoNumero >= totalAPagar;
  } else if (metodoPago === 'mixto') {
    const hayEfectivoEnMixto = metodoMixto1 === 'efectivo' || metodoMixto2 === 'efectivo';
    const montoEfectivoRequerido = metodoMixto1 === 'efectivo' ? montoMixto1 : metodoMixto2 === 'efectivo' ? montoMixto2 : 0;

    if (hayEfectivoEnMixto && montoEfectivoRequerido > 0) {
      efectivoRecibidoNumero = parseFloat(efectivoRecibidoTexto) || 0;
      cambio = Math.max(0, efectivoRecibidoNumero - montoEfectivoRequerido);
      efectivoEsSuficiente = efectivoRecibidoNumero >= montoEfectivoRequerido;
    } else {
      efectivoEsSuficiente = montoMixto1 > 0 && montoMixto1 < totalAPagar;
    }
  }

  // Billetes sugeridos
  const objetivoBilletes = metodoPago === 'mixto' && (metodoMixto1 === 'efectivo' || metodoMixto2 === 'efectivo')
    ? (metodoMixto1 === 'efectivo' ? montoMixto1 : montoMixto2)
    : totalAPagar;

  const billetesSugeridos = [100, 200, 500, 1000].filter((b) => b >= objetivoBilletes || b >= 100);

  const handleTeclaNumerica = (valor: string): void => {
    if (valor === 'C') {
      setEfectivoRecibidoTexto('');
    } else if (valor === '⌫') {
      setEfectivoRecibidoTexto((prev) => prev.slice(0, -1));
    } else {
      setEfectivoRecibidoTexto((prev) => prev + valor);
    }
  };

  const handleProcesarCobro = (): void => {
    if (!mesaSeleccionada || !efectivoEsSuficiente) return;

    let desgloseMixto: DesglosePagoMixto | undefined;
    if (metodoPago === 'mixto') {
      desgloseMixto = {
        metodo1: metodoMixto1,
        monto1: montoMixto1,
        metodo2: metodoMixto2,
        monto2: montoMixto2,
      };
    }

    let divisionCuenta: DivisionCuentaInfo | undefined;
    if (personasDivision > 1) {
      divisionCuenta = {
        personas: personasDivision,
        montoPorPersona,
      };
    }

    const nombreMesaFinal = mesaSeleccionada.nombre;
    const totalAPagarFinal = totalAPagar;
    const cambioFinal = cambio;
    const metodoPagoFinal = metodoPago;
    const metodoMixto1Final = metodoMixto1;
    const metodoMixto2Final = metodoMixto2;
    const montoMixto1Final = montoMixto1;
    const montoMixto2Final = montoMixto2;
    const personasDivisionFinal = personasDivision;
    const montoPorPersonaFinal = montoPorPersona;

    const resultado = cerrarYCobrarCuenta(
      mesaSeleccionada.id,
      metodoPago,
      propina,
      metodoPago === 'efectivo' ? efectivoRecibidoNumero : totalAPagar,
      desgloseMixto,
      divisionCuenta
    );

    if (resultado.exito) {
      if (resultado.cuentaCerrada) {
        setCuentaFinalCerrada(resultado.cuentaCerrada);
      }
      setResumenExito({
        nombreMesa: nombreMesaFinal,
        totalAPagar: totalAPagarFinal,
        cambioCalculado: cambioFinal,
        metodoPago: metodoPagoFinal,
        metodoMixto1: metodoMixto1Final,
        metodoMixto2: metodoMixto2Final,
        montoMixto1: montoMixto1Final,
        montoMixto2: montoMixto2Final,
        personasDivision: personasDivisionFinal,
        montoPorPersona: montoPorPersonaFinal,
      });
      setCobroProcesado(true);
    }
  };

  const handleFinalizar = (conTicket: boolean): void => {
    if (conTicket && cuentaFinalCerrada) {
      imprimirTicket('cliente', cuentaFinalCerrada);
    }
    onCobroExitoso();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-stone-900 border border-amber-500/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden text-stone-100 anim-entrada-modal sombra-dorada-intensa max-h-[94dvh] flex flex-col">
        {/* Cabecera */}
        <div className="p-3.5 sm:p-5 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-black tracking-wider text-amber-500">
              Caja Registradora
            </span>
            <h3 className="text-lg sm:text-2xl font-black text-amber-400">
              {cobroProcesado
                ? `Cobro Exitoso · ${resumenExito?.nombreMesa ?? 'Mesa'}`
                : `Cobrar ${mesaSeleccionada?.nombre ?? 'Mesa'}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={cobroProcesado ? () => handleFinalizar(false) : onCerrar}
            className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-3 sm:p-5 md:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {!cobroProcesado ? (
            <>
              {/* Opción 1: Dividir la Cuenta */}
              <div className="bg-stone-950/80 p-3 sm:p-4 rounded-2xl border border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Dividir la Cuenta (Cuentas Separadas)</span>
                  </label>
                  {personasDivision > 1 && (
                    <span className="text-xs font-extrabold text-emerald-400">
                      {formatearMoneda(montoPorPersona)} / pers.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPersonasDivision(num)}
                      className={`flex-1 min-w-[50px] py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        personasDivision === num
                          ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {num === 1 ? '1 Solo' : `${num} partes`}
                    </button>
                  ))}
                </div>

                {personasDivision > 1 && (
                  <div className="mt-2.5 p-2 bg-amber-950/30 border border-amber-600/30 rounded-xl text-xs text-amber-200 flex justify-between items-center">
                    <span>
                      Total: {formatearMoneda(totalAPagar)} dividido entre <strong>{personasDivision} personas</strong>
                    </span>
                    <span className="font-black text-amber-400 text-sm">
                      {formatearMoneda(montoPorPersona)} cada una
                    </span>
                  </div>
                )}
              </div>

              {/* Selección de Método de Pago */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMetodoPago('efectivo');
                      setEfectivoRecibidoTexto('');
                    }}
                    className={`p-3 rounded-2xl font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                      metodoPago === 'efectivo'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-300" />
                    <span className="text-xs sm:text-sm">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMetodoPago('tarjeta');
                      setEfectivoRecibidoTexto(totalAPagar.toString());
                    }}
                    className={`p-3 rounded-2xl font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                      metodoPago === 'tarjeta'
                        ? 'boton-oro-liquido shadow-lg font-black'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <CreditCard className={`w-5 h-5 ${metodoPago === 'tarjeta' ? 'text-stone-950' : 'text-amber-400'}`} />
                    <span className="text-xs sm:text-sm">Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMetodoPago('transferencia');
                      setEfectivoRecibidoTexto(totalAPagar.toString());
                    }}
                    className={`p-3 rounded-2xl font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                      metodoPago === 'transferencia'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-blue-300" />
                    <span className="text-xs sm:text-sm">Transferencia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMetodoPago('mixto');
                      setMontoMixto1Texto(Math.round(totalAPagar / 2).toString());
                      setEfectivoRecibidoTexto('');
                    }}
                    className={`p-3 rounded-2xl font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                      metodoPago === 'mixto'
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <Layers className="w-5 h-5 text-purple-300" />
                    <span className="text-xs sm:text-sm">2 Métodos</span>
                  </button>
                </div>
              </div>

              {/* SECCIÓN ESPECIAL: Pago Mixto / Combinado */}
              {metodoPago === 'mixto' && (
                <div className="bg-stone-950 p-3.5 sm:p-4 rounded-2xl border border-purple-500/50 space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase">
                    <Layers className="w-4 h-4" />
                    <span>Configurar los 2 Métodos de Pago</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Método 1 */}
                    <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                      <span className="text-[11px] font-bold text-stone-400 block mb-1">Método 1:</span>
                      <div className="flex gap-1 mb-2">
                        {(['efectivo', 'tarjeta', 'transferencia'] as MetodoPago[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMetodoMixto1(m)}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                              metodoMixto1 === m ? 'bg-purple-600 text-white' : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 bg-stone-950 p-2 rounded-lg border border-stone-800">
                        <span className="text-xs text-stone-400 font-bold">$</span>
                        <input
                          type="number"
                          value={montoMixto1Texto}
                          onChange={(e) => setMontoMixto1Texto(e.target.value)}
                          placeholder="Monto 1"
                          className="w-full bg-transparent text-sm font-black text-amber-400 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Método 2 (Calculado Automático) */}
                    <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                      <span className="text-[11px] font-bold text-stone-400 block mb-1">Método 2 (Restante):</span>
                      <div className="flex gap-1 mb-2">
                        {(['tarjeta', 'transferencia', 'efectivo'] as MetodoPago[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMetodoMixto2(m)}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                              metodoMixto2 === m ? 'bg-purple-600 text-white' : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between bg-stone-950 p-2 rounded-lg border border-stone-800">
                        <span className="text-xs text-stone-400">Restante a cobrar:</span>
                        <span className="text-sm font-black text-emerald-400">
                          {formatearMoneda(montoMixto2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selección de Propina */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-400" />
                    Propina del Servicio
                  </span>
                  <span className="text-amber-400 font-bold">{formatearMoneda(propina)}</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPorcentajePropina(pct)}
                      className={`py-2 rounded-xl text-xs sm:text-sm font-bold border active:scale-95 transition-all cursor-pointer ${
                        porcentajePropina === pct
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      {pct === 0 ? 'Sin propina' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumen Total */}
              <div className="bg-stone-950 p-3.5 sm:p-4 rounded-2xl border border-stone-800 space-y-1.5">
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Subtotal consumo:</span>
                  <span>{formatearMoneda(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Propina ({porcentajePropina}%):</span>
                  <span>{formatearMoneda(propina)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-stone-800">
                  <span className="font-extrabold text-sm sm:text-base text-stone-200">Total a Liquidar:</span>
                  <span className="font-black text-2xl sm:text-3xl text-emerald-400 tabular-nums">
                    {formatearMoneda(totalAPagar)}
                  </span>
                </div>
              </div>

              {/* Sección de Pago en Efectivo (Directo o en Pago Mixto) */}
              {(metodoPago === 'efectivo' || (metodoPago === 'mixto' && (metodoMixto1 === 'efectivo' || metodoMixto2 === 'efectivo'))) && (
                <div className="space-y-3">
                  {/* Billetes rápidos */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                      Billetes Rápidos Recibidos (Efectivo)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEfectivoRecibidoTexto(objetivoBilletes.toString())}
                        className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 font-bold text-xs text-amber-300 border border-stone-700 active:scale-95 cursor-pointer"
                      >
                        Exacto ({formatearMoneda(objetivoBilletes)})
                      </button>
                      {billetesSugeridos.map((billete) => (
                        <button
                          key={billete}
                          type="button"
                          onClick={() => setEfectivoRecibidoTexto(billete.toString())}
                          className="py-2 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 font-black text-xs border border-emerald-800/60 active:scale-95 cursor-pointer"
                        >
                          ${billete}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input de monto recibido y cálculo de cambio */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    <div className="bg-stone-950 p-2.5 sm:p-3 rounded-xl border border-stone-800">
                      <span className="text-[11px] font-bold text-stone-400 block mb-0.5">
                        Efectivo Recibido:
                      </span>
                      <div className="flex items-center gap-1 text-lg sm:text-xl font-black text-white">
                        <span>$</span>
                        <input
                          type="number"
                          value={efectivoRecibidoTexto}
                          onChange={(e) => setEfectivoRecibidoTexto(e.target.value)}
                          placeholder="0.00"
                          className="bg-transparent w-full focus:outline-hidden text-emerald-400 font-mono text-base sm:text-xl"
                        />
                      </div>
                    </div>

                    <div className="bg-stone-950 p-2.5 sm:p-3 rounded-xl border border-stone-800">
                      <span className="text-[11px] font-bold text-stone-400 block mb-0.5">
                        Cambio a Regresar:
                      </span>
                      <span
                        className={`text-xl sm:text-2xl font-black font-mono tabular-nums ${
                          efectivoEsSuficiente ? 'text-amber-400' : 'text-stone-600'
                        }`}
                      >
                        {formatearMoneda(cambio)}
                      </span>
                    </div>
                  </div>

                  {/* Teclado numérico táctil */}
                  <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((tecla) => (
                      <button
                        key={tecla}
                        type="button"
                        onClick={() => handleTeclaNumerica(tecla)}
                        className="py-2 sm:py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 font-bold text-sm sm:text-base text-stone-200 border border-stone-700/60 transition-all cursor-pointer"
                      >
                        {tecla}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Vista de Cobro Exitoso con Sello Dorado de Lujo */
            <div className="text-center py-6 sm:py-8 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                {/* Aura ambiental dorada pulsante */}
                <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-xl animate-pulse" />
                <div className="relative w-full h-full rounded-full overflow-hidden p-1 shadow-2xl border-2 border-amber-300/80">
                  <LienzoOroLiquido
                    className="absolute inset-0 w-full h-full"
                    velocidad={0.9}
                    brillo={1.2}
                    densidadOndas={1.1}
                  />
                  <div className="relative z-10 w-full h-full rounded-full bg-stone-950/85 backdrop-blur-xs flex items-center justify-center border border-amber-400/60">
                    <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 stroke-[2.5]" />
                  </div>
                </div>
                <Sparkles className="w-5 h-5 text-amber-300 absolute -top-1 -right-1 animate-bounce" />
              </div>

              <div>
                <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-amber-400/90 bg-amber-950/60 border border-amber-700/60 px-3 py-1 rounded-full">
                  Transacción Finalizada
                </span>
                <h4 className="text-2xl sm:text-3xl font-black text-amber-300 mt-2 tracking-tight">
                  ¡Cobro Registrado con Éxito!
                </h4>
                <p className="text-xs sm:text-sm text-stone-400 mt-1">
                  {resumenExito?.nombreMesa ?? 'La mesa'} ha sido liberada y registrada en el corte.
                </p>
              </div>

              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 max-w-sm mx-auto text-left space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">Total cobrado:</span>
                  <span className="font-bold text-amber-400">
                    {formatearMoneda(resumenExito?.totalAPagar ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Método de pago:</span>
                  <span className="font-bold uppercase text-stone-200">
                    {resumenExito?.metodoPago === 'mixto'
                      ? `${resumenExito.metodoMixto1} + ${resumenExito.metodoMixto2}`
                      : resumenExito?.metodoPago}
                  </span>
                </div>
                {resumenExito?.metodoPago === 'mixto' && (
                  <div className="text-[11px] text-stone-400 pl-2 border-l border-amber-500 space-y-0.5">
                    <div>{resumenExito.metodoMixto1}: {formatearMoneda(resumenExito.montoMixto1 ?? 0)}</div>
                    <div>{resumenExito.metodoMixto2}: {formatearMoneda(resumenExito.montoMixto2 ?? 0)}</div>
                  </div>
                )}
                {(resumenExito?.personasDivision ?? 1) > 1 && (
                  <div className="flex justify-between text-xs text-amber-400 pt-1 border-t border-stone-800">
                    <span>Dividido entre:</span>
                    <span className="font-bold">
                      {resumenExito?.personasDivision} personas ({formatearMoneda(resumenExito?.montoPorPersona ?? 0)} c/u)
                    </span>
                  </div>
                )}
                {(resumenExito?.cambioCalculado ?? 0) > 0 && (
                  <div className="flex justify-between pt-2 border-t border-stone-800">
                    <span className="text-stone-400">Cambio devuelto:</span>
                    <span className="font-black text-amber-400 text-base sm:text-lg">
                      {formatearMoneda(resumenExito?.cambioCalculado ?? 0)}
                    </span>
                  </div>
                )}

                {/* Opción Rápida de Facturación CFDI 4.0 */}
                <button
                  type="button"
                  onClick={() => setModalFacturacionAbierto(true)}
                  className="w-full mt-2.5 py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <FileText className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                  <span>🧾 Solicitar Factura (CFDI 4.0 SAT)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Acciones */}
        <div className="p-3 sm:p-4 border-t border-stone-800 bg-stone-950 shrink-0 sticky bottom-0 z-20">
          {!cobroProcesado ? (
            <button
              type="button"
              onClick={handleProcesarCobro}
              disabled={!efectivoEsSuficiente}
              className="w-full py-3 sm:py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-black text-sm sm:text-base md:text-lg shadow-xl shadow-emerald-950/70 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] shrink-0" />
              <span className="truncate">Confirmar Cobro ({formatearMoneda(totalAPagar)})</span>
            </button>
          ) : (
            <div className="flex gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => handleFinalizar(false)}
                className="flex-1 py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
              >
                Cerrar sin Ticket
              </button>
              <BotonOroLiquido
                onClick={() => handleFinalizar(true)}
                className="flex-1 py-3.5 rounded-2xl text-xs sm:text-sm"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Imprimir Ticket y Salir</span>
              </BotonOroLiquido>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Facturación CFDI 4.0 */}
      {modalFacturacionAbierto && (cuentaFinalCerrada || cuentaActiva) && (
        <ModalFacturacionSat
          cuenta={cuentaFinalCerrada ?? cuentaActiva!}
          nombreMesa={resumenExito?.nombreMesa ?? 'Mesa'}
          onClose={() => setModalFacturacionAbierto(false)}
          onImprimirTicketFiscal={() => {
            setModalFacturacionAbierto(false);
            handleFinalizar(true);
          }}
        />
      )}
    </div>
  );
};
export default ModalCobro;
