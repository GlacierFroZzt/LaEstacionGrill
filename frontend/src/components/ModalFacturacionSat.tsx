import React, { useState, useMemo } from 'react';
import {
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Printer,
  Mail,
  FileCheck,
  Info,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import type { Cuenta } from '../types';
import type { DatosReceptorFactura, FacturaRegistrada } from '../types/facturacion';
import {
  CATALOGO_REGIMENES_SAT,
  CATALOGO_USOS_CFDI_SAT,
} from '../data/catalogosSat';
import { servicioFacturacion } from '../services/servicioFacturacion';
import { servicioEnvioCorreo } from '../services/servicioEnvioCorreo';
import { formatearMoneda } from '../utils/formateadores';

export interface PropsModalFacturacionSat {
  readonly cuenta: Cuenta;
  readonly nombreMesa: string;
  readonly onClose: () => void;
  readonly onFacturaGuardada?: (factura: FacturaRegistrada) => void;
  readonly onImprimirTicketFiscal?: (factura: FacturaRegistrada) => void;
}

export const ModalFacturacionSat: React.FC<PropsModalFacturacionSat> = ({
  cuenta,
  nombreMesa,
  onClose,
  onFacturaGuardada,
  onImprimirTicketFiscal,
}) => {
  // Buscar si ya existe una factura previa para esta cuenta
  const facturaExistente = useMemo(
    () => servicioFacturacion.buscarFacturaPorCuentaId(cuenta.id),
    [cuenta.id]
  );

  const [rfc, setRfc] = useState<string>(facturaExistente?.receptor.rfc ?? '');
  const [razonSocial, setRazonSocial] = useState<string>(
    facturaExistente?.receptor.razonSocial ?? ''
  );
  const [codigoPostal, setCodigoPostal] = useState<string>(
    facturaExistente?.receptor.codigoPostal ?? ''
  );
  const [regimenFiscal, setRegimenFiscal] = useState<string>(
    facturaExistente?.receptor.regimenFiscal ?? '612'
  );
  const [usoCfdi, setUsoCfdi] = useState<string>(
    facturaExistente?.receptor.usoCfdi ?? 'G03'
  );
  const [email, setEmail] = useState<string>(
    facturaExistente?.receptor.email ?? ''
  );
  const [telefono, setTelefono] = useState<string>(
    facturaExistente?.receptor.telefono ?? ''
  );

  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [facturaGuardada, setFacturaGuardada] = useState<FacturaRegistrada | null>(
    facturaExistente
  );
  const [guardando, setGuardando] = useState<boolean>(false);
  const [estadoEnvio, setEstadoEnvio] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Desglose de impuestos (Regla SAT: la propina no causa IVA)
  const propina = cuenta.propina ?? 0;
  const desglose = useMemo(
    () => servicioFacturacion.calcularDesglose(cuenta.total, propina),
    [cuenta.total, propina]
  );

  // Validación de RFC en tiempo real
  const infoRfc = useMemo(
    () => (rfc ? servicioFacturacion.validarRfc(rfc) : null),
    [rfc]
  );

  // Filtrar regímenes según el tipo de persona (física / moral)
  const regímenesFiltrados = useMemo(() => {
    if (!infoRfc || infoRfc.tipo === 'invalido') {
      return CATALOGO_REGIMENES_SAT;
    }
    if (infoRfc.tipo === 'moral') {
      return CATALOGO_REGIMENES_SAT.filter((r) => r.aplicaMoral);
    }
    return CATALOGO_REGIMENES_SAT.filter((r) => r.aplicaFisica);
  }, [infoRfc]);

  const handleRfcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, '');
    if (valor.length <= 13) {
      setRfc(valor);
      setErrorValidacion(null);
    }
  };

  const handleCodigoPostalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '');
    if (valor.length <= 5) {
      setCodigoPostal(valor);
      setErrorValidacion(null);
    }
  };

  const handleRfcGenerico = () => {
    setRfc('XAXX010101000');
    setRazonSocial('PUBLICO EN GENERAL');
    setCodigoPostal('67300'); // CP de Santiago / El Cercado NL
    setRegimenFiscal('616');
    setUsoCfdi('S01');
    setErrorValidacion(null);
  };

  const handleConfirmarFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    // 1. Validar RFC
    const validacionRfc = servicioFacturacion.validarRfc(rfc);
    if (!validacionRfc.valido) {
      setErrorValidacion(validacionRfc.mensaje ?? 'El RFC ingresado es inválido.');
      return;
    }

    // 2. Validar Razón Social
    if (razonSocial.trim().length < 3) {
      setErrorValidacion('La Razón Social o Nombre del cliente es obligatorio.');
      return;
    }

    // 3. Validar Código Postal
    if (!servicioFacturacion.validarCodigoPostal(codigoPostal)) {
      setErrorValidacion('El Código Postal fiscal debe contener exactamente 5 dígitos numéricos.');
      return;
    }

    // 4. Validar Correo
    if (!email.trim() || !email.includes('@')) {
      setErrorValidacion('Ingresa un correo electrónico válido para el envío de los archivos XML y PDF.');
      return;
    }

    setGuardando(true);
    try {
      const receptor: DatosReceptorFactura = {
        rfc: rfc.trim().toUpperCase(),
        razonSocial: razonSocial.trim().toUpperCase(),
        codigoPostal: codigoPostal.trim(),
        regimenFiscal,
        usoCfdi,
        email: email.trim().toLowerCase(),
        telefono: telefono.trim() || undefined,
      };

      const folioTicket = `TKT-${cuenta.numeroMesa}-${cuenta.id.substring(0, 6).toUpperCase()}`;

      const nuevaFactura = servicioFacturacion.construirFactura({
        cuentaId: cuenta.id,
        mesaId: cuenta.mesaId,
        nombreMesa,
        folioTicket,
        totalPagado: cuenta.total,
        propina,
        metodoPagoPos: cuenta.metodoPago ?? 'efectivo',
        receptor,
      });

      await servicioFacturacion.guardarFactura(nuevaFactura);
      setFacturaGuardada(nuevaFactura);

      // Si se proporcionó correo electrónico, abrir de inmediato el gestor de correo listo para enviar
      if (nuevaFactura.receptor.email) {
        const resultadoEnvio = servicioEnvioCorreo.abrirClienteCorreo(nuevaFactura);
        setEstadoEnvio(resultadoEnvio.mensaje);
      }

      if (onFacturaGuardada) {
        onFacturaGuardada(nuevaFactura);
      }
    } catch (err: unknown) {
      console.error('[ModalFacturacionSat] Error al guardar factura:', err);
      setErrorValidacion('Ocurrió un error inesperado al registrar la factura.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-stone-900 border border-amber-500/40 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] anim-entrada-modal">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 flex items-center justify-center font-black shadow-md">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg text-amber-400">
                  Facturación CFDI 4.0 (SAT)
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  México
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {nombreMesa} · Cuenta #{cuenta.id.substring(0, 8)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Pantalla de Éxito si ya está registrada */}
          {facturaGuardada ? (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400">
                <FileCheck className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-3 py-1 rounded-full">
                  Solicitud Registrada
                </span>
                <h4 className="text-xl sm:text-2xl font-black text-stone-100 mt-2">
                  ¡Datos Fiscales Vinculados!
                </h4>
                <p className="text-xs text-stone-400 mt-1 max-w-md mx-auto">
                  La factura con folio{' '}
                  <strong className="text-amber-400">{facturaGuardada.folioTicket}</strong> ha
                  sido guardada con éxito para {facturaGuardada.receptor.razonSocial}.
                </p>
              </div>

              {/* Tarjeta Resumen Fiscal */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-stone-800/80 pb-2">
                  <span className="text-stone-400 font-bold">RFC:</span>
                  <span className="font-mono font-black text-amber-300">
                    {facturaGuardada.receptor.rfc}
                  </span>
                </div>
                <div className="flex justify-between border-b border-stone-800/80 pb-2">
                  <span className="text-stone-400 font-bold">Razón Social:</span>
                  <span className="font-bold text-stone-200">
                    {facturaGuardada.receptor.razonSocial}
                  </span>
                </div>
                <div className="flex justify-between border-b border-stone-800/80 pb-2">
                  <span className="text-stone-400 font-bold">Código Postal:</span>
                  <span className="font-mono text-stone-200">
                    {facturaGuardada.receptor.codigoPostal}
                  </span>
                </div>
                <div className="flex justify-between border-b border-stone-800/80 pb-2">
                  <span className="text-stone-400 font-bold">Uso CFDI:</span>
                  <span className="text-stone-200 font-bold">
                    {facturaGuardada.receptor.usoCfdi}
                  </span>
                </div>
                <div className="flex justify-between border-b border-stone-800/80 pb-2">
                  <span className="text-stone-400 font-bold">Correo de Envío:</span>
                  <span className="text-amber-300 font-medium">
                    {facturaGuardada.receptor.email}
                  </span>
                </div>

                {/* Desglose de Montos */}
                <div className="pt-2 space-y-1 bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                  <div className="flex justify-between text-stone-400">
                    <span>Base Gravable (Alimentos sin IVA):</span>
                    <span className="font-mono text-stone-300">
                      {formatearMoneda(facturaGuardada.desglose.subtotalSinIva)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>IVA Trasladado (16%):</span>
                    <span className="font-mono text-stone-300">
                      {formatearMoneda(facturaGuardada.desglose.iva16)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-100 font-black text-sm pt-1 border-t border-stone-800">
                    <span>Total Facturado:</span>
                    <span className="font-mono text-amber-400">
                      {formatearMoneda(facturaGuardada.desglose.totalConsumoConIva)}
                    </span>
                  </div>
                  {facturaGuardada.desglose.propinaExcluida > 0 && (
                    <div className="flex justify-between text-[11px] text-stone-500 italic pt-0.5">
                      <span>* Propina voluntaria excluida (sin IVA):</span>
                      <span className="font-mono">
                        {formatearMoneda(facturaGuardada.desglose.propinaExcluida)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notificación de Estado de Envío */}
              {estadoEnvio && (
                <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-300 text-xs flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{estadoEnvio}</span>
                </div>
              )}

              {/* Botones de acción final de Facturación */}
              <div className="space-y-2 pt-1">
                {facturaGuardada.receptor.email && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = servicioEnvioCorreo.abrirClienteCorreo(facturaGuardada);
                      setEstadoEnvio(res.mensaje);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 cursor-pointer transition-all active:scale-95"
                  >
                    <Mail className="w-4 h-4 stroke-[2.5]" />
                    <span>Enviar Correo a {facturaGuardada.receptor.email}</span>
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await servicioEnvioCorreo.compartirComprobante(facturaGuardada);
                      setEstadoEnvio(res.mensaje);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                    title="Compartir por WhatsApp, Correo u otras aplicaciones"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartir Comprobante</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await servicioEnvioCorreo.copiarAlPortapapeles(facturaGuardada);
                      if (res.exito) {
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2500);
                      }
                      setEstadoEnvio(res.mensaje);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-stone-700"
                    title="Copiar texto formal al portapapeles"
                  >
                    {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiado ? '¡Copiado!' : 'Copiar al Portapapeles'}</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  {onImprimirTicketFiscal && (
                    <button
                      type="button"
                      onClick={() => onImprimirTicketFiscal(facturaGuardada)}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
                    >
                      <Printer className="w-4 h-4 stroke-[2.5]" />
                      <span>Imprimir Ticket con Datos Fiscales</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-6 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs sm:text-sm cursor-pointer transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Formulario de Captura Fiscal */
            <form onSubmit={handleConfirmarFactura} className="space-y-4">
              {/* Tarjeta de Resumen de Consumo */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-300/80 block">
                    Consumo Sujeto a Facturación
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-amber-400">
                      {formatearMoneda(desglose.totalConsumoConIva)}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      (Subtotal: {formatearMoneda(desglose.subtotalSinIva)} + IVA 16%: {formatearMoneda(desglose.iva16)})
                    </span>
                  </div>
                </div>
                {propina > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block">Propina:</span>
                    <span className="text-xs font-bold text-stone-300">
                      {formatearMoneda(propina)} (Exenta)
                    </span>
                  </div>
                )}
              </div>

              {/* Botón rápido RFC Público en General */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-stone-300">Datos del Receptor:</span>
                <button
                  type="button"
                  onClick={handleRfcGenerico}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Usar RFC Genérico (Público en General)
                </button>
              </div>

              {/* Campo RFC */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  RFC del Cliente <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rfc}
                    onChange={handleRfcChange}
                    placeholder="Ej. GARM850101XYZ o EMP120101ABC"
                    maxLength={13}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 transition-colors"
                    required
                  />
                  {infoRfc && infoRfc.valido && (
                    <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="capitalize">{infoRfc.tipo}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Campo Razón Social */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-300">
                    Nombre o Razón Social <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    Sin régimen de capital (sin S.A. de C.V.)
                  </span>
                </div>
                <input
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value.toUpperCase())}
                  placeholder="NOMBRE TAL CUAL APARECE EN SU CONSTANCIA FISCAL"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm uppercase text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 transition-colors"
                  required
                />
              </div>

              {/* Código Postal y Régimen Fiscal en 2 columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Código Postal Fiscal <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={codigoPostal}
                    onChange={handleCodigoPostalChange}
                    placeholder="Ej. 67300"
                    maxLength={5}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Uso de CFDI <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={usoCfdi}
                    onChange={(e) => setUsoCfdi(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-hidden focus:border-amber-500 transition-colors"
                  >
                    {CATALOGO_USOS_CFDI_SAT.map((u) => (
                      <option key={u.clave} value={u.clave}>
                        {u.descripcion}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selector de Régimen Fiscal */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Régimen Fiscal (CFDI 4.0) <span className="text-red-400">*</span>
                </label>
                <select
                  value={regimenFiscal}
                  onChange={(e) => setRegimenFiscal(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-hidden focus:border-amber-500 transition-colors"
                >
                  {regímenesFiltrados.map((r) => (
                    <option key={r.clave} value={r.clave}>
                      {r.clave} - {r.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Correo Electrónico y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Correo para Envío (XML y PDF) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 transition-colors"
                      required
                    />
                    <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 81 1234 5678"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Mensaje de error si la validación falla */}
              {errorValidacion && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/70 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorValidacion}</span>
                </div>
              )}

              {/* Botón de envío */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {guardando ? 'Registrando...' : '🧾 Registrar y Vincular Factura'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
