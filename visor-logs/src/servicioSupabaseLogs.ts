import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { RegistroLog, DetallePresencia } from './types';

export class ServicioSupabaseLogs {
  private static instancia: ServicioSupabaseLogs | null = null;
  private cliente: SupabaseClient;
  private canal: RealtimeChannel | null = null;
  private canalPresencia: RealtimeChannel | null = null;

  public static readonly URL_PREDETERMINADA =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    'https://idgyotujnoavliaqtuck.supabase.co';

  public static readonly ANON_KEY_PREDETERMINADA =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ3lvdHVqbm9hdmxpYXF0dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjg4ODUsImV4cCI6MjEwNzYwNDg4NX0.ywXODlKIzn68R-5dzvQC-evagSsHa7iNkv82l68dJT8';

  private constructor() {
    this.cliente = createClient(
      ServicioSupabaseLogs.URL_PREDETERMINADA,
      ServicioSupabaseLogs.ANON_KEY_PREDETERMINADA,
      {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );
  }

  public static obtenerInstancia(): ServicioSupabaseLogs {
    if (!ServicioSupabaseLogs.instancia) {
      ServicioSupabaseLogs.instancia = new ServicioSupabaseLogs();
    }
    return ServicioSupabaseLogs.instancia;
  }

  /**
   * Verifica si la tabla 'logs_sistema' ya existe en Supabase y es accesible.
   */
  public async verificarEstadoTabla(): Promise<{ tablaExiste: boolean; mensajeError?: string }> {
    try {
      const { error } = await this.cliente
        .from('logs_sistema')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
          return {
            tablaExiste: false,
            mensajeError: 'La tabla "logs_sistema" no existe aún en tu base de datos de Supabase.',
          };
        }
        return { tablaExiste: false, mensajeError: error.message };
      }

      return { tablaExiste: true };
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Error al verificar conexión';
      return { tablaExiste: false, mensajeError: mensaje };
    }
  }

  /**
   * Carga los registros más recientes de Supabase.
   */
  public async obtenerLogs(limite: number = 300): Promise<{ logs: RegistroLog[]; error?: string }> {
    try {
      const { data, error } = await this.cliente
        .from('logs_sistema')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(limite);

      if (error) {
        console.error('[ServicioSupabaseLogs] Error al consultar logs:', error.message);
        return { logs: [], error: error.message };
      }

      return { logs: (data as RegistroLog[]) || [] };
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Excepción al consultar logs';
      console.error('[ServicioSupabaseLogs] Excepción al consultar logs:', err);
      return { logs: [], error: mensaje };
    }
  }

  /**
   * Suscribe al flujo en tiempo real de nuevos logs ingresados por cualquier dispositivo.
   */
  public suscribirEnVivo(
    onNuevoLog: (log: RegistroLog) => void,
    onEstadoConexion?: (conectado: boolean) => void
  ): () => void {
    if (this.canal) {
      this.cliente.removeChannel(this.canal);
      this.canal = null;
    }

    this.canal = this.cliente
      .channel('logs_sistema_live_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'logs_sistema' },
        (payload) => {
          if (payload.new) {
            onNuevoLog(payload.new as RegistroLog);
          }
        }
      )
      .subscribe((status) => {
        if (onEstadoConexion) {
          onEstadoConexion(status === 'SUBSCRIBED');
        }
      });

    return () => {
      if (this.canal) {
        this.cliente.removeChannel(this.canal);
        this.canal = null;
      }
    };
  }

  /**
   * Suscribe al canal de Presencia global para detectar qué dispositivos están en línea en vivo con sus IPs.
   */
  public suscribirPresencia(
    onPresenciaActualizada: (presenciasEnLinea: DetallePresencia[]) => void
  ): () => void {
    if (this.canalPresencia) {
      this.cliente.removeChannel(this.canalPresencia);
      this.canalPresencia = null;
    }

    const idConsola = `admin-consola-${Date.now().toString(36)}`;

    const actualizarPresencia = (): void => {
      try {
        const state = this.canalPresencia?.presenceState() || {};
        const listaPresencias: DetallePresencia[] = [];
        for (const [key, presencias] of Object.entries(state)) {
          if (key.startsWith('admin-consola')) continue;
          const items = (presencias as Array<Partial<DetallePresencia>>) || [];
          for (const item of items) {
            listaPresencias.push({
              key,
              dispositivoId: item.dispositivoId || key,
              ip: item.ip,
              plataforma: item.plataforma,
              userAgent: item.userAgent,
              conectadoEn: item.conectadoEn,
              rol: item.rol,
            });
          }
        }
        onPresenciaActualizada(listaPresencias);
      } catch (err: unknown) {
        console.warn('[Presencia] Error al procesar estado de presencia:', err);
      }
    };

    this.canalPresencia = this.cliente
      .channel('taqueria-sync-global', {
        config: {
          presence: {
            key: idConsola,
          },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        actualizarPresencia();
      })
      .on('presence', { event: 'join' }, () => {
        actualizarPresencia();
      })
      .on('presence', { event: 'leave' }, () => {
        actualizarPresencia();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await this.canalPresencia?.track({
              rol: 'admin-monitor',
              conectadoEn: new Date().toISOString(),
            });
          } catch {
            // Ignorar fallas menores de tracking
          }
        }
      });

    return () => {
      if (this.canalPresencia) {
        this.cliente.removeChannel(this.canalPresencia);
        this.canalPresencia = null;
      }
    };
  }

  /**
   * Inserta un log de prueba (útil para verificar telemetría en vivo).
   */
  public async insertarLogPrueba(
    nivel: 'CRASH' | 'ERROR' | 'WARN' | 'INFO',
    mensaje: string,
    detalles: Record<string, unknown> = {}
  ): Promise<{ exito: boolean; registro: RegistroLog; error?: string }> {
    const registro: RegistroLog = {
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nivel,
      origen: 'visor-logs-admin',
      dispositivo_id: 'consola-admin',
      mensaje,
      detalles,
      creado_en: new Date().toISOString(),
    };

    try {
      const { error } = await this.cliente.from('logs_sistema').insert(registro);
      if (error) {
        return { exito: false, registro, error: error.message };
      }
      return { exito: true, registro };
    } catch (err: unknown) {
      const errMsj = err instanceof Error ? err.message : 'Error desconocido al insertar';
      return { exito: false, registro, error: errMsj };
    }
  }

  /**
   * Purga todos los registros de la base de datos (acción de administrador).
   */
  public async purgarTodosLosLogs(): Promise<boolean> {
    try {
      const { error } = await this.cliente
        .from('logs_sistema')
        .delete()
        .neq('id', 'imposible-id-no-match');
      return !error;
    } catch {
      return false;
    }
  }
}

export const servicioSupabaseLogs = ServicioSupabaseLogs.obtenerInstancia();
