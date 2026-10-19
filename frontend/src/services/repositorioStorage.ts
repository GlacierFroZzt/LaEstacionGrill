import type { Mesa, Cuenta, CorteCaja, TurnoCerrado, TipoArea, TemaVisual, PedidoCocina } from '../types';
import { MESAS_INICIALES } from '../data/mesasIniciales';
import { deduplicarYSanearMesas } from '../utils/saneadorMesas';

const CLAVES_STORAGE = {
  MESAS: 'taqueria_km243_mesas_v1',
  CUENTAS_ACTIVAS: 'taqueria_km243_cuentas_activas_v1',
  CUENTAS_CERRADAS: 'taqueria_km243_cuentas_cerradas_v1',
  PEDIDOS_COCINA: 'taqueria_km243_pedidos_cocina_v1',
  CORTE_ACTUAL: 'taqueria_km243_corte_actual_v1',
  HISTORIAL_TURNOS: 'taqueria_km243_historial_turnos_v1',
  PIN_ADMIN: 'taqueria_km243_pin_admin_v1',
  TEMA: 'taqueria_km243_tema_v1',
} as const;

const PIN_POR_DEFECTO = '2430';

export class RepositorioStorage {
  /**
   * Obtiene la preferencia de tema visual (oscuro o claro).
   */
  public static obtenerTema(): TemaVisual {
    try {
      const temaGuardado = localStorage.getItem(CLAVES_STORAGE.TEMA);
      if (temaGuardado === 'claro' || temaGuardado === 'oscuro') {
        return temaGuardado;
      }
      return 'oscuro'; // Por defecto estilo rústico norteño
    } catch {
      return 'oscuro';
    }
  }

