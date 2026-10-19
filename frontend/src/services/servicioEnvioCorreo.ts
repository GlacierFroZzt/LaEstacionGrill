import type { FacturaRegistrada } from '../types/facturacion';
import { formatearMoneda } from '../utils/formateadores';

/**
 * Servicio encargado de formatear y despachar comprobantes y facturas fiscales
 * mediante cliente de correo electrónico (mailto), Web Share API nativa y portapapeles.
 */
class ServicioEnvioCorreo {
  private static instancia: ServicioEnvioCorreo | null = null;

  private constructor() {}

  public static obtenerInstancia(): ServicioEnvioCorreo {
    if (!this.instancia) {
      this.instancia = new ServicioEnvioCorreo();
    }
    return this.instancia;
  }

  /**
   * Genera el asunto formal para el correo fiscal.
   */
  public generarAsunto(factura: FacturaRegistrada): string {
    return `Comprobante Fiscal CFDI 4.0 - Taquería La Estación Grill [${factura.folioTicket}]`;
  }

  /**
   * Genera el cuerpo del correo en texto plano estructurado.
   */
  public generarCuerpoTexto(factura: FacturaRegistrada): string {
    const { receptor, desglose } = factura;

    return `TAQUERÍA LA ESTACIÓN GRILL
Carretera Nacional Km 243, Santiago, N.L.
RFC Emisor: TKM240101XYZ
Régimen Fiscal Emisor: 601 - General de Ley Personas Morales

COMPROBANTE DE CONSUMO Y DATOS FISCALES CFDI 4.0
==================================================
Folio de Solicitud: ${factura.folioTicket}
Fecha y Hora: ${new Date(factura.fechaCreacion).toLocaleString('es-MX')}
Mesa / Pedido: ${factura.nombreMesa}
Forma de Pago: ${factura.metodoPagoSat.toUpperCase()}

DATOS DEL RECEPTOR (CLIENTE):
--------------------------------------------------
RFC: ${receptor.rfc}
Razón Social: ${receptor.razonSocial}
Código Postal Fiscal: ${receptor.codigoPostal}
Régimen Fiscal: ${receptor.regimenFiscal}
Uso de CFDI: ${receptor.usoCfdi}
Correo Electrónico: ${receptor.email}
${receptor.telefono ? `Teléfono: ${receptor.telefono}\n` : ''}
DESGLOSE FISCAL (MXN):
--------------------------------------------------
Base Gravable (Alimentos sin IVA): ${formatearMoneda(desglose.subtotalSinIva)}
IVA Trasladado (16%):              ${formatearMoneda(desglose.iva16)}
--------------------------------------------------
TOTAL FACTURADO:                   ${formatearMoneda(desglose.totalConsumoConIva)}
${desglose.propinaExcluida > 0 ? `Propina voluntaria (exenta de IVA): ${formatearMoneda(desglose.propinaExcluida)}\nTOTAL PAGADO:                      ${formatearMoneda(desglose.totalPagado)}\n` : ''}
==================================================
Clave SAT Producto/Servicio: 90101501 (Restaurantes)
Clave SAT Unidad: E48 (Unidad de Servicio)

Este documento contiene los datos fiscales validados para la emisión
de su Comprobante Fiscal Digital por Internet (CFDI 4.0).

¡Gracias por su preferencia en La Estación Grill!
Para cualquier aclaración o seguimiento, responda directamente a este correo.
`;
  }

  /**
   * Abre el cliente de correo predeterminado del sistema (Gmail, Outlook, Apple Mail)
   * con destinatario, asunto y desglose fiscal precargados.
   */
  public abrirClienteCorreo(factura: FacturaRegistrada): { exito: boolean; mensaje: string } {
    try {
      const emailDestino = factura.receptor.email?.trim();
      if (!emailDestino) {
        return {
          exito: false,
          mensaje: 'La factura no tiene un correo electrónico registrado.',
        };
      }

      const asunto = this.generarAsunto(factura);
      const cuerpo = this.generarCuerpoTexto(factura);

      const mailtoUrl = `mailto:${encodeURIComponent(emailDestino)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

      // En web y WebView, abrir con location.href o ventana auxiliar segura
      if (typeof window !== 'undefined') {
        const enlace = document.createElement('a');
        enlace.href = mailtoUrl;
        enlace.target = '_blank';
        enlace.rel = 'noopener noreferrer';
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
      }

      return {
        exito: true,
        mensaje: `Se ha abierto el cliente de correo para enviar a ${emailDestino}`,
      };
    } catch (error: unknown) {
      console.error('[ServicioEnvioCorreo] Error al abrir cliente de correo:', error);
      return {
        exito: false,
        mensaje: 'No fue posible abrir el gestor de correo del dispositivo.',
      };
    }
  }

  /**
   * Comparte el comprobante fiscal mediante el menú nativo del dispositivo (Android, iOS o navegadores modernos),
   * permitiendo enviar directamente por Gmail, Outlook, WhatsApp o Mensajes.
   */
  public async compartirComprobante(
    factura: FacturaRegistrada
  ): Promise<{ exito: boolean; mensaje: string }> {
    try {
      const asunto = this.generarAsunto(factura);
      const texto = this.generarCuerpoTexto(factura);

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: asunto,
          text: texto,
        });
        return { exito: true, mensaje: 'Comprobante compartido correctamente.' };
      }

      // Si no hay Web Share API (ej. desktop), fallback a abrir correo
      return this.abrirClienteCorreo(factura);
    } catch (error: unknown) {
      // El usuario canceló la hoja de compartir o no está disponible
      if (error instanceof Error && error.name === 'AbortError') {
        return { exito: false, mensaje: 'Envío cancelado por el usuario.' };
      }
      console.warn('[ServicioEnvioCorreo] Error o fallback en compartir:', error);
      return this.abrirClienteCorreo(factura);
    }
  }

  /**
   * Copia todo el comprobante fiscal al portapapeles para pegarlo en WhatsApp, correo o notas.
   */
  public async copiarAlPortapapeles(
    factura: FacturaRegistrada
  ): Promise<{ exito: boolean; mensaje: string }> {
    try {
      const texto = this.generarCuerpoTexto(factura);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        return { exito: true, mensaje: '¡Comprobante fiscal copiado al portapapeles!' };
      }
      return { exito: false, mensaje: 'El portapapeles no está disponible en este dispositivo.' };
    } catch (error: unknown) {
      console.error('[ServicioEnvioCorreo] Error al copiar al portapapeles:', error);
      return { exito: false, mensaje: 'No se pudo copiar el comprobante.' };
    }
  }
}

export const servicioEnvioCorreo = ServicioEnvioCorreo.obtenerInstancia();
