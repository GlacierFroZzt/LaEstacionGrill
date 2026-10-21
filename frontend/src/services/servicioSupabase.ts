import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Mesa, Cuenta, PedidoCocina, CorteCaja, TurnoCerrado, Producto } from '../types';
import { deduplicarYSanearMesas } from '../utils/saneadorMesas';
import { servicioDeteccionIp } from './servicioDeteccionIp';
import { RepositorioStorage } from './repositorioStorage';

export interface AccionOffline {
  id: string;
  tabla: 'mesas' | 'cuentas' | 'pedidos_cocina' | 'cortes_caja';
  operacion: 'UPSERT' | 'DELETE';
  datos: unknown;
  timestamp: string;
}

export type ListenerSupabaseSync = (tipo: string, payload: unknown) => void;

class ServicioSupabase {
  private static instancia: ServicioSupabase | null = null;
  private cliente: SupabaseClient | null = null;
  private canal: RealtimeChannel | null = null;
  private listeners: Set<ListenerSupabaseSync> = new Set();
  private procesandoCola: boolean = false;
  private conectado: boolean = false;
  private intentosReconexion: number = 0;
  private timerReconexion: ReturnType<typeof setTimeout> | null = null;
  private timerLatido: ReturnType<typeof setInterval> | null = null;
  private verificandoSalud: boolean = false;
  private idDispositivo: string;

  public static readonly CLAVE_URL = 'taqueria_supabase_url';
  public static readonly CLAVE_ANON_KEY = 'taqueria_supabase_anon_key';
  private static readonly CLAVE_COLA_OFFLINE = 'taqueria_cola_offline_v1';

  public static readonly URL_PREDETERMINADA =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    'https://idgyotujnoavliaqtuck.supabase.co';
  public static readonly ANON_KEY_PREDETERMINADA =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ3lvdHVqbm9hdmxpYXF0dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjg4ODUsImV4cCI6MjEwNzYwNDg4NX0.ywXODlKIzn68R-5dzvQC-evagSsHa7iNkv82l68dJT8';

