import React, { useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearMoneda, formatearHoraCorta, formatearFechaCompleta } from '../utils/formateadores';
import { servicioFacturacion } from '../services/servicioFacturacion';

export const ModalTicket: React.FC = () => {
  const { ticketImpresion, cerrarTicketImpresion } = useRestaurante();

  const factura = useMemo(
    () => (ticketImpresion?.cuenta ? servicioFacturacion.buscarFacturaPorCuentaId(ticketImpresion.cuenta.id) : null),
    [ticketImpresion?.cuenta]
  );

  if (!ticketImpresion) return null;

  const { cuenta, tipo } = ticketImpresion;

  const ejecutarImpresion = (): void => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between text-stone-100">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-base">
              {tipo === 'cocina' ? 'Comanda para Cocina' : 'Ticket de Consumo (Cliente)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={cerrarTicketImpresion}
            className="p-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Ticket Estilo Térmico 80mm */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 flex justify-center bg-stone-950/70">
          <div
            id="ticket-imprimible"
            className="w-full max-w-[320px] bg-amber-50 text-stone-900 p-5 rounded shadow-lg font-mono text-xs leading-relaxed border-t-8 border-stone-800"
          >
            {/* Encabezado */}
            <div className="text-center pb-3 border-b border-dashed border-stone-400 space-y-0.5">
              <p className="font-black text-sm uppercase tracking-wider">LA ESTACIÓN GRILL</p>
              <p className="font-bold text-[11px] text-stone-700">ESPECIALIDADES AL GRILL</p>
              <p className="text-[10px] text-stone-600">Servicio de Mesas y Comandas</p>
            </div>

            {/* Metadatos */}
            <div className="py-2.5 border-b border-dashed border-stone-400 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>FOLIO: #{cuenta.id.slice(-6).toUpperCase()}</span>
                <span>MESA: {cuenta.nombreMesa}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA: {formatearFechaCompleta(cuenta.horaApertura).slice(0, 16)}</span>
                <span>HORA: {formatearHoraCorta(cuenta.horaApertura)}</span>
              </div>
              <div>MESERO: {cuenta.mesero}</div>
              {tipo === 'cocina' && (
                <div className="text-center py-1 bg-stone-900 text-white font-black text-sm rounded mt-1">
                  *** COMANDA COCINA ***
                </div>
              )}
            </div>

            {/* Listado de Platillos */}
            <div className="py-3 border-b border-dashed border-stone-400 space-y-2">
              <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-stone-300">
                <span>CANT. DESCRIPCIÓN</span>
                {tipo === 'cliente' && <span>IMPORTE</span>}
              </div>

              {cuenta.items.map((it) => (
                <div key={it.id} className="space-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="font-bold">
                      {it.cantidad}x {it.nombre}
                    </span>
                    {tipo === 'cliente' && (
                      <span className="font-bold">
                        {formatearMoneda(it.precioUnitario * it.cantidad)}
                      </span>
                    )}
                  </div>

                  {/* Modificadores destacados */}
                  {it.modificadoresSeleccionados.length > 0 && (
                    <div className="pl-3 text-[10px] text-stone-700">
                      {it.modificadoresSeleccionados.map((m, i) => (
                        <div key={i}>• {m}</div>
                      ))}
                    </div>
                  )}

                  {it.notas && (
                    <div className="pl-3 text-[10px] font-bold text-red-700 uppercase">
                      * NOTA: {it.notas}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Datos Fiscales SAT si la cuenta fue facturada */}
            {factura && (
              <div className="py-2 border-b border-dashed border-stone-400 text-[10px] space-y-0.5">
                <div className="font-black text-center text-[11px] pb-1 uppercase tracking-wider text-stone-800">
                  *** COMPROBANTE FISCAL CFDI 4.0 ***
                </div>
                <div className="flex justify-between">
                  <span>RFC RECEPTOR:</span>
                  <span className="font-bold">{factura.receptor.rfc}</span>
                </div>
                <div>RAZÓN SOCIAL: {factura.receptor.razonSocial}</div>
                <div className="flex justify-between">
                  <span>C.P. FISCAL: {factura.receptor.codigoPostal}</span>
                  <span>USO: {factura.receptor.usoCfdi}</span>
                </div>
                <div>RÉGIMEN: {factura.receptor.regimenFiscal}</div>
                {factura.receptor.email && (
                  <div className="truncate">EMAIL: {factura.receptor.email}</div>
                )}
              </div>
            )}

            {/* Totales si es ticket para el cliente */}
            {tipo === 'cliente' && (
              <div className="py-2.5 border-b border-dashed border-stone-400 text-right space-y-1 text-xs">
                {factura ? (
                  <>
                    <div className="flex justify-between">
                      <span>BASE GRAVABLE (SIN IVA):</span>
                      <span>{formatearMoneda(factura.desglose.subtotalSinIva)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA TRASLADADO (16%):</span>
                      <span>{formatearMoneda(factura.desglose.iva16)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-0.5 border-t border-stone-200">
                      <span>TOTAL CONSUMO:</span>
                      <span>{formatearMoneda(factura.desglose.totalConsumoConIva)}</span>
                    </div>
                    {factura.desglose.propinaExcluida > 0 && (
                      <div className="flex justify-between text-[11px] text-stone-600">
                        <span>PROPINA (EXENTA IVA):</span>
                        <span>{formatearMoneda(factura.desglose.propinaExcluida)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black pt-1 border-t border-stone-400">
                      <span>TOTAL PAGADO:</span>
                      <span>{formatearMoneda(factura.desglose.totalPagado)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>SUBTOTAL:</span>
                      <span>{formatearMoneda(cuenta.subtotal)}</span>
                    </div>
                    {cuenta.propina > 0 && (
                      <div className="flex justify-between">
                        <span>PROPINA:</span>
                        <span>{formatearMoneda(cuenta.propina)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black pt-1 border-t border-stone-400">
                      <span>TOTAL:</span>
                      <span>{formatearMoneda(cuenta.total)}</span>
                    </div>
                  </>
                )}

                {cuenta.metodoPago && (
                  <div className="text-[10px] text-stone-600 pt-1">
                    PAGO: {cuenta.metodoPago.toUpperCase()} | RECIBIDO:{' '}
                    {formatearMoneda(cuenta.montoRecibido ?? cuenta.total)}
                    {cuenta.cambioEntregado && cuenta.cambioEntregado > 0 ? (
                      <> | CAMBIO: {formatearMoneda(cuenta.cambioEntregado)}</>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Pie de Ticket */}
            <div className="text-center pt-3 text-[10px] text-stone-600 space-y-1">
              {factura ? (
                <>
                  <p className="font-bold text-stone-900">SOLICITUD DE FACTURA REGISTRADA</p>
                  <p>FOLIO: {factura.folioTicket}</p>
                  <p>Archivos XML y PDF enviados a su correo electrónico</p>
                </>
              ) : (
                <>
                  <p className="font-bold">¡GRACIAS POR SU PREFERENCIA!</p>
                  <p>El mejor sabor al grill, hamburguesas y especialidades</p>
                </>
              )}
              <p>*** SISTEMA LA ESTACIÓN GRILL ***</p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex gap-2">
          <button
            type="button"
            onClick={cerrarTicketImpresion}
            className="flex-1 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-sm cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={ejecutarImpresion}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Ticket
          </button>
        </div>
      </div>
    </div>
  );
};
