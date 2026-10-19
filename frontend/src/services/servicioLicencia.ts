import { SupabaseClient } from '@supabase/supabase-js';
import { servicioSupabase } from './servicioSupabase';

export interface EstadoLicencia {
  activa: boolean;
  motivo: string;
  titulo: string;
  mensaje: string;
  contacto: string;
  fechaVencimiento?: string | null;
  fechaSuspension?: string | null;
  verificadoEn?: string;
}

/**
 * ============================================================================
 * INTERRUPTOR DE LICENCIA EN CÓDIGO (SUSPENSIÓN DIRECTA)
 * ============================================================================
 * Para activar el bloqueo desde el código, cambia BLOQUEO_MANUAL_ACTIVO a true.
 * Para reactivar el servicio normal, cámbialo a false.
 */
export const CONTROL_LICENCIA_CODIGO = {
  BLOQUEO_MANUAL_ACTIVO: false, // Desactivado: Servicio reactivado y operando con normalidad
  TELEFONO_CONTACTO: '81 2433 8078',
  TITULO: 'Servicio Temporalmente Suspendido',
  MENSAJE: 'El acceso al sistema ha sido suspendido por falta de pago. Debe realizar su pago antes de continuar utilizando la aplicación.',
};

type ListenerLicencia = (estado: EstadoLicencia) => void;

export class ServicioLicencia {
  private static instancia: ServicioLicencia | null = null;
  private readonly CLAVE_CACHE = 'taqueria_estado_licencia_cache';
  private readonly CLAVE_BLOQUEO_PERSISTENTE = 'taqueria_bloqueo_licencia_activo';
  private listeners: Set<ListenerLicencia> = new Set();
  private canalRealtime: ReturnType<SupabaseClient['channel']> | null = null;
  private intervaloVerificacion: ReturnType<typeof setInterval> | null = null;

  private estadoActual: EstadoLicencia = {
    activa: !CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO,
    motivo: CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO ? 'FALTA_DE_PAGO' : 'AL_CORRIENTE',
    titulo: CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO
      ? CONTROL_LICENCIA_CODIGO.TITULO
      : 'Servicio Activo',
    mensaje: CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO
      ? CONTROL_LICENCIA_CODIGO.MENSAJE
      : 'El sistema se encuentra operando con normalidad.',
    contacto: CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO
      ? `Atención y pagos: ${CONTROL_LICENCIA_CODIGO.TELEFONO_CONTACTO}`
      : 'Soporte Técnico Oficial',
  };

  private constructor() {
    this.cargarEstadoInicial();
    this.iniciarMonitoreo();
  }

  public static obtenerInstancia(): ServicioLicencia {
    if (!ServicioLicencia.instancia) {
      ServicioLicencia.instancia = new ServicioLicencia();
    }
    return ServicioLicencia.instancia;
  }

  /**
   * Carga el estado almacenado localmente.
   * Si existe un bloqueo persistente registrado, no se permite el acceso hasta confirmar con el servidor.
   */
  private cargarEstadoInicial(): void {
    if (typeof window === 'undefined') return;

    if (CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO) {
      this.estadoActual = {
        activa: false,
        motivo: 'FALTA_DE_PAGO',
        titulo: CONTROL_LICENCIA_CODIGO.TITULO,
        mensaje: CONTROL_LICENCIA_CODIGO.MENSAJE,
        contacto: `Atención y pagos: ${CONTROL_LICENCIA_CODIGO.TELEFONO_CONTACTO}`,
        verificadoEn: new Date().toISOString(),
      };
      return;
    }

    try {
      // Si el desarrollador desactivó el bloqueo manual, remover bloqueo persistente de prueba
      localStorage.removeItem(this.CLAVE_BLOQUEO_PERSISTENTE);
      localStorage.removeItem(this.CLAVE_CACHE);
      const bloqueoPersistente = localStorage.getItem(this.CLAVE_BLOQUEO_PERSISTENTE);
      const cacheGuardada = localStorage.getItem(this.CLAVE_CACHE);

      if (bloqueoPersistente === 'true') {
        // Había un bloqueo previo: iniciar bloqueado como medida anti-evasión offline
        if (cacheGuardada) {
          const parsed = JSON.parse(cacheGuardada) as EstadoLicencia;
          this.estadoActual = { ...parsed, activa: false };
        } else {
          this.estadoActual = {
            activa: false,
            motivo: 'PAGO_PENDIENTE',
            titulo: 'Servicio Temporalmente Suspendido',
            mensaje: 'El acceso al sistema ha sido suspendido por falta de pago.',
            contacto: 'Favor de comunicarse con el proveedor del software para regularizar su cuenta.',
          };
        }
      } else if (cacheGuardada) {
        const parsed = JSON.parse(cacheGuardada) as EstadoLicencia;
        this.estadoActual = parsed;
      }
    } catch (err: unknown) {
      console.error('[ServicioLicencia] Error al leer caché inicial:', err);
    }
  }

