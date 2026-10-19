import type {
  DatosReceptorFactura,
  DesgloseFiscalCuenta,
  FacturaRegistrada,
  TipoPersonaFiscal,
} from '../types/facturacion';
import {
  CLAVE_PROD_SERV_RESTAURANTE,
  CLAVE_UNIDAD_RESTAURANTE,
  mapearMetodoPagoPosASat,
} from '../data/catalogosSat';
import { servicioSupabase } from './servicioSupabase';

const CLAVE_STORAGE_FACTURAS = 'taqueria_km243_facturas_cfdi_v1';

// Expresión regular oficial del SAT para RFC de Persona Física (13 caracteres)
const REGEX_RFC_FISICA = /^[A-ZÑ&]{4}\d{6}[A-V1-9][A-Z\d]$/;

// Expresión regular oficial del SAT para RFC de Persona Moral (12 caracteres)
const REGEX_RFC_MORAL = /^[A-ZÑ&]{3}\d{6}[A-V1-9][A-Z\d]$/;

export interface ResultadoValidacionRfc {
  readonly valido: boolean;
  readonly tipo: TipoPersonaFiscal;
  readonly mensaje?: string;
}

class ServicioFacturacion {
  private static instancia: ServicioFacturacion | null = null;

  public static obtenerInstancia(): ServicioFacturacion {
    if (!this.instancia) {
      this.instancia = new ServicioFacturacion();
    }
    return this.instancia;
  }

  /**
   * Valida un RFC mexicano conforme a la estructura oficial del SAT.
   */
  public validarRfc(rfcCrudo: string): ResultadoValidacionRfc {
    const rfc = rfcCrudo.trim().toUpperCase();

    if (!rfc) {
      return { valido: false, tipo: 'invalido', mensaje: 'El RFC es requerido.' };
    }

    if (rfc === 'XAXX010101000' || rfc === 'XEXX010101000') {
      return { valido: true, tipo: 'generico' };
    }

    if (rfc.length === 12) {
      if (REGEX_RFC_MORAL.test(rfc)) {
        return { valido: true, tipo: 'moral' };
      }
      return {
        valido: false,
        tipo: 'invalido',
        mensaje: 'RFC de Persona Moral inválido. Debe tener 3 letras iniciales, 6 dígitos (AAMMDD) y 3 caracteres de homoclave.',
      };
    }

    if (rfc.length === 13) {
      if (REGEX_RFC_FISICA.test(rfc)) {
        return { valido: true, tipo: 'fisica' };
      }
      return {
        valido: false,
        tipo: 'invalido',
        mensaje: 'RFC de Persona Física inválido. Debe tener 4 letras iniciales, 6 dígitos (AAMMDD) y 3 caracteres de homoclave.',
      };
    }

    return {
      valido: false,
      tipo: 'invalido',
      mensaje: `El RFC debe tener exactamente 12 caracteres (persona moral) o 13 (persona física). Actual: ${rfc.length}.`,
    };
  }

  /**
   * Valida un Código Postal mexicano (exactamente 5 dígitos).
   */
  public validarCodigoPostal(cp: string): boolean {
    return /^\d{5}$/.test(cp.trim());
  }

  /**
   * Desglosa la base gravable y el IVA 16% a partir del total de la cuenta.
   * Regla Fiscal SAT: La propina NO es parte de la base gravable por consumo de alimentos.
   *
   * @param totalCuentaConPropina Total pagado por el cliente
   * @param propina Propina otorgada
   */
  public calcularDesglose(
    totalCuentaConPropina: number,
    propina: number
  ): DesgloseFiscalCuenta {
    const totalConsumoConIva = Math.max(0, Number((totalCuentaConPropina - propina).toFixed(2)));
    // En México los precios al comensal ya incluyen IVA (16%)
    const subtotalSinIva = Number((totalConsumoConIva / 1.16).toFixed(2));
    const iva16 = Number((totalConsumoConIva - subtotalSinIva).toFixed(2));
    const propinaExcluida = Math.max(0, Number(propina.toFixed(2)));
    const totalPagado = Number((totalConsumoConIva + propinaExcluida).toFixed(2));

    return {
      totalConsumoConIva,
      subtotalSinIva,
      iva16,
      propinaExcluida,
      totalPagado,
    };
  }

  /**
   * Obtiene la lista histórica de facturas solicitadas en almacenamiento local.
   */
  public obtenerFacturasLocales(): FacturaRegistrada[] {
    try {
      const data = localStorage.getItem(CLAVE_STORAGE_FACTURAS);
      if (!data) return [];
      const parseado = JSON.parse(data);
      return Array.isArray(parseado) ? parseado : [];
    } catch (e: unknown) {
      console.warn('[ServicioFacturacion] Error al leer facturas de localStorage:', e);
      return [];
    }
  }

