import type { RegimenFiscalSat, UsoCfdiSat, MetodoPagoSat } from '../types/facturacion';

/**
 * Catálogo Oficial de Regímenes Fiscales del SAT (CFDI 4.0)
 * Filtrado y ordenado para uso ágil en restaurantes y consumo.
 */
export const CATALOGO_REGIMENES_SAT: readonly RegimenFiscalSat[] = [
  {
    clave: '612',
    descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales',
    aplicaFisica: true,
    aplicaMoral: false,
  },
  {
    clave: '626',
    descripcion: 'Régimen Simplificado de Confianza (RESICO)',
    aplicaFisica: true,
    aplicaMoral: true,
  },
  {
    clave: '601',
    descripcion: 'General de Ley Personas Morales',
    aplicaFisica: false,
    aplicaMoral: true,
  },
  {
    clave: '603',
    descripcion: 'Personas Morales con Fines no Lucrativos',
    aplicaFisica: false,
    aplicaMoral: true,
  },
  {
    clave: '605',
    descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
    aplicaFisica: true,
    aplicaMoral: false,
  },
  {
    clave: '606',
    descripcion: 'Arrendamiento',
    aplicaFisica: true,
    aplicaMoral: false,
  },
  {
    clave: '621',
    descripcion: 'Incorporación Fiscal (RIF)',
    aplicaFisica: true,
    aplicaMoral: false,
  },
  {
    clave: '625',
    descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    aplicaFisica: true,
    aplicaMoral: false,
  },
  {
    clave: '616',
    descripcion: 'Sin obligaciones fiscales (Público en General)',
    aplicaFisica: true,
    aplicaMoral: false,
  },
];

/**
 * Catálogo Oficial de Usos de CFDI del SAT (CFDI 4.0)
 * Ordenado por relevancia para consumo en establecimientos gastronómicos.
 */
export const CATALOGO_USOS_CFDI_SAT: readonly UsoCfdiSat[] = [
  {
    clave: 'G03',
    descripcion: 'G03 - Gastos en general (Recomendado para consumo en restaurante)',
    aplicaFisica: true,
    aplicaMoral: true,
  },
  {
    clave: 'S01',
    descripcion: 'S01 - Sin efectos fiscales',
    aplicaFisica: true,
    aplicaMoral: true,
  },
  {
    clave: 'G01',
    descripcion: 'G01 - Adquisición de mercancías',
    aplicaFisica: true,
    aplicaMoral: true,
  },
  {
    clave: 'CP01',
    descripcion: 'CP01 - Pagos',
    aplicaFisica: true,
    aplicaMoral: true,
  },
];

/**
 * Catálogo de Formas de Pago del SAT (Anexo 20)
 */
export const CATALOGO_METODOS_PAGO_SAT: readonly MetodoPagoSat[] = [
  { clave: '01', descripcion: '01 - Efectivo' },
  { clave: '04', descripcion: '04 - Tarjeta de crédito' },
  { clave: '28', descripcion: '28 - Tarjeta de débito' },
  { clave: '03', descripcion: '03 - Transferencia electrónica de fondos' },
  { clave: '99', descripcion: '99 - Por definir (Pago mixto)' },
];

/**
 * Mapea el método de pago interno del restaurante a la clave oficial del SAT.
 */
export function mapearMetodoPagoPosASat(metodo: string): string {
  switch (metodo) {
    case 'efectivo':
      return '01';
    case 'tarjeta':
      return '28'; // Débito por defecto, o 04
    case 'transferencia':
      return '03';
    case 'mixto':
      return '99';
    default:
      return '01';
  }
}

/** Clave de Producto / Servicio SAT para Restaurantes */
export const CLAVE_PROD_SERV_RESTAURANTE = '90101501';

/** Clave de Unidad SAT: E48 (Unidad de servicio) */
export const CLAVE_UNIDAD_RESTAURANTE = 'E48';
