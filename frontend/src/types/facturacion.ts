/**
 * Tipos de datos para el módulo de Facturación Electrónica en México (CFDI 4.0 - SAT).
 * Diseñado conforme a los catálogos y especificaciones del Anexo 20 del SAT.
 */

export type TipoPersonaFiscal = 'fisica' | 'moral' | 'generico' | 'invalido';

export type EstadoFactura = 'solicitada' | 'timbrada' | 'cancelada';

export interface RegimenFiscalSat {
  readonly clave: string;
  readonly descripcion: string;
  readonly aplicaFisica: boolean;
  readonly aplicaMoral: boolean;
}

export interface UsoCfdiSat {
  readonly clave: string;
  readonly descripcion: string;
  readonly aplicaFisica: boolean;
  readonly aplicaMoral: boolean;
}

export interface MetodoPagoSat {
  readonly clave: string; // '01', '03', '04', '28', '99'
  readonly descripcion: string;
}

export interface DatosReceptorFactura {
  readonly rfc: string;
  readonly razonSocial: string;
  readonly codigoPostal: string;
  readonly regimenFiscal: string;
  readonly usoCfdi: string;
  readonly email: string;
  readonly telefono?: string;
}

export interface DesgloseFiscalCuenta {
  readonly totalConsumoConIva: number; // Consumo total sin propina
  readonly subtotalSinIva: number;     // Base gravable (totalConsumo / 1.16)
  readonly iva16: number;              // Impuesto trasladado 16%
  readonly propinaExcluida: number;    // Propina separada (no grava IVA ni ingreso de alimentos)
  readonly totalPagado: number;        // totalConsumoConIva + propinaExcluida
}

export interface FacturaRegistrada {
  readonly id: string;
  readonly cuentaId: string;
  readonly mesaId: string;
  readonly nombreMesa: string;
  readonly folioTicket: string;
  readonly receptor: DatosReceptorFactura;
  readonly desglose: DesgloseFiscalCuenta;
  readonly metodoPagoSat: string;
  readonly claveProductoSat: string;  // Por defecto '90101501' (Restaurantes)
  readonly claveUnidadSat: string;    // Por defecto 'E48' (Unidad de servicio)
  readonly estado: EstadoFactura;
  readonly fechaCreacion: string;
  readonly fechaTimbrado?: string;
  readonly uuidSat?: string;          // Folio Fiscal emitido por el SAT/PAC
  readonly selloDigitalSat?: string;
  readonly urlXml?: string;
  readonly urlPdf?: string;
  readonly notas?: string;
}