  private constructor() {
    this.idDispositivo =
      typeof window !== 'undefined'
        ? localStorage.getItem('taqueria_disp_id') || `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        : 'disp-servidor';
    if (typeof window !== 'undefined' && !localStorage.getItem('taqueria_disp_id')) {
      localStorage.setItem('taqueria_disp_id', this.idDispositivo);
    }

    this.inicializarClienteDesdeStorage();
    this.iniciarMonitoreoLatido();

    if (typeof window !== 'undefined') {
      // 1. Al recuperar conexión de red, forzar reconexión inmediata
      window.addEventListener('online', () => {
        console.log('[ServicioSupabase] Red detectada. Verificando y reconectando a Supabase...');
        this.verificarYReconectar(true);
      });

      // 2. Al perder red, marcar desconectado
      window.addEventListener('offline', () => {
        this.conectado = false;
        this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: false });
      });

      // 3. En tablets y celulares, al desbloquear pantalla o volver a la app, verificar socket
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[ServicioSupabase] Pantalla activa. Verificando estado con Supabase...');
          this.verificarYReconectar(false);
        }
      });

      window.addEventListener('focus', () => {
        this.verificarYReconectar(false);
      });
    }
  }

  public static obtenerInstancia(): ServicioSupabase {
    if (!this.instancia) {
      this.instancia = new ServicioSupabase();
    }
    return this.instancia;
  }

  public obtenerCliente(): SupabaseClient | null {
    return this.cliente;
  }

  public obtenerCredenciales(): { url: string; key: string } {
    if (typeof window === 'undefined') {
      return {
        url: ServicioSupabase.URL_PREDETERMINADA,
        key: ServicioSupabase.ANON_KEY_PREDETERMINADA,
      };
    }
    const guardadaUrl = localStorage.getItem(ServicioSupabase.CLAVE_URL);
    const guardadaKey = localStorage.getItem(ServicioSupabase.CLAVE_ANON_KEY);

    return {
      url: (guardadaUrl && guardadaUrl.trim()) ? guardadaUrl.trim() : ServicioSupabase.URL_PREDETERMINADA,
      key: (guardadaKey && guardadaKey.trim()) ? guardadaKey.trim() : ServicioSupabase.ANON_KEY_PREDETERMINADA,
    };
  }

  public guardarCredenciales(url: string, key: string): void {
    if (typeof window === 'undefined') return;
    const urlLimpia = url.trim();
    const keyLimpia = key.trim();

    if (urlLimpia && keyLimpia) {
      localStorage.setItem(ServicioSupabase.CLAVE_URL, urlLimpia);
      localStorage.setItem(ServicioSupabase.CLAVE_ANON_KEY, keyLimpia);
    } else {
      localStorage.removeItem(ServicioSupabase.CLAVE_URL);
      localStorage.removeItem(ServicioSupabase.CLAVE_ANON_KEY);
    }

    this.reiniciarCliente();
  }

  private inicializarClienteDesdeStorage(): void {
    const { url, key } = this.obtenerCredenciales();
    if (url && key) {
      try {
        this.cliente = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: {
            params: { eventsPerSecond: 10 },
            heartbeatIntervalMs: 5000,
          },
        });
        this.iniciarCanalRealtime();
        // Verificación inicial inmediata sin demoras
        this.verificarYReconectar(false).catch(console.error);
      } catch (err: unknown) {
        console.error('[ServicioSupabase] Error al inicializar cliente:', err);
        this.programarReconexion();
      }
    }
  }

  public reiniciarCliente(): void {
    if (this.timerReconexion) {
      clearTimeout(this.timerReconexion);
      this.timerReconexion = null;
    }
    if (this.canal) {
      try {
        if (this.cliente) {
          this.cliente.removeChannel(this.canal);
        } else {
          this.canal.unsubscribe();
        }
      } catch (e: unknown) {
        console.warn('[ServicioSupabase] Error al desuscribir canal previo:', e);
      }
      this.canal = null;
    }
    this.cliente = null;
    this.conectado = false;
    this.intentosReconexion = 0;
    this.inicializarClienteDesdeStorage();
  }

  public async probarConexion(url: string, key: string): Promise<{ ok: boolean; mensaje: string }> {
    try {
      const urlLimpia = url.trim();
      const keyLimpia = key.trim();
      if (!urlLimpia || !keyLimpia) {
        return { ok: false, mensaje: 'Debes proporcionar la URL del proyecto y la Clave Anon de Supabase.' };
      }

      const clientePrueba = createClient(urlLimpia, keyLimpia);
      const { data, error } = await clientePrueba.from('mesas').select('id').limit(1);

      if (error) {
        return {
          ok: false,
          mensaje: `Error al consultar Supabase: ${error.message} (Código: ${error.code})`,
        };
      }

      return {
        ok: true,
        mensaje: `¡Conexión exitosa con PostgreSQL en Supabase! Filas verificadas: ${data?.length ?? 0}`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de red';
      return { ok: false, mensaje: `Fallo de conexión: ${errorMsg}` };
    }
  }

  private iniciarCanalRealtime(): void {
    if (!this.cliente) return;

    try {
      if (this.canal) {
        try {
          this.cliente.removeChannel(this.canal);
        } catch {
          try {
            this.canal.unsubscribe();
          } catch {
            // Ignorar
          }
        }
        this.canal = null;
      }

      // Nombre de canal unificado para presencia y eventos en tiempo real entre todos los celulares
      const nombreCanal = 'taqueria-sync-global';
      this.canal = this.cliente
        .channel(nombreCanal, {
          config: {
            presence: {
              key: this.idDispositivo,
            },
          },
        })
        .on('presence', { event: 'sync' }, () => {
          if (!this.canal) return;
          try {
            const estadoPresencia = this.canal.presenceState();
            // Deduplicación por IP: si dos conexiones tienen la misma IP, no contarlas como 2 distintas
            const ipsOIdsUnicos = new Set<string>();
            for (const [key, presencias] of Object.entries(estadoPresencia)) {
              if (key.startsWith('admin-consola')) continue;
              const lista = (presencias as Array<{ ip?: string }>) || [];
              const ip = lista[0]?.ip;
              if (ip && ip !== 'desconocido' && ip !== '127.0.0.1' && ip !== '::1') {
                ipsOIdsUnicos.add(`ip:${ip}`);
              } else {
                ipsOIdsUnicos.add(`id:${key}`);
              }
            }
            const totalDispositivos = Math.max(1, ipsOIdsUnicos.size);
            this.notificarListeners('DISPOSITIVOS_ACTUALIZADOS', {
              clientesConectadosCount: totalDispositivos,
            });
          } catch (e: unknown) {
            console.warn('[ServicioSupabase] Error al sincronizar presencia:', e);
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mesas' },
          (payload) => {
            this.notificarListeners('MESA_REMOTA_ACTUALIZADA', payload.new);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cuentas' },
          (payload) => {
            this.notificarListeners('CUENTA_REMOTA_ACTUALIZADA', payload.new);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedidos_cocina' },
          (payload) => {
            this.notificarListeners('PEDIDO_COCINA_REMOTO_ACTUALIZADO', payload.new);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cortes_caja' },
          (payload) => {
            this.notificarListeners('CORTE_REMOTO_ACTUALIZADO', payload.new);
          }
        )
        .on(
          'broadcast',
          { event: 'CATALOGO_PRODUCTOS_ACTUALIZADO' },
          (payload) => {
            this.notificarListeners('CATALOGO_PRODUCTOS_REMOTO_ACTUALIZADO', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'logs_sistema' },
          (payload) => {
            try {
              const nuevo = payload.new as { nivel?: string; mensaje?: string; dispositivo_id?: string };
              if (
                nuevo &&
                (nuevo.nivel === 'CRASH' || nuevo.nivel === 'ERROR') &&
                nuevo.dispositivo_id !== this.idDispositivo
              ) {
                if (typeof window !== 'undefined') {
                  const puente = (window as unknown as {
                    AndroidNotificationBridge?: {
                      emitirNotificacion: (t: string, m: string, n: string) => void;
                    };
                  }).AndroidNotificationBridge;

                  if (puente) {
                    const titulo =
                      nuevo.nivel === 'CRASH'
                        ? '💥 ALERTA: Crash en Terminal Restaurante'
                        : '⚠️ AVISO: Error en Terminal Restaurante';
                    puente.emitirNotificacion(
                      titulo,
                      `${nuevo.dispositivo_id}: ${nuevo.mensaje || ''}`,
                      nuevo.nivel
                    );
                  }
                }
              }
            } catch (err: unknown) {
              console.error('[ServicioSupabase] Error al notificar log remoto:', err);
            }
          }
        )
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[ServicioSupabase] Canal Realtime (${nombreCanal}) conectado y suscrito exitosamente.`);
            this.conectado = true;
            this.intentosReconexion = 0;
            this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: true });

            // Rastrear la presencia de este dispositivo en Supabase con IP, plataforma y nombre legible
            try {
              const ip = await servicioDeteccionIp.obtenerIp();
              const nombreDispositivo = RepositorioStorage.obtenerNombreDispositivo();
              await this.canal?.track({
                dispositivoId: this.idDispositivo,
                nombreDispositivo,
                ip: ip || 'desconocido',
                plataforma: typeof navigator !== 'undefined' ? navigator.platform : 'web',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                conectadoEn: new Date().toISOString(),
                rol: 'punto-de-venta',
              });
            } catch (errPresencia: unknown) {
              console.warn('[ServicioSupabase] No se pudo registrar presencia inicial:', errPresencia);
            }

            this.procesarColaOffline().catch((err: unknown) => {
              console.error('[ServicioSupabase] Error al procesar cola tras suscripción:', err);
            });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[ServicioSupabase] Canal Realtime en estado "${status}". Verificando salud REST...`);
            // Comprobación rápida para no marcar falso offline si la BD responde
            this.verificarSaludRapida();
          }
        });
    } catch (err: unknown) {
      console.error('[ServicioSupabase] Error al suscribir a Realtime:', err);
      this.verificarSaludRapida();
    }
  }

  /**
   * Re-anuncia la presencia de este dispositivo con su nombre actualizado.
   */
  public async actualizarPresencia(): Promise<void> {
    if (!this.canal) return;
    try {
      const ip = await servicioDeteccionIp.obtenerIp();
      const nombreDispositivo = RepositorioStorage.obtenerNombreDispositivo();
      await this.canal.track({
        dispositivoId: this.idDispositivo,
        nombreDispositivo,
        ip: ip || 'desconocido',
        plataforma: typeof navigator !== 'undefined' ? navigator.platform : 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        conectadoEn: new Date().toISOString(),
        rol: 'punto-de-venta',
      });
      console.log(`[ServicioSupabase] Presencia actualizada: "${nombreDispositivo}"`);
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error al actualizar presencia de dispositivo:', err);
    }
  }

  /**
   * Comprueba si la base de datos REST está viva antes de degradar el estado a offline.
   */
  private async verificarSaludRapida(): Promise<void> {
    try {
      if (this.cliente) {
        const { error } = await this.cliente.from('mesas').select('id').limit(1);
        if (!error) {
          // La base de datos responde perfectamente por HTTP
          this.conectado = true;
          this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: true });
          this.programarReconexion(1500);
          return;
        }
      }
    } catch {
      // Fallo de red
    }
    this.conectado = false;
    this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: false });
    this.programarReconexion(2000);
  }

  /**
   * Programa un reintento de conexión rápido.
   */
  private programarReconexion(demoraFija?: number): void {
    if (this.timerReconexion) {
      clearTimeout(this.timerReconexion);
    }
    if (!this.tieneCredenciales()) return;

    const demora = demoraFija ?? Math.min(4000, 1500 * Math.pow(1.2, this.intentosReconexion));
    this.intentosReconexion++;

    this.timerReconexion = setTimeout(() => {
      this.verificarYReconectar(true);
    }, demora);
  }

  /**
   * Verifica la salud de la conexión y reconecta de inmediato si se cortó.
   */
  public async verificarYReconectar(forzarReiniciarCanal = false): Promise<void> {
    if (this.verificandoSalud || !this.tieneCredenciales()) return;
    this.verificandoSalud = true;

    try {
      if (!this.cliente) {
        this.inicializarClienteDesdeStorage();
        this.verificandoSalud = false;
        return;
      }

      // Verificación de salud ultraliviana
      const { error } = await this.cliente.from('mesas').select('id').limit(1);

      if (!error) {
        const estabaDesconectado = !this.conectado;
        this.conectado = true;
        this.intentosReconexion = 0;

        if (estabaDesconectado) {
          this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: true });
        }

        if (estabaDesconectado || forzarReiniciarCanal || !this.canal) {
          console.log('[ServicioSupabase] Servidor Supabase responde. Reanudando canal Realtime...');
          this.iniciarCanalRealtime();
          this.procesarColaOffline().catch(console.error);
        }
      } else {
        console.warn('[ServicioSupabase] Verificación de salud falló:', error.message);
        this.conectado = false;
        this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: false });
        this.programarReconexion();
      }
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error en verificación de salud:', err);
      this.conectado = false;
      this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: false });
      this.programarReconexion();
    } finally {
      this.verificandoSalud = false;
    }
  }

  /**
   * Monitoreo activo tipo Heartbeat / Latido cada 8 segundos.
   */
  private iniciarMonitoreoLatido(): void {
    if (this.timerLatido) clearInterval(this.timerLatido);

    this.timerLatido = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (this.conectado) {
          this.conectado = false;
          this.notificarListeners('ESTADO_CONEXION_ACTUALIZADO', { conectado: false });
        }
        return;
      }

      if (this.tieneCredenciales()) {
        this.verificarYReconectar(false).catch((err: unknown) => {
          console.error('[ServicioSupabase] Error en latido periódico:', err);
        });
      }
    }, 8000);
  }

  public suscribir(listener: ListenerSupabaseSync): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notificarListeners(tipo: string, payload: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(tipo, payload);
      } catch (err: unknown) {
        console.error('[ServicioSupabase] Error en listener:', err);
      }
    }
  }

  public estaConectado(): boolean {
    return this.conectado;
  }

  public tieneCredenciales(): boolean {
    const { url, key } = this.obtenerCredenciales();
    return Boolean(url && key);
  }

  // =========================================================================
  // GESTIÓN DE COLA OFFLINE (OUTBOX PATTERN)
  // =========================================================================

  private obtenerColaOffline(): AccionOffline[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(ServicioSupabase.CLAVE_COLA_OFFLINE);
      return raw ? (JSON.parse(raw) as AccionOffline[]) : [];
    } catch {
      return [];
    }
  }

  private guardarColaOffline(cola: AccionOffline[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ServicioSupabase.CLAVE_COLA_OFFLINE, JSON.stringify(cola));
    } catch (err: unknown) {
      console.error('[ServicioSupabase] Error al persistir cola offline:', err);
    }
  }

  private encolarAccionOffline(accion: Omit<AccionOffline, 'id' | 'timestamp'>): void {
    const nuevaAccion: AccionOffline = {
      ...accion,
      id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    const cola = this.obtenerColaOffline();
    cola.push(nuevaAccion);
    this.guardarColaOffline(cola);
  }

  public async procesarColaOffline(): Promise<void> {
    if (this.procesandoCola || !this.cliente) return;
    const cola = this.obtenerColaOffline();
    if (cola.length === 0) return;

    this.procesandoCola = true;
    const colaRestante: AccionOffline[] = [];

    for (const accion of cola) {
      try {
        if (accion.operacion === 'UPSERT') {
          const { error } = await this.cliente
            .from(accion.tabla)
            .upsert(accion.datos as Record<string, unknown>);
          if (error) {
            console.warn(`[ServicioSupabase] Reintento pendiente en ${accion.tabla}:`, error.message);
            colaRestante.push(accion);
          }
        } else if (accion.operacion === 'DELETE') {
          const datosObj = accion.datos as { id?: string };
          if (datosObj?.id) {
            const { error } = await this.cliente
              .from(accion.tabla)
              .delete()
              .eq('id', datosObj.id);
            if (error) {
              console.warn(`[ServicioSupabase] Reintento delete pendiente en ${accion.tabla}:`, error.message);
              colaRestante.push(accion);
            }
          }
        }
      } catch {
        colaRestante.push(accion);
      }
    }

    this.guardarColaOffline(colaRestante);
    this.procesandoCola = false;
  }

  // =========================================================================
  // OPERACIONES DE ESCRITURA CON RESOLUCIÓN OFFLINE
  // =========================================================================

  public async eliminarMesaRemota(mesaId: string): Promise<void> {
    if (!mesaId) return;

    if (!this.cliente || !navigator.onLine) {
      this.encolarAccionOffline({ tabla: 'mesas', operacion: 'DELETE', datos: { id: mesaId } });
      return;
    }

    try {
      const { error } = await this.cliente.from('mesas').delete().eq('id', mesaId);
      if (error) {
        console.warn('[ServicioSupabase] Error al eliminar mesa remota, encolando offline:', error.message);
        this.encolarAccionOffline({ tabla: 'mesas', operacion: 'DELETE', datos: { id: mesaId } });
      }
    } catch {
      this.encolarAccionOffline({ tabla: 'mesas', operacion: 'DELETE', datos: { id: mesaId } });
    }
  }

  public async guardarMesa(mesa: Mesa): Promise<void> {
    const fila = {
      id: mesa.id,
      numero: mesa.numero,
      nombre: mesa.nombre,
      capacidad: mesa.capacidad,
      estado: mesa.estado,
      area: mesa.area,
      total_parcial: mesa.totalParcial,
      cuenta_activa_id: mesa.cuentaActivaId,
      hora_apertura: mesa.horaApertura,
      mesero_asignado: mesa.meseroAsignado ?? null,
      actualizado_en: new Date().toISOString(),
    };

    if (!this.cliente || !navigator.onLine) {
      this.encolarAccionOffline({ tabla: 'mesas', operacion: 'UPSERT', datos: fila });
      return;
    }

    try {
      const { error } = await this.cliente.from('mesas').upsert(fila);
      if (error) {
        this.encolarAccionOffline({ tabla: 'mesas', operacion: 'UPSERT', datos: fila });
      }
    } catch {
      this.encolarAccionOffline({ tabla: 'mesas', operacion: 'UPSERT', datos: fila });
    }
  }

  public async guardarMesas(mesas: Mesa[]): Promise<void> {
    const filas = mesas.map((m) => ({
      id: m.id,
      numero: m.numero,
      nombre: m.nombre,
      capacidad: m.capacidad,
      estado: m.estado,
      area: m.area,
      total_parcial: m.totalParcial,
      cuenta_activa_id: m.cuentaActivaId,
      hora_apertura: m.horaApertura,
      mesero_asignado: m.meseroAsignado ?? null,
      actualizado_en: new Date().toISOString(),
    }));

    if (!this.cliente || !navigator.onLine) {
      for (const fila of filas) {
        this.encolarAccionOffline({ tabla: 'mesas', operacion: 'UPSERT', datos: fila });
      }
      return;
    }

    try {
      const { error } = await this.cliente.from('mesas').upsert(filas);
      if (error) {
        for (const fila of filas) {
          this.encolarAccionOffline({ tabla: 'mesas', operacion: 'UPSERT', datos: fila });
        }
      }
    } catch {
      for (const fila of filas) {
        this.encolarAccionOffline({ tabla: 'mesas', operacion: 'UPSERT', datos: fila });
      }
    }
  }

  public async guardarCuentas(cuentas: Record<string, Cuenta>): Promise<void> {
    const lista = Object.values(cuentas);
    if (lista.length === 0) return;

    const filas = lista.map((c) => ({
      id: c.id,
      mesa_id: c.mesaId,
      numero_mesa: c.numeroMesa,
      nombre_mesa: c.nombreMesa,
      items: c.items,
      subtotal: c.subtotal,
      descuento: c.descuento,
      propina: c.propina,
      total: c.total,
      estado: c.estado,
      hora_apertura: c.horaApertura,
      hora_cierre: c.horaCierre,
      mesero: c.mesero,
      metodo_pago: c.metodoPago ?? null,
      division_cuenta: c.divisionCuenta ?? null,
      desglose_mixto: c.desgloseMixto ?? null,
      actualizado_en: new Date().toISOString(),
    }));

    if (!this.cliente || !navigator.onLine) {
      for (const fila of filas) {
        this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: fila });
      }
      return;
    }

    try {
      const { error } = await this.cliente.from('cuentas').upsert(filas);
      if (error) {
        for (const fila of filas) {
          this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: fila });
        }
      }
    } catch {
      for (const fila of filas) {
        this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: fila });
      }
    }
  }

  public async guardarCuentaIndividual(cuenta: Cuenta): Promise<void> {
    const fila = {
      id: cuenta.id,
      mesa_id: cuenta.mesaId,
      numero_mesa: cuenta.numeroMesa,
      nombre_mesa: cuenta.nombreMesa,
      items: cuenta.items,
      subtotal: cuenta.subtotal,
      descuento: cuenta.descuento,
      propina: cuenta.propina,
      total: cuenta.total,
      estado: cuenta.estado,
      hora_apertura: cuenta.horaApertura,
      hora_cierre: cuenta.horaCierre,
      mesero: cuenta.mesero,
      metodo_pago: cuenta.metodoPago ?? null,
      division_cuenta: cuenta.divisionCuenta ?? null,
      desglose_mixto: cuenta.desgloseMixto ?? null,
      actualizado_en: new Date().toISOString(),
    };

    if (!this.cliente || !navigator.onLine) {
      this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: fila });
      return;
    }

    try {
      const { error } = await this.cliente.from('cuentas').upsert(fila);
      if (error) {
        this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: fila });
      }
    } catch {
      this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: fila });
    }
  }

  public async cancelarCuentaRemota(cuentaId: string): Promise<void> {
    if (!cuentaId) return;
    const filaActualizada = {
      id: cuentaId,
      estado: 'cancelada',
      actualizado_en: new Date().toISOString(),
    };

    if (!this.cliente || !navigator.onLine) {
      this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: filaActualizada });
      return;
    }

    try {
      const { error } = await this.cliente
        .from('cuentas')
        .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
        .eq('id', cuentaId);
      if (error) {
        this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: filaActualizada });
      }
    } catch {
      this.encolarAccionOffline({ tabla: 'cuentas', operacion: 'UPSERT', datos: filaActualizada });
    }
  }

  public async cancelarCuentasDeMesaRemota(mesaId: string, numeroMesa: number): Promise<void> {
    if (!mesaId) return;
    if (!this.cliente || !navigator.onLine) {
      return;
    }

    try {
      await this.cliente
        .from('cuentas')
        .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
        .eq('estado', 'abierta')
        .or(`mesa_id.eq.${mesaId},numero_mesa.eq.${numeroMesa}`);
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error al cancelar cuentas de mesa remota:', err);
    }
  }

  /**
   * Cancela de forma atómica todas las cuentas que se encuentren abiertas en Supabase.
   */
  public async cancelarTodasLasCuentasAbiertasRemotas(): Promise<void> {
    if (!this.cliente || !navigator.onLine) return;
    try {
      await this.cliente
        .from('cuentas')
        .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
        .eq('estado', 'abierta');
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error al cancelar todas las cuentas abiertas remotas:', err);
    }
  }

  /**
   * Libera una mesa en Supabase restableciéndola a estado libre y cancelando
   * cualquier cuenta abierta o pedido en cocina asociado.
   */
  public async liberarMesaRemota(mesaId: string, numeroMesa?: number): Promise<void> {
    if (!this.cliente || !navigator.onLine) return;
    try {
      let queryMesa = this.cliente.from('mesas').update({
        estado: 'libre',
        total_parcial: 0,
        cuenta_activa_id: null,
        hora_apertura: null,
        mesero_asignado: null,
        actualizado_en: new Date().toISOString(),
      });

      if (typeof numeroMesa === 'number') {
        queryMesa = queryMesa.or(`id.eq.${mesaId},numero.eq.${numeroMesa}`);
      } else {
        queryMesa = queryMesa.eq('id', mesaId);
      }
      await queryMesa;

      let queryCuentas = this.cliente
        .from('cuentas')
        .update({
          estado: 'cancelada',
          actualizado_en: new Date().toISOString(),
        })
        .eq('estado', 'abierta');

      if (typeof numeroMesa === 'number') {
        queryCuentas = queryCuentas.or(`mesa_id.eq.${mesaId},numero_mesa.eq.${numeroMesa}`);
      } else {
        queryCuentas = queryCuentas.eq('mesa_id', mesaId);
      }
      await queryCuentas;

      await this.cliente
        .from('pedidos_cocina')
        .update({
          estado: 'entregado',
          actualizado_en: new Date().toISOString(),
        })
        .eq('mesa_id', mesaId)
        .neq('estado', 'entregado');
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error al liberar mesa remota:', err);
    }
  }

  public async cancelarPedidosCocinaDeMesa(mesaId: string): Promise<void> {
    if (!mesaId || !this.cliente || !navigator.onLine) return;
    try {
      await this.cliente
        .from('pedidos_cocina')
        .update({ estado: 'entregado', actualizado_en: new Date().toISOString() })
        .eq('mesa_id', mesaId)
        .neq('estado', 'entregado');
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error al limpiar pedidos de cocina de mesa:', err);
    }
  }

  /**
   * Marca como entregados todos los pedidos de cocina activos en Supabase al cerrar turno.
   */
  public async cancelarTodosLosPedidosCocinaPendientesRemotos(): Promise<void> {
    if (!this.cliente || !navigator.onLine) return;
    try {
      await this.cliente
        .from('pedidos_cocina')
        .update({ estado: 'entregado', actualizado_en: new Date().toISOString() })
        .neq('estado', 'entregado');
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] Error al cancelar pedidos de cocina pendientes remotos:', err);
    }
  }

  public async guardarPedidoCocina(pedido: PedidoCocina): Promise<void> {
    const fila = {
      id: pedido.id,
      comanda_id: pedido.comandaId,
      mesa_id: pedido.mesaId,
      nombre_mesa: pedido.nombreMesa,
      mesero: pedido.mesero,
      hora_envio: pedido.horaEnvio,
      items: pedido.items,
      estado: pedido.estado,
      actualizado_en: new Date().toISOString(),
    };

    if (!this.cliente || !navigator.onLine) {
      this.encolarAccionOffline({ tabla: 'pedidos_cocina', operacion: 'UPSERT', datos: fila });
      return;
    }

    try {
      const { error } = await this.cliente.from('pedidos_cocina').upsert(fila);
      if (error) {
        this.encolarAccionOffline({ tabla: 'pedidos_cocina', operacion: 'UPSERT', datos: fila });
      }
    } catch {
      this.encolarAccionOffline({ tabla: 'pedidos_cocina', operacion: 'UPSERT', datos: fila });
    }
  }

  public async guardarCorte(corte: CorteCaja): Promise<void> {
    const fila = {
      id: corte.id,
      fecha_apertura: corte.fechaApertura,
      fecha_cierre: corte.fechaCierre,
      total_ventas: corte.totalVentas,
      total_efectivo: corte.totalEfectivo,
      total_tarjeta: corte.totalTarjeta,
      total_transferencia: corte.totalTransferencia,
      cuentas_cobradas_count: corte.cuentasCobradasCount,
      ticket_promedio: corte.ticketPromedio,
      esta_abierto: corte.estaAbierto,
      pin_seguridad: corte.pinSeguridad,
      actualizado_en: new Date().toISOString(),
    };

    if (!this.cliente || !navigator.onLine) {
      this.encolarAccionOffline({ tabla: 'cortes_caja', operacion: 'UPSERT', datos: fila });
      return;
    }

    try {
      const { error } = await this.cliente.from('cortes_caja').upsert(fila);
      if (error) {
        this.encolarAccionOffline({ tabla: 'cortes_caja', operacion: 'UPSERT', datos: fila });
      }
    } catch {
      this.encolarAccionOffline({ tabla: 'cortes_caja', operacion: 'UPSERT', datos: fila });
    }
  }

  // =========================================================================
  // CARGA COMPLETA DE ESTADO DESDE SUPABASE
  // =========================================================================

  public async obtenerEstadoRemoto(): Promise<{
    mesas: Mesa[];
    cuentasActivas: Record<string, Cuenta>;
    cuentasCerradas: Cuenta[];
    pedidosCocina: PedidoCocina[];
    corteActual: CorteCaja | null;
  } | null> {
    if (!this.cliente || !navigator.onLine) return null;

    try {
      const [resMesas, resCuentas, resCuentasCerradas, resCocina, resCorte] = await Promise.all([
        this.cliente.from('mesas').select('*').order('numero', { ascending: true }),
        this.cliente.from('cuentas').select('*').eq('estado', 'abierta'),
        this.cliente.from('cuentas').select('*').eq('estado', 'cerrada').order('hora_cierre', { ascending: false }).limit(100),
        this.cliente.from('pedidos_cocina').select('*').order('hora_envio', { ascending: false }).limit(150),
        this.cliente.from('cortes_caja').select('*').order('fecha_apertura', { ascending: false }).limit(1),
      ]);

      if (resMesas.error || resCuentas.error || resCocina.error) {
        console.warn('[ServicioSupabase] Error parcial al cargar estado:', resMesas.error?.message);
        return null;
      }

      interface FilaMesaSupabase {
        id: string;
        numero: number;
        nombre: string;
        capacidad: number;
        estado: string;
        area: string;
        total_parcial: number;
        cuenta_activa_id: string | null;
        hora_apertura: string | null;
        mesero_asignado: string | null;
        notas: string | null;
      }

      const mesasMapeadas: Mesa[] = ((resMesas.data ?? []) as FilaMesaSupabase[]).map((m) => ({
        id: m.id,
        numero: m.numero,
        nombre: m.nombre,
        capacidad: m.capacidad,
        estado: m.estado as Mesa['estado'],
        area: m.area as Mesa['area'],
        totalParcial: Number(m.total_parcial ?? 0),
        cuentaActivaId: m.cuenta_activa_id,
        horaApertura: m.hora_apertura,
        meseroAsignado: m.mesero_asignado ?? undefined,
      }));

      interface FilaCuentaSupabase {
        id: string;
        mesa_id: string;
        numero_mesa: number;
        nombre_mesa: string;
        items: unknown;
        subtotal: number;
        descuento: number;
        propina: number;
        total: number;
        estado: string;
        hora_apertura: string;
        hora_cierre: string | null;
        mesero: string;
        metodo_pago: string | null;
        division_cuenta: unknown;
        desglose_mixto: unknown;
      }

      const cuentasActivas: Record<string, Cuenta> = {};
      for (const c of (resCuentas.data ?? []) as FilaCuentaSupabase[]) {
        cuentasActivas[c.id] = {
          id: c.id,
          mesaId: c.mesa_id,
          numeroMesa: c.numero_mesa,
          nombreMesa: c.nombre_mesa,
          items: Array.isArray(c.items) ? (c.items as Cuenta['items']) : [],
          subtotal: Number(c.subtotal ?? 0),
          descuento: Number(c.descuento ?? 0),
          propina: Number(c.propina ?? 0),
          total: Number(c.total ?? 0),
          estado: c.estado as Cuenta['estado'],
          horaApertura: c.hora_apertura,
          horaCierre: c.hora_cierre,
          mesero: c.mesero,
          metodoPago: c.metodo_pago ? (c.metodo_pago as Cuenta['metodoPago']) : undefined,
          divisionCuenta: c.division_cuenta ? (c.division_cuenta as Cuenta['divisionCuenta']) : undefined,
          desgloseMixto: c.desglose_mixto ? (c.desglose_mixto as Cuenta['desgloseMixto']) : undefined,
        };
      }

      const cuentasCerradas: Cuenta[] = ((resCuentasCerradas?.data ?? []) as FilaCuentaSupabase[]).map((c) => ({
        id: c.id,
        mesaId: c.mesa_id,
        numeroMesa: c.numero_mesa,
        nombreMesa: c.nombre_mesa,
        items: Array.isArray(c.items) ? (c.items as Cuenta['items']) : [],
        subtotal: Number(c.subtotal ?? 0),
        descuento: Number(c.descuento ?? 0),
        propina: Number(c.propina ?? 0),
        total: Number(c.total ?? 0),
        estado: 'cerrada' as Cuenta['estado'],
        horaApertura: c.hora_apertura,
        horaCierre: c.hora_cierre,
        mesero: c.mesero,
        metodoPago: c.metodo_pago ? (c.metodo_pago as Cuenta['metodoPago']) : undefined,
        divisionCuenta: c.division_cuenta ? (c.division_cuenta as Cuenta['divisionCuenta']) : undefined,
        desgloseMixto: c.desglose_mixto ? (c.desglose_mixto as Cuenta['desgloseMixto']) : undefined,
      }));

      interface FilaCocinaSupabase {
        id: string;
        comanda_id: string;
        mesa_id: string;
        nombre_mesa: string;
        mesero: string;
        hora_envio: string;
        items: unknown;
        estado: string;
      }

      const pedidosCocina: PedidoCocina[] = ((resCocina.data ?? []) as FilaCocinaSupabase[]).map((p) => ({
        id: p.id,
        comandaId: p.comanda_id,
        mesaId: p.mesa_id,
        nombreMesa: p.nombre_mesa,
        mesero: p.mesero,
        horaEnvio: p.hora_envio,
        items: Array.isArray(p.items) ? (p.items as PedidoCocina['items']) : [],
        estado: p.estado as PedidoCocina['estado'],
      }));

      interface FilaCorteSupabase {
        id: string;
        fecha_apertura: string;
        fecha_cierre: string | null;
        total_ventas: number;
        total_efectivo: number;
        total_tarjeta: number;
        total_transferencia: number;
        cuentas_cobradas_count: number;
        ticket_promedio: number;
        esta_abierto: boolean;
        pin_seguridad: string;
      }

      let corteActual: CorteCaja | null = null;
      if (resCorte.data && resCorte.data.length > 0) {
        const corteFila = resCorte.data[0] as FilaCorteSupabase;
        corteActual = {
          id: corteFila.id,
          fechaApertura: corteFila.fecha_apertura,
          fechaCierre: corteFila.fecha_cierre,
          totalVentas: Number(corteFila.total_ventas ?? 0),
          totalEfectivo: Number(corteFila.total_efectivo ?? 0),
          totalTarjeta: Number(corteFila.total_tarjeta ?? 0),
          totalTransferencia: Number(corteFila.total_transferencia ?? 0),
          cuentasCobradasCount: Number(corteFila.cuentas_cobradas_count ?? 0),
          ticketPromedio: Number(corteFila.ticket_promedio ?? 0),
          estaAbierto: Boolean(corteFila.esta_abierto),
          pinSeguridad: corteFila.pin_seguridad ?? '1234',
        };
      }

      return {
        mesas: deduplicarYSanearMesas(mesasMapeadas),
        cuentasActivas,
        cuentasCerradas,
        pedidosCocina,
        corteActual,
      };
    } catch (err: unknown) {
      console.error('[ServicioSupabase] Excepción al obtener estado remoto:', err);
      return null;
    }
  }

  /**
   * Consulta el historial de cortes de caja pasados archivados en Supabase.
   */
  public async obtenerHistorialCortes(): Promise<TurnoCerrado[]> {
    if (!this.cliente || !navigator.onLine) return [];
    try {
      interface FilaCorteHistorico {
        id: string;
        fecha_apertura: string;
        fecha_cierre: string | null;
        total_ventas: number;
        total_efectivo: number;
        total_tarjeta: number;
        total_transferencia: number;
        cuentas_cobradas_count: number;
        ticket_promedio: number;
        esta_abierto: boolean;
        pin_seguridad: string;
      }

      const { data, error } = await this.cliente
        .from('cortes_caja')
        .select('*')
        .eq('esta_abierto', false)
        .order('fecha_apertura', { ascending: false })
        .limit(60);

      if (error || !data) {
        console.warn('[ServicioSupabase.obtenerHistorialCortes] Error al consultar historial:', error?.message);
        return [];
      }

      const filas = data as FilaCorteHistorico[];
      return filas.map((fila) => ({
        id: fila.id,
        fechaApertura: fila.fecha_apertura,
        fechaCierre: fila.fecha_cierre ?? fila.fecha_apertura,
        totalVentas: Number(fila.total_ventas ?? 0),
        totalEfectivo: Number(fila.total_efectivo ?? 0),
        totalTarjeta: Number(fila.total_tarjeta ?? 0),
        totalTransferencia: Number(fila.total_transferencia ?? 0),
        cuentasCobradasCount: Number(fila.cuentas_cobradas_count ?? 0),
        ticketPromedio: Number(fila.ticket_promedio ?? 0),
        estaAbierto: false,
        pinSeguridad: fila.pin_seguridad ?? '2430',
        cuentasCobradas: [],
      }));
    } catch (err: unknown) {
      console.error('[ServicioSupabase.obtenerHistorialCortes] Excepción:', err);
      return [];
    }
  }

  // =========================================================================
  // GESTIÓN DEL CATÁLOGO DE PRODUCTOS EN LA NUBE (SUPABASE STORAGE)
  // =========================================================================

  /**
   * Sube una foto en base64 (DataURL) a Supabase Storage y retorna la URL pública permanente.
   * Si ya es una URL HTTP(S), la devuelve intacta sin procesar.
   */
  public async subirFotoPlatillo(idProducto: string, dataUrl: string): Promise<string> {
    if (!this.cliente || !dataUrl || !dataUrl.startsWith('data:')) {
      return dataUrl;
    }

    try {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return dataUrl;
      }

      const mimeType = match[1] || 'image/webp';
      const base64Data = match[2];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'webp';
      const nombreArchivo = `fotos/${idProducto}-${Date.now()}.${extension}`;

      const { error } = await this.cliente.storage
        .from('actualizaciones')
        .upload(nombreArchivo, byteNumbers, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '31536000',
        });

      if (error) {
        console.warn('[ServicioSupabase] Error subiendo foto a storage:', error.message);
        return dataUrl;
      }

      const creds = this.obtenerCredenciales();
      const urlPublica = `${creds.url}/storage/v1/object/public/actualizaciones/${nombreArchivo}`;
      console.log(`[ServicioSupabase] Foto de platillo subida con éxito: ${urlPublica}`);
      return urlPublica;
    } catch (err: unknown) {
      console.error('[ServicioSupabase] Error al convertir/subir foto de platillo:', err);
      return dataUrl;
    }
  }

  /**
   * Guarda y sincroniza la lista completa de productos en Supabase Storage (catalogo/productos.json).
   */
  public async guardarCatalogoProductosRemoto(productos: Producto[]): Promise<boolean> {
    if (!this.cliente) return false;

    try {
      const contenidoJson = JSON.stringify(productos);
      const blob = new Blob([contenidoJson], { type: 'application/json' });

      const { error } = await this.cliente.storage
        .from('actualizaciones')
        .upload('catalogo/productos.json', blob, {
          contentType: 'application/json',
          upsert: true,
          cacheControl: '15',
        });

      if (error) {
        console.warn('[ServicioSupabase] Error al guardar catálogo en storage:', error.message);
        return false;
      }

      // Notificar por Broadcast Realtime si el canal está abierto
      if (this.canal) {
        try {
          this.canal.send({
            type: 'broadcast',
            event: 'CATALOGO_PRODUCTOS_ACTUALIZADO',
            payload: { timestamp: Date.now() },
          });
        } catch {
          // Ignorar si el canal no está listo
        }
      }

      console.log('[ServicioSupabase] Catálogo de productos sincronizado con Supabase Storage.');
      return true;
    } catch (err: unknown) {
      console.error('[ServicioSupabase] Excepción al guardar catálogo en Supabase Storage:', err);
      return false;
    }
  }

  /**
   * Descarga el catálogo global de productos desde Supabase Storage si existe.
   */
  public async obtenerCatalogoProductosRemoto(): Promise<Producto[] | null> {
    try {
      const creds = this.obtenerCredenciales();
      const urlPublica = `${creds.url}/storage/v1/object/public/actualizaciones/catalogo/productos.json?_t=${Date.now()}`;
      const resp = await fetch(urlPublica, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!resp.ok) {
        return null;
      }

      const datos = (await resp.json()) as Producto[];
      if (Array.isArray(datos) && datos.length > 0) {
        return datos;
      }
      return null;
    } catch (err: unknown) {
      console.warn('[ServicioSupabase] No se pudo descargar catálogo remoto de productos:', err);
      return null;
    }
  }
}

export const servicioSupabase = ServicioSupabase.obtenerInstancia();
