import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  X,
  Search,
  Printer,
  Mail,
  FileCheck,
  Share2,
} from 'lucide-react';
import type { FacturaRegistrada } from '../types/facturacion';
import { servicioFacturacion } from '../services/servicioFacturacion';
import { servicioEnvioCorreo } from '../services/servicioEnvioCorreo';
import { formatearMoneda } from '../utils/formateadores';
import { useRestaurante } from '../context/RestauranteContext';

interface PropsModalHistorialFacturas {
  readonly onClose: () => void;
}

export const ModalHistorialFacturas: React.FC<PropsModalHistorialFacturas> = ({
  onClose,
}) => {
  const { tema, imprimirTicket, cuentasCerradas } = useRestaurante();
  const esClaro = tema === 'claro';

  const [facturas, setFacturas] = useState<FacturaRegistrada[]>(() =>
    servicioFacturacion.obtenerFacturasLocales()
  );
  const [busqueda, setBusqueda] = useState<string>('');

  useEffect(() => {
    setFacturas(servicioFacturacion.obtenerFacturasLocales());
  }, []);

  const facturasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return facturas;
    return facturas.filter(
      (f) =>
        f.receptor.rfc.toLowerCase().includes(q) ||
        f.receptor.razonSocial.toLowerCase().includes(q) ||
        f.folioTicket.toLowerCase().includes(q) ||
        f.nombreMesa.toLowerCase().includes(q)
    );
  }, [facturas, busqueda]);

  const totalFacturadoTurno = useMemo(
    () => facturas.reduce((acc, f) => acc + f.desglose.totalConsumoConIva, 0),
    [facturas]
  );

  const totalIvaTurno = useMemo(
    () => facturas.reduce((acc, f) => acc + f.desglose.iva16, 0),
    [facturas]
  );

  const handleReimprimirTicket = (factura: FacturaRegistrada) => {
    // Buscar la cuenta cerrada correspondiente
    const cuenta = cuentasCerradas.find((c) => c.id === factura.cuentaId);
    if (cuenta) {
      imprimirTicket('cliente', cuenta);
    } else {
      // Reconstruir una cuenta mínima para imprimir el ticket
      imprimirTicket('cliente', {
        id: factura.cuentaId,
        mesaId: factura.mesaId,
        numeroMesa: 1,
        nombreMesa: factura.nombreMesa,
        items: [],
        subtotal: factura.desglose.subtotalSinIva,
        descuento: 0,
        propina: factura.desglose.propinaExcluida,
        total: factura.desglose.totalPagado,
        estado: 'cerrada',
        horaApertura: factura.fechaCreacion,
        horaCierre: factura.fechaCreacion,
        mesero: 'Caja',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] anim-entrada-modal ${
          esClaro ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-stone-800 text-stone-100'
        }`}
      >
        {/* Cabecera */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/80 border-stone-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 flex items-center justify-center font-black shadow-md">
              <FileCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className={`font-black text-base sm:text-lg ${esClaro ? 'text-amber-800' : 'text-amber-400'}`}>
                Historial de Facturas Emitidas
              </h3>
              <p className="text-xs text-stone-400">
                Auditoría fiscal y comprobantes del restaurante
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de facturación */}
        <div className="p-4 border-b border-stone-800/60 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div
            className={`p-3 rounded-2xl border ${
              esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/70 border-stone-800'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Comprobantes
            </span>
            <span className="text-lg font-black text-amber-500">
              {facturas.length} factura(s)
            </span>
          </div>

          <div
            className={`p-3 rounded-2xl border ${
              esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/70 border-stone-800'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Total Facturado
            </span>
            <span className="text-lg font-black text-emerald-500">
              {formatearMoneda(totalFacturadoTurno)}
            </span>
          </div>

          <div
            className={`col-span-2 sm:col-span-1 p-3 rounded-2xl border ${
              esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/70 border-stone-800'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              IVA 16% Trasladado
            </span>
            <span className="text-lg font-black text-blue-400">
              {formatearMoneda(totalIvaTurno)}
            </span>
          </div>
        </div>

        {/* Buscador */}
        <div className="p-4 border-b border-stone-800/40">
          <div className="relative">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por RFC, Razón Social o Folio..."
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs border focus:outline-hidden transition-colors ${
                esClaro
                  ? 'bg-stone-100 border-stone-300 text-stone-900 placeholder-stone-500 focus:border-amber-500'
                  : 'bg-stone-950 border-stone-800 text-stone-100 placeholder-stone-600 focus:border-amber-500'
              }`}
            />
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
          </div>
        </div>

        {/* Listado con scroll */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {facturasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-stone-500 space-y-2">
              <FileText className="w-12 h-12 mx-auto stroke-1 text-stone-600" />
              <p className="text-sm font-bold">No hay facturas registradas aún</p>
              <p className="text-xs max-w-xs mx-auto">
                Al cobrar una cuenta, puedes pulsar el botón &quot;Solicitar Factura&quot; para capturar los datos fiscales del cliente.
              </p>
            </div>
          ) : (
            facturasFiltradas.map((f) => (
              <div
                key={f.id}
                className={`p-4 rounded-2xl border transition-all ${
                  esClaro
                    ? 'bg-stone-50 hover:bg-stone-100 border-stone-200'
                    : 'bg-stone-950/70 hover:bg-stone-950 border-stone-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/40 pb-2.5 mb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {f.receptor.rfc}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {f.estado}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-stone-200 mt-0.5">
                      {f.receptor.razonSocial}
                    </h4>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-base font-black text-emerald-400 block font-mono">
                      {formatearMoneda(f.desglose.totalConsumoConIva)}
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Subtotal: {formatearMoneda(f.desglose.subtotalSinIva)} | IVA: {formatearMoneda(f.desglose.iva16)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>Mesa: <strong className="text-stone-300">{f.nombreMesa}</strong></span>
                    <span>Folio: <strong className="font-mono text-stone-300">{f.folioTicket}</strong></span>
                    <span>Uso: <strong className="text-stone-300">{f.receptor.usoCfdi}</strong></span>
                    {f.receptor.email && (
                      <span className="flex items-center gap-1 text-stone-400 truncate max-w-[180px]">
                        <Mail className="w-3 h-3 shrink-0" />
                        {f.receptor.email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {f.receptor.email && (
                      <button
                        type="button"
                        onClick={() => servicioEnvioCorreo.abrirClienteCorreo(f)}
                        className="py-1.5 px-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
                        title={`Enviar correo a ${f.receptor.email}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Enviar Correo</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => servicioEnvioCorreo.compartirComprobante(f)}
                      className="py-1.5 px-2.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      title="Compartir por WhatsApp, Correo o Mensajes"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Compartir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReimprimirTicket(f)}
                      className="py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer border border-stone-700"
                      title="Imprimir ticket con desglose fiscal"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ticket Fiscal</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie */}
        <div
          className={`p-3.5 sm:p-4 border-t flex justify-end ${
            esClaro ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs sm:text-sm cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