  /**
   * Guarda una factura en el almacenamiento local y la sincroniza con Supabase.
   */
  public async guardarFactura(factura: FacturaRegistrada): Promise<void> {
    try {
      const actuales = this.obtenerFacturasLocales();
      const filtradas = actuales.filter((f) => f.id !== factura.id);
      const nuevas = [factura, ...filtradas];
      localStorage.setItem(CLAVE_STORAGE_FACTURAS, JSON.stringify(nuevas));

      // Sincronizar con Supabase si está disponible
      await this.sincronizarFacturaRemota(factura);
    } catch (err: unknown) {
      console.error('[ServicioFacturacion] Error al guardar factura local/remota:', err);
    }
  }

  /**
   * Persiste la factura en la base de datos de PostgreSQL en Supabase.
   */
  private async sincronizarFacturaRemota(factura: FacturaRegistrada): Promise<void> {
    if (!servicioSupabase.tieneCredenciales() || !navigator.onLine) {
      console.log('[ServicioFacturacion] Sin conexión, la factura quedó guardada en el almacenamiento local.');
      return;
    }

    try {
      const cliente = servicioSupabase.obtenerCliente();
      if (!cliente) return;

      const fila = {
        id: factura.id,
        cuenta_id: factura.cuentaId,
        mesa_id: factura.mesaId,
        nombre_mesa: factura.nombreMesa,
        folio_ticket: factura.folioTicket,
        rfc_receptor: factura.receptor.rfc,
        razon_social: factura.receptor.razonSocial,
        codigo_postal: factura.receptor.codigoPostal,
        regimen_fiscal: factura.receptor.regimenFiscal,
        uso_cfdi: factura.receptor.usoCfdi,
        email: factura.receptor.email,
        telefono: factura.receptor.telefono ?? null,
        subtotal: factura.desglose.subtotalSinIva,
        iva: factura.desglose.iva16,
        total: factura.desglose.totalConsumoConIva,
        propina_excluida: factura.desglose.propinaExcluida,
        metodo_pago_sat: factura.metodoPagoSat,
        clave_prod_serv: factura.claveProductoSat,
        clave_unidad: factura.claveUnidadSat,
        estado: factura.estado,
        fecha_creacion: factura.fechaCreacion,
        uuid_sat: factura.uuidSat ?? null,
        url_xml: factura.urlXml ?? null,
        url_pdf: factura.urlPdf ?? null,
        actualizado_en: new Date().toISOString(),
      };

      const { error } = await cliente.from('facturas_cfdi').upsert(fila);
      if (error) {
        console.warn('[ServicioFacturacion] Error al persistir factura en Supabase:', error.message);
      } else {
        console.log('[ServicioFacturacion] Factura persistida exitosamente en Supabase:', factura.id);
      }
    } catch (err: unknown) {
      console.warn('[ServicioFacturacion] Excepción al sincronizar factura remota:', err);
    }
  }

  /**
   * Busca si una cuenta ya tiene una factura solicitada previa.
   */
  public buscarFacturaPorCuentaId(cuentaId: string): FacturaRegistrada | null {
    const facturas = this.obtenerFacturasLocales();
    return facturas.find((f) => f.cuentaId === cuentaId) ?? null;
  }

  /**
   * Crea un objeto de factura listo para registrar a partir de una cuenta y los datos del receptor.
   */
  public construirFactura(params: {
    cuentaId: string;
    mesaId: string;
    nombreMesa: string;
    folioTicket: string;
    totalPagado: number;
    propina: number;
    metodoPagoPos: string;
    receptor: DatosReceptorFactura;
  }): FacturaRegistrada {
    const desglose = this.calcularDesglose(params.totalPagado, params.propina);
    const metodoPagoSat = mapearMetodoPagoPosASat(params.metodoPagoPos);

    return {
      id: `fac-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      cuentaId: params.cuentaId,
      mesaId: params.mesaId,
      nombreMesa: params.nombreMesa,
      folioTicket: params.folioTicket,
      receptor: {
        ...params.receptor,
        rfc: params.receptor.rfc.trim().toUpperCase(),
        razonSocial: params.receptor.razonSocial.trim().toUpperCase(),
        codigoPostal: params.receptor.codigoPostal.trim(),
      },
      desglose,
      metodoPagoSat,
      claveProductoSat: CLAVE_PROD_SERV_RESTAURANTE,
      claveUnidadSat: CLAVE_UNIDAD_RESTAURANTE,
      estado: 'solicitada',
      fechaCreacion: new Date().toISOString(),
    };
  }
}

export const servicioFacturacion = ServicioFacturacion.obtenerInstancia();
