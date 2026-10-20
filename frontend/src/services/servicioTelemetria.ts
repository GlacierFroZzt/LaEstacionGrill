import { servicioSupabase } from './servicioSupabase';
import { servicioDeteccionIp } from './servicioDeteccionIp';
import { RepositorioStorage } from './repositorioStorage';

export type NivelLog = 'CRASH' | 'ERROR' | 'WARN' | 'INFO';

export interface RegistroLog {
  id: string;
  nivel: NivelLog;
  origen: string;
  dispositivoId: string;
  mensaje: string;
  detalles: Record<string, unknown>;
  creadoEn: string;
}

export class ServicioTelemetria {
  private static instancia: ServicioTelemetria | null = null;
  private readonly CLAVE_LOGS_OFFLINE = 'taqueria_logs_pendientes_v1';
  private readonly CLAVE_HISTORIAL_LOCAL = 'taqueria_logs_historial_local_v1';
  private readonly MAX_HISTORIAL_LOCAL = 150;
  private dispositivoId: string;
  private enviandoCola: boolean = false;

  private constructor() {
    this.dispositivoId = this.obtenerIdDispositivo();
    this.configurarInterceptoresGlobales();
    this.configurarEventosRed();

    // Procesar cola pendiente inmediatamente tras la inicializacion
    setTimeout(async () => {
      this.procesarColaPendiente();
      const ip = await servicioDeteccionIp.obtenerIp();
      // Registrar log informativo de dispositivo conectado para que aparezca de inmediato en la terminal
      this.registrarInfo(`Dispositivo conectado al restaurante`, {
        tipo: 'inicio_sesion',
        nombreDispositivo: RepositorioStorage.obtenerNombreDispositivo(),
        ip: ip || 'desconocido',
        plataforma: typeof navigator !== 'undefined' ? navigator.platform : 'web',
        resolucion: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
        modoPWA: typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)').matches : false,
      });
    }, 1500);