  /**
   * Inicia la suscripción en tiempo real y la verificación periódica
   */
  private iniciarMonitoreo(): void {
    if (typeof window === 'undefined') return;

    // 1. Verificación inicial inmediata
    this.verificarEstadoServidor().catch((e: unknown) => {
      console.error('[ServicioLicencia] Error en verificación inicial:', e);
    });

    // 2. Conectar canal en tiempo real cuando Supabase esté listo
    this.configurarCanalRealtime();

    // 3. Revisión periódica cada 3 minutos
    this.intervaloVerificacion = setInterval(() => {
      this.verificarEstadoServidor().catch((e: unknown) => {
        console.error('[ServicioLicencia] Error en verificación periódica:', e);
      });
    }, 3 * 60 * 1000);

    // 4. Al volver de segundo plano o recuperar red, verificar de inmediato
    window.addEventListener('online', () => {
      this.verificarEstadoServidor().catch(console.error);
      this.configurarCanalRealtime();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.verificarEstadoServidor().catch(console.error);
      }
    });
  }

  /**
   * Configura la escucha en tiempo real de mutaciones sobre la tabla licencia_sistema
   */
  public configurarCanalRealtime(): void {
    const cliente = servicioSupabase.obtenerCliente();
    if (!cliente) return;

    if (this.canalRealtime) {
      try {
        cliente.removeChannel(this.canalRealtime);
      } catch (err: unknown) {
        console.warn('[ServicioLicencia] Error al limpiar canal previo:', err);
      }
      this.canalRealtime = null;
    }

    try {
      this.canalRealtime = cliente
        .channel('licencia_sistema_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'licencia_sistema' },
          (payload) => {
            const nuevoRegistro = payload.new as Partial<EstadoLicencia> | null;
            if (nuevoRegistro && typeof nuevoRegistro.activa === 'boolean') {
              this.aplicarNuevoEstado({
                activa: nuevoRegistro.activa,
                motivo: nuevoRegistro.motivo || 'PAGO_PENDIENTE',
                titulo: nuevoRegistro.titulo || 'Servicio Suspendido',
                mensaje: nuevoRegistro.mensaje || 'Acceso restringido temporalmente por pago pendiente.',
                contacto: nuevoRegistro.contacto || 'Contacte a soporte técnico.',
                fechaVencimiento: nuevoRegistro.fechaVencimiento || null,
                fechaSuspension: nuevoRegistro.fechaSuspension || null,
                verificadoEn: new Date().toISOString(),
              });
            }
          }
        )
        .subscribe();
    } catch (err: unknown) {
      console.error('[ServicioLicencia] Error al conectar canal Realtime:', err);
    }
  }

  /**
   * Consulta el estado actual de la licencia en Supabase
   */
  public async verificarEstadoServidor(): Promise<EstadoLicencia> {
    if (CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO) {
      const estadoBloqueado: EstadoLicencia = {
        activa: false,
        motivo: 'FALTA_DE_PAGO',
        titulo: CONTROL_LICENCIA_CODIGO.TITULO,
        mensaje: CONTROL_LICENCIA_CODIGO.MENSAJE,
        contacto: `Atención y pagos: ${CONTROL_LICENCIA_CODIGO.TELEFONO_CONTACTO}`,
        verificadoEn: new Date().toISOString(),
      };
      this.aplicarNuevoEstado(estadoBloqueado);
      return estadoBloqueado;
    }

    const cliente = servicioSupabase.obtenerCliente();
    if (!cliente) {
      return this.estadoActual;
    }

    try {
      const { data, error } = await cliente
        .from('licencia_sistema')
        .select('*')
        .eq('id', 'principal')
        .limit(1)
        .maybeSingle();

      if (error) {
        // Si la tabla no ha sido creada aún (PGRST205), permitir operación normal
        if (error.code === 'PGRST205') {
          return this.estadoActual;
        }
        console.error('[ServicioLicencia] Error al consultar licencia en servidor:', error);
        return this.estadoActual;
      }

      if (data && typeof data.activa === 'boolean') {
        const nuevoEstado: EstadoLicencia = {
          activa: data.activa,
          motivo: data.motivo || 'AL_CORRIENTE',
          titulo: data.titulo || (data.activa ? 'Servicio Activo' : 'Servicio Suspendido'),
          mensaje: data.mensaje || (data.activa ? 'Operando con normalidad' : 'Acceso suspendido por pago pendiente'),
          contacto: data.contacto || 'Contacte al proveedor del sistema',
          fechaVencimiento: data.fecha_vencimiento || null,
          fechaSuspension: data.fecha_suspension || null,
          verificadoEn: new Date().toISOString(),
        };

        this.aplicarNuevoEstado(nuevoEstado);
        return nuevoEstado;
      }

      return this.estadoActual;
    } catch (err: unknown) {
      console.error('[ServicioLicencia] Excepción al verificar licencia:', err);
      return this.estadoActual;
    }
  }

  /**
   * Actualiza el estado en memoria y persiste las banderas de seguridad anti-evasión
   */
  private aplicarNuevoEstado(nuevoEstado: EstadoLicencia): void {
    this.estadoActual = nuevoEstado;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.CLAVE_CACHE, JSON.stringify(nuevoEstado));

        if (!nuevoEstado.activa) {
          // Si el estado es inactivo, fijar bloqueo persistente
          localStorage.setItem(this.CLAVE_BLOQUEO_PERSISTENTE, 'true');
        } else {
          // Solo la confirmación de activa: true del servidor puede remover el bloqueo
          localStorage.removeItem(this.CLAVE_BLOQUEO_PERSISTENTE);
        }
      } catch (err: unknown) {
        console.error('[ServicioLicencia] Error al guardar estado en storage:', err);
      }
    }

    // Notificar a todos los componentes observadores
    this.listeners.forEach((callback) => {
      try {
        callback(this.estadoActual);
      } catch (err: unknown) {
        console.error('[ServicioLicencia] Error en listener:', err);
      }
    });
  }

  /**
   * Suscribe un componente para reaccionar ante cambios de licencia
   */
  public suscribir(callback: ListenerLicencia): () => void {
    this.listeners.add(callback);
    // Notificación inmediata del estado actual
    callback(this.estadoActual);

    return () => {
      this.listeners.delete(callback);
    };
  }

  public obtenerEstado(): EstadoLicencia {
    return this.estadoActual;
  }

  public destruir(): void {
    if (this.intervaloVerificacion) {
      clearInterval(this.intervaloVerificacion);
      this.intervaloVerificacion = null;
    }
    if (this.canalRealtime) {
      const cliente = servicioSupabase.obtenerCliente();
      if (cliente) {
        cliente.removeChannel(this.canalRealtime);
      }
      this.canalRealtime = null;
    }
    this.listeners.clear();
  }
}

export const servicioLicencia = ServicioLicencia.obtenerInstancia();