  /**
   * Guarda la preferencia de tema visual en almacenamiento local.
   */
  public static guardarTema(tema: TemaVisual): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.TEMA, tema);
    } catch (e: unknown) {
      console.error('[RepositorioStorage.guardarTema] Error al guardar tema:', e);
    }
  }

  /**
   * Obtiene la lista de mesas almacenadas o inicializa con los valores por defecto,
   * deduplicando y saneando cualquier inconsistencia de registros previos.
   */
  public static obtenerMesas(): Mesa[] {
    try {
      const serializado = localStorage.getItem(CLAVES_STORAGE.MESAS);
      if (!serializado) {
        const saneadasIniciales = deduplicarYSanearMesas([...MESAS_INICIALES]);
        this.guardarMesas(saneadasIniciales);
        return saneadasIniciales;
      }
      interface MesaPersistidaLegada extends Omit<Mesa, 'area'> {
        area?: string;
      }
      const mesas = JSON.parse(serializado) as MesaPersistidaLegada[];
      // Migración defensiva: unificar 'para_llevar' en 'domicilio', y 'barra' en 'mesa'
      const mesasNormalizadas: Mesa[] = mesas.map((m) => {
        const areaPrevia = m.area ?? '';
        const esDomicilio =
          areaPrevia === 'domicilio' ||
          areaPrevia === 'para_llevar' ||
          m.id.startsWith('domicilio') ||
          m.id.startsWith('llevar') ||
          m.id.startsWith('dom-');

        const nuevoTipoArea: TipoArea = esDomicilio ? 'domicilio' : 'mesa';
        let nombreNormalizado = m.nombre;

        if (nuevoTipoArea === 'domicilio' && nombreNormalizado.toLowerCase().includes('llevar')) {
          nombreNormalizado = nombreNormalizado.replace(/para\s*llevar/i, 'Domicilio');
        } else if (nuevoTipoArea === 'mesa' && nombreNormalizado.toLowerCase().includes('barra')) {
          nombreNormalizado = `Mesa ${m.numero}`;
        }

        return {
          ...m,
          nombre: nombreNormalizado,
          area: nuevoTipoArea,
        };
      });

      const saneadas = deduplicarYSanearMesas(mesasNormalizadas);

      // Si la cantidad o estado varió al sanear (se encontraron duplicados en disco), persistir de inmediato
      if (saneadas.length !== mesas.length) {
        this.guardarMesas(saneadas);
      }

      return saneadas;
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerMesas] Error al recuperar mesas:', error);
      const saneadas = deduplicarYSanearMesas([...MESAS_INICIALES]);
      return saneadas;
    }
  }

  /**
   * Guarda el estado actual de todas las mesas.
   */
  public static guardarMesas(mesas: Mesa[]): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.MESAS, JSON.stringify(mesas));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarMesas] Error al guardar mesas:', error);
    }
  }

  /**
   * Obtiene las cuentas activas indexadas por id de cuenta.
   */
  public static obtenerCuentasActivas(): Record<string, Cuenta> {
    try {
      const serializado = localStorage.getItem(CLAVES_STORAGE.CUENTAS_ACTIVAS);
      if (!serializado) return {};
      return JSON.parse(serializado) as Record<string, Cuenta>;
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerCuentasActivas] Error al recuperar cuentas activas:', error);
      return {};
    }
  }

  /**
   * Guarda el diccionario de cuentas activas.
   */
  public static guardarCuentasActivas(cuentas: Record<string, Cuenta>): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.CUENTAS_ACTIVAS, JSON.stringify(cuentas));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarCuentasActivas] Error al guardar cuentas activas:', error);
    }
  }

  /**
   * Obtiene el historial de cuentas cerradas durante el turno o día.
   */
  public static obtenerCuentasCerradas(): Cuenta[] {
    try {
      const serializado = localStorage.getItem(CLAVES_STORAGE.CUENTAS_CERRADAS);
      if (!serializado) return [];
      return JSON.parse(serializado) as Cuenta[];
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerCuentasCerradas] Error al recuperar cuentas cerradas:', error);
      return [];
    }
  }

  /**
   * Agrega una cuenta cobrada al historial de cuentas cerradas sin duplicados.
   */
  public static registrarCuentaCerrada(cuenta: Cuenta): void {
    try {
      const cerradas = this.obtenerCuentasCerradas();
      const filtradas = cerradas.filter((c) => c.id !== cuenta.id);
      filtradas.unshift(cuenta);
      localStorage.setItem(CLAVES_STORAGE.CUENTAS_CERRADAS, JSON.stringify(filtradas));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.registrarCuentaCerrada] Error al registrar cuenta cerrada:', error);
    }
  }

  /**
   * Guarda de forma persistente la lista completa de cuentas cerradas en el turno.
   */
  public static guardarCuentasCerradas(cuentas: Cuenta[]): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.CUENTAS_CERRADAS, JSON.stringify(cuentas));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarCuentasCerradas] Error al guardar cuentas cerradas:', error);
    }
  }

  /**
   * Obtiene la lista persistida de pedidos/comandas enviadas a cocina.
   */
  public static obtenerPedidosCocina(): import('../types').PedidoCocina[] {
    try {
      const serializado = localStorage.getItem(CLAVES_STORAGE.PEDIDOS_COCINA);
      if (!serializado) return [];
      return JSON.parse(serializado) as import('../types').PedidoCocina[];
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerPedidosCocina] Error al recuperar pedidos de cocina:', error);
      return [];
    }
  }

  /**
   * Guarda la lista de pedidos/comandas de cocina.
   */
  public static guardarPedidosCocina(pedidos: import('../types').PedidoCocina[]): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.PEDIDOS_COCINA, JSON.stringify(pedidos));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarPedidosCocina] Error al guardar pedidos de cocina:', error);
    }
  }

  /**
   * Recupera la información del corte de caja actual o genera uno nuevo si no existe.
   */
  public static obtenerCorteActual(): CorteCaja {
    try {
      const serializado = localStorage.getItem(CLAVES_STORAGE.CORTE_ACTUAL);
      if (serializado) {
        return JSON.parse(serializado) as CorteCaja;
      }

      const nuevoCorte: CorteCaja = {
        id: `corte-${Date.now()}`,
        fechaApertura: new Date().toISOString(),
        fechaCierre: null,
        totalVentas: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalPropinas: 0,
        cuentasCobradasCount: 0,
        ticketPromedio: 0,
        estaAbierto: true,
        pinSeguridad: this.obtenerPinAdmin(),
      };
      this.guardarCorteActual(nuevoCorte);
      return nuevoCorte;
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerCorteActual] Error al recuperar corte actual:', error);
      return {
        id: `corte-fallback-${Date.now()}`,
        fechaApertura: new Date().toISOString(),
        fechaCierre: null,
        totalVentas: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalPropinas: 0,
        cuentasCobradasCount: 0,
        ticketPromedio: 0,
        estaAbierto: true,
        pinSeguridad: PIN_POR_DEFECTO,
      };
    }
  }

  /**
   * Actualiza el corte de caja en almacenamiento.
   */
  public static guardarCorteActual(corte: CorteCaja): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.CORTE_ACTUAL, JSON.stringify(corte));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarCorteActual] Error al guardar corte:', error);
    }
  }

  /**
   * Obtiene la lista histórica de turnos pasados cerrados.
   */
  public static obtenerHistorialTurnos(): TurnoCerrado[] {
    try {
      const serializado = localStorage.getItem(CLAVES_STORAGE.HISTORIAL_TURNOS);
      if (!serializado) return [];
      return JSON.parse(serializado) as TurnoCerrado[];
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerHistorialTurnos] Error al recuperar historial de turnos:', error);
      return [];
    }
  }

  /**
   * Guarda la lista histórica de turnos pasados.
   */
  public static guardarHistorialTurnos(turnos: TurnoCerrado[]): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.HISTORIAL_TURNOS, JSON.stringify(turnos));
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarHistorialTurnos] Error al guardar historial de turnos:', error);
    }
  }

  /**
   * Cierra y archiva el turno actual con sus cuentas cobradas en el historial permanente,
   * y genera un nuevo corte limpio a $0.00.
   */
  public static archivarTurnoYCerrar(
    corteActual: CorteCaja,
    cuentasCerradas: Cuenta[],
    nuevoPin?: string,
    pedidosCocina?: PedidoCocina[]
  ): { nuevoCorte: CorteCaja; turnoCerrado: TurnoCerrado } {
    try {
      const horaCierre = new Date().toISOString();
      const turnoCerrado: TurnoCerrado = {
        ...corteActual,
        fechaCierre: horaCierre,
        estaAbierto: false,
        cuentasCobradas: [...cuentasCerradas],
        pedidosCocinaArchivados: pedidosCocina ? [...pedidosCocina] : [],
      };

      // Archivar en historial de turnos (más reciente primero)
      const historial = this.obtenerHistorialTurnos();
      const historialSinDuplicado = historial.filter((t) => t.id !== turnoCerrado.id);
      const nuevoHistorial = [turnoCerrado, ...historialSinDuplicado];
      this.guardarHistorialTurnos(nuevoHistorial);

      // Generar nuevo corte limpio en ceros
      const nuevoCorte: CorteCaja = {
        id: `corte-${Date.now()}`,
        fechaApertura: horaCierre,
        fechaCierre: null,
        totalVentas: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalPropinas: 0,
        cuentasCobradasCount: 0,
        ticketPromedio: 0,
        estaAbierto: true,
        pinSeguridad: nuevoPin ?? this.obtenerPinAdmin(),
      };

      this.guardarCorteActual(nuevoCorte);
      localStorage.removeItem(CLAVES_STORAGE.CUENTAS_CERRADAS);
      localStorage.removeItem(CLAVES_STORAGE.PEDIDOS_COCINA);

      return { nuevoCorte, turnoCerrado };
    } catch (error: unknown) {
      console.error('[RepositorioStorage.archivarTurnoYCerrar] Error al archivar y cerrar turno:', error);
      throw error;
    }
  }

  /**
   * Reinicia el turno para un nuevo día o corte de caja (retrocompatibilidad).
   */
  public static reiniciarTurno(nuevoPin?: string): CorteCaja {
    try {
      const corteActual = this.obtenerCorteActual();
      const cuentasCerradas = this.obtenerCuentasCerradas();
      const { nuevoCorte } = this.archivarTurnoYCerrar(corteActual, cuentasCerradas, nuevoPin);
      return nuevoCorte;
    } catch (error: unknown) {
      console.error('[RepositorioStorage.reiniciarTurno] Error al reiniciar turno:', error);
      throw error;
    }
  }

  /**
   * Obtiene el PIN de administración.
   */
  public static obtenerPinAdmin(): string {
    try {
      const pin = localStorage.getItem(CLAVES_STORAGE.PIN_ADMIN);
      return pin ?? PIN_POR_DEFECTO;
    } catch (error: unknown) {
      console.error('[RepositorioStorage.obtenerPinAdmin] Error al obtener PIN:', error);
      return PIN_POR_DEFECTO;
    }
  }

  /**
   * Establece un nuevo PIN de administración.
   */
  public static guardarPinAdmin(nuevoPin: string): void {
    try {
      localStorage.setItem(CLAVES_STORAGE.PIN_ADMIN, nuevoPin);
    } catch (error: unknown) {
      console.error('[RepositorioStorage.guardarPinAdmin] Error al guardar nuevo PIN:', error);
    }
  }
}