    // Latido periodico cada 10s para reintentar el envio si hubo fluctuaciones de conexion
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.procesarColaPendiente();
      }, 10000);
    }
  }

  public static obtenerInstancia(): ServicioTelemetria {
    if (!ServicioTelemetria.instancia) {
      ServicioTelemetria.instancia = new ServicioTelemetria();
    }
    return ServicioTelemetria.instancia;
  }

  private obtenerIdDispositivo(): string {
    if (typeof window === 'undefined') return 'servidor';
    try {
      let id = localStorage.getItem('taqueria_disp_id');
      if (!id) {
        id = `terminal-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        localStorage.setItem('taqueria_disp_id', id);
      }
      return id;
    } catch {
      return 'terminal-desconocida';
    }
  }

  private configurarInterceptoresGlobales(): void {
    if (typeof window === 'undefined') return;

    // 1. Interceptar excepciones de JavaScript no controladas
    window.addEventListener('error', (evento: ErrorEvent) => {
      try {
        const errorObj = evento.error as Error | undefined;
        this.registrarCrash(evento.message || 'Error no controlado de ejecución', {
          origenError: 'window.onerror',
          archivo: evento.filename,
          linea: evento.lineno,
          columna: evento.colno,
          stack: errorObj?.stack ?? 'Sin traza disponible',
        });
      } catch (err: unknown) {
        console.error('[Telemetria] Error al capturar evento de error:', err);
      }
    });

    // 2. Interceptar promesas asíncronas rechazadas y no manejadas
    window.addEventListener('unhandledrejection', (evento: PromiseRejectionEvent) => {
      try {
        const razon = evento.reason as unknown;
        const mensaje =
          razon instanceof Error
            ? razon.message
            : typeof razon === 'string'
            ? razon
            : 'Promesa asíncrona rechazada sin catch';

        const stack = razon instanceof Error ? razon.stack : 'N/A';

        this.registrarCrash(`[Rechazo Asíncrono] ${mensaje}`, {
          origenError: 'unhandledrejection',
          stack,
        });
      } catch (err: unknown) {
        console.error('[Telemetria] Error al capturar unhandledrejection:', err);
      }
    });
  }

  private configurarEventosRed(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      // Al recuperar conexión a internet, vaciar la cola de logs pendientes
      this.procesarColaPendiente();
    });
  }

  public async registrar(
    nivel: NivelLog,
    mensaje: string,
    detalles: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const registro: RegistroLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nivel,
        origen: 'frontend-pos',
        dispositivoId: this.dispositivoId,
        mensaje,
        detalles: {
          ...detalles,
          nombreDispositivo: detalles.nombreDispositivo || RepositorioStorage.obtenerNombreDispositivo(),
          ip: detalles.ip || servicioDeteccionIp.obtenerIpCache() || 'desconocido',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
          url: typeof window !== 'undefined' ? window.location.href : 'N/A',
          timestampMs: Date.now(),
        },
        creadoEn: new Date().toISOString(),
      };

      // Guardar en caché circular local para auditoría en el dispositivo
      this.guardarEnHistorialLocal(registro);

      // Si estamos en la app nativa de Android, emitir notificación de alta prioridad
      if (typeof window !== 'undefined' && (nivel === 'CRASH' || nivel === 'ERROR')) {
        const puente = (window as unknown as {
          AndroidNotificationBridge?: {
            emitirNotificacion: (t: string, m: string, n: string) => void;
          };
        }).AndroidNotificationBridge;

        if (puente) {
          const titulo = nivel === 'CRASH' ? '💥 ALERTA CRÍTICA: Fallo en Terminal' : '⚠️ AVISO: Error en Terminal';
          puente.emitirNotificacion(titulo, mensaje, nivel);
        }
      }

      // Intentar enviar a Supabase inmediatamente
      const enviado = await this.enviarASupabase(registro);
      if (!enviado) {
        this.guardarEnColaPendiente(registro);
      }
    } catch (err: unknown) {
      console.error('[Telemetria.registrar] Error interno en registro de log:', err);
    }
  }

  public registrarCrash(
    error: Error | string,
    infoExtra: Record<string, unknown> = {}
  ): Promise<void> {
    const mensaje = typeof error === 'string' ? error : error.message;
    const stack = error instanceof Error ? error.stack : undefined;
    return this.registrar('CRASH', `💥 CRASH FATAL: ${mensaje}`, {
      ...infoExtra,
      stack: stack ?? infoExtra.stack ?? 'Sin stack',
    });
  }

  public registrarError(
    mensaje: string,
    error?: unknown,
    infoExtra: Record<string, unknown> = {}
  ): Promise<void> {
    const stack = error instanceof Error ? error.stack : undefined;
    return this.registrar('ERROR', mensaje, {
      ...infoExtra,
      errorOriginal: String(error ?? ''),
      stack,
    });
  }

  public registrarAdvertencia(
    mensaje: string,
    infoExtra: Record<string, unknown> = {}
  ): Promise<void> {
    return this.registrar('WARN', mensaje, infoExtra);
  }

  public registrarInfo(
    mensaje: string,
    infoExtra: Record<string, unknown> = {}
  ): Promise<void> {
    return this.registrar('INFO', mensaje, infoExtra);
  }

  private async enviarASupabase(registro: RegistroLog): Promise<boolean> {
    try {
      const cliente = servicioSupabase.obtenerCliente();
      if (!cliente) return false;

      const { error } = await cliente.from('logs_sistema').insert({
        id: registro.id,
        nivel: registro.nivel,
        origen: registro.origen,
        dispositivo_id: registro.dispositivoId,
        mensaje: registro.mensaje,
        detalles: registro.detalles,
        creado_en: registro.creadoEn,
      });

      if (error) {
        console.warn('[Telemetria] No se pudo guardar log en Supabase (se encola):', error.message);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private guardarEnColaPendiente(registro: RegistroLog): void {
    if (typeof window === 'undefined') return;
    try {
      const serializado = localStorage.getItem(this.CLAVE_LOGS_OFFLINE);
      const cola: RegistroLog[] = serializado ? (JSON.parse(serializado) as RegistroLog[]) : [];
      cola.push(registro);
      // Limitar cola para no saturar almacenamiento
      if (cola.length > 50) cola.shift();
      localStorage.setItem(this.CLAVE_LOGS_OFFLINE, JSON.stringify(cola));
    } catch (err: unknown) {
      console.error('[Telemetria] Error al guardar en cola offline:', err);
    }
  }

  public async procesarColaPendiente(): Promise<void> {
    if (this.enviandoCola || typeof window === 'undefined') return;
    this.enviandoCola = true;
    try {
      const serializado = localStorage.getItem(this.CLAVE_LOGS_OFFLINE);
      if (!serializado) {
        this.enviandoCola = false;
        return;
      }
      const cola: RegistroLog[] = JSON.parse(serializado) as RegistroLog[];
      if (cola.length === 0) {
        this.enviandoCola = false;
        return;
      }

      const pendientes: RegistroLog[] = [];
      for (const reg of cola) {
        const enviado = await this.enviarASupabase(reg);
        if (!enviado) {
          pendientes.push(reg);
        }
      }

      if (pendientes.length === 0) {
        localStorage.removeItem(this.CLAVE_LOGS_OFFLINE);
      } else {
        localStorage.setItem(this.CLAVE_LOGS_OFFLINE, JSON.stringify(pendientes));
      }
    } catch (err: unknown) {
      console.error('[Telemetria] Error al vaciar cola de logs:', err);
    } finally {
      this.enviandoCola = false;
    }
  }

  private guardarEnHistorialLocal(registro: RegistroLog): void {
    if (typeof window === 'undefined') return;
    try {
      const serializado = localStorage.getItem(this.CLAVE_HISTORIAL_LOCAL);
      const historial: RegistroLog[] = serializado ? (JSON.parse(serializado) as RegistroLog[]) : [];
      historial.unshift(registro);
      if (historial.length > this.MAX_HISTORIAL_LOCAL) {
        historial.pop();
      }
      localStorage.setItem(this.CLAVE_HISTORIAL_LOCAL, JSON.stringify(historial));
    } catch (err: unknown) {
      console.error('[Telemetria] Error al guardar historial local:', err);
    }
  }

  public obtenerHistorialLocal(): RegistroLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const serializado = localStorage.getItem(this.CLAVE_HISTORIAL_LOCAL);
      return serializado ? (JSON.parse(serializado) as RegistroLog[]) : [];
    } catch {
      return [];
    }
  }

  public obtenerNombreDispositivo(): string {
    return RepositorioStorage.obtenerNombreDispositivo();
  }

  public guardarNombreDispositivo(nombre: string): void {
    RepositorioStorage.guardarNombreDispositivo(nombre);
  }
}

export const servicioTelemetria = ServicioTelemetria.obtenerInstancia();
