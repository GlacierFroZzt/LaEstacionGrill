import type { MensajeSincronizacion, TipoEventoSync } from '../types';

type ListenerSincronizacion = (mensaje: MensajeSincronizacion) => void;

class ServicioSincronizacion {
  private static instancia: ServicioSincronizacion | null = null;
  private ws: WebSocket | null = null;
  private canalLocal: BroadcastChannel | null = null;
  private listeners: Set<ListenerSincronizacion> = new Set();
  private idDispositivo: string;
  private conectado: boolean = false;
  private dispositivosActivos: number = 1;
  private intentosReconexion: number = 0;
  private timerReconexion: ReturnType<typeof setTimeout> | null = null;
  private mensajesProcesadosIds: Set<string> = new Set();

  private constructor() {
    this.idDispositivo = `tablet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Canal local para sincronización entre ventanas/pestañas en el mismo equipo
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.canalLocal = new BroadcastChannel('taqueria_km243_sync_v1');
        this.canalLocal.onmessage = (event: MessageEvent<MensajeSincronizacion>) => {
          if (event.data && event.data.remitenteId !== this.idDispositivo) {
            if (event.data.tipo === ('PRESENCIA_ANUNCIO' as TipoEventoSync)) {
              // Responder con confirmación
              this.canalLocal?.postMessage({
                id: `pres-${Date.now()}`,
                tipo: 'PRESENCIA_ACK' as TipoEventoSync,
                timestamp: new Date().toISOString(),
                remitenteId: this.idDispositivo,
                payload: {},
              });
              this.actualizarPresenciaLocal(2);
            } else if (event.data.tipo === ('PRESENCIA_ACK' as TipoEventoSync)) {
              this.actualizarPresenciaLocal(2);
            } else {
              this.notificarListeners(event.data);
            }
          }
        };

        // Anunciar presencia al iniciar
        setTimeout(() => {
          this.canalLocal?.postMessage({
            id: `pres-init-${Date.now()}`,
            tipo: 'PRESENCIA_ANUNCIO' as TipoEventoSync,
            timestamp: new Date().toISOString(),
            remitenteId: this.idDispositivo,
            payload: {},
          });
        }, 300);

        // Auto-reconexión ante eventos del sistema o reactivación de pantalla
        window.addEventListener('online', () => {
          console.log('[ServicioSincronizacion] Red restablecida. Reconectando WebSocket...');
          this.reconectar();
        });

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && !this.conectado) {
            console.log('[ServicioSincronizacion] Pantalla visible y socket desconectado. Reconectando...');
            this.reconectar();
          }
        });

        window.addEventListener('focus', () => {
          if (!this.conectado) {
            this.reconectar();
          }
        });
      }
    } catch (e: unknown) {
      console.warn('[ServicioSincronizacion] BroadcastChannel no disponible:', e);
    }

    this.iniciarConexionWebSocket();
  }

  private actualizarPresenciaLocal(count: number): void {
    if (!this.conectado) {
      this.dispositivosActivos = Math.max(this.dispositivosActivos, count);
      this.notificarListeners({
        id: `disp-local-${Date.now()}`,
        tipo: 'DISPOSITIVOS_ACTUALIZADOS' as TipoEventoSync,
        timestamp: new Date().toISOString(),
        remitenteId: 'local',
        payload: { clientesConectadosCount: this.dispositivosActivos },
      });
    }
  }

  public static readonly CLAVE_STORAGE_HOST = 'taqueria_servidor_host';
  public static readonly HOST_DEFECTO_LAN = '192.168.5.213:3001';

  public static obtenerInstancia(): ServicioSincronizacion {
    if (typeof window !== 'undefined') {
      const win = window as unknown as { __taqueria_sync_singleton__?: ServicioSincronizacion };
      if (win.__taqueria_sync_singleton__) {
        return win.__taqueria_sync_singleton__;
      }
      this.instancia = new ServicioSincronizacion();
      win.__taqueria_sync_singleton__ = this.instancia;
      return this.instancia;
    }
    if (!this.instancia) {
      this.instancia = new ServicioSincronizacion();
    }
    return this.instancia;
  }

  public destruir(): void {
    if (this.timerReconexion) {
      clearTimeout(this.timerReconexion);
      this.timerReconexion = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.canalLocal) {
      this.canalLocal.close();
      this.canalLocal = null;
    }
    this.conectado = false;
  }

  public obtenerHostServidor(): string | null {
    if (typeof window === 'undefined') return null;

    const hostGuardado = localStorage.getItem(ServicioSincronizacion.CLAVE_STORAGE_HOST);
    if (hostGuardado && hostGuardado.trim().length > 0) {
      return hostGuardado.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
    }

    return null;
  }

  public guardarHostServidor(nuevoHost: string): void {
    if (typeof window === 'undefined') return;
    const hostLimpio = nuevoHost.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
    if (hostLimpio.length > 0) {
      localStorage.setItem(ServicioSincronizacion.CLAVE_STORAGE_HOST, hostLimpio);
    } else {
      localStorage.removeItem(ServicioSincronizacion.CLAVE_STORAGE_HOST);
    }
    this.reconectar();
  }

  public reconectar(): void {
    if (this.timerReconexion) {
      clearTimeout(this.timerReconexion);
      this.timerReconexion = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    this.conectado = false;
    this.intentosReconexion = 0;
    this.iniciarConexionWebSocket();
  }

  public async probarConexionHttp(host: string): Promise<{ ok: boolean; mensaje: string; ips?: string[] }> {
    const hostLimpio = host.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
    const url = `http://${hostLimpio}/api/ping`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const respuesta = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (respuesta.ok) {
        const datos = await respuesta.json() as { ok: boolean; timestamp: string; ips?: string[] };
        return {
          ok: true,
          mensaje: `Conexión exitosa con el servidor SQL (${datos.timestamp})`,
          ips: datos.ips,
        };
      }
      return { ok: false, mensaje: `Servidor respondió con código HTTP ${respuesta.status}` };
    } catch (err: unknown) {
      const mensajeError = err instanceof Error ? err.message : 'Error desconocido';
      return { ok: false, mensaje: `No se pudo conectar a ${url}: ${mensajeError}` };
    }
  }

  private obtenerUrlWebSocket(): string | null {
    const host = this.obtenerHostServidor();
    if (!host) return null;
    return `ws://${host}`;
  }

  private iniciarConexionWebSocket(): void {
    if (typeof window === 'undefined') return;
    const url = this.obtenerUrlWebSocket();
    // Si no hay un host configurado manualmente, operar exclusivamente con Supabase y canal local
    if (!url) {
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = (): void => {
        this.conectado = true;
        this.intentosReconexion = 0;
        console.log(`[ServicioSincronizacion] Conectado exitosamente al hub en ${url}`);

        // Notificar a la UI del cambio de estado a conectado
        this.notificarEstadoConexion();

        // Solicitar estado maestro al conectar
        this.emitir('SOLICITAR_ESTADO_ACTUAL', {});
      };

      this.ws.onmessage = (event: MessageEvent): void => {
        try {
          const mensaje = JSON.parse(event.data as string) as MensajeSincronizacion;

          if (mensaje.tipo === 'DISPOSITIVOS_ACTUALIZADOS') {
            const payload = mensaje.payload as { clientesConectadosCount?: number };
            if (payload?.clientesConectadosCount !== undefined) {
              this.dispositivosActivos = payload.clientesConectadosCount;
              this.notificarEstadoConexion();
            }
          }

          if (mensaje.remitenteId !== this.idDispositivo) {
            this.notificarListeners(mensaje);
          }
        } catch (error: unknown) {
          console.error('[ServicioSincronizacion] Error al decodificar mensaje WebSocket:', error);
        }
      };

      this.ws.onclose = (): void => {
        this.conectado = false;
        this.notificarEstadoConexion();
        this.programarReconexion();
      };

      this.ws.onerror = (): void => {
        this.conectado = false;
        this.notificarEstadoConexion();
      };
    } catch (e: unknown) {
      console.warn('[ServicioSincronizacion] Falló inicio de WebSocket, se usará canal local:', e);
      this.programarReconexion();
    }
  }

  private programarReconexion(): void {
    if (this.timerReconexion) clearTimeout(this.timerReconexion);
    if (!this.obtenerHostServidor()) return;

    if (this.intentosReconexion >= 5) {
      console.warn('[ServicioSincronizacion] Límite de reintentos alcanzado para WebSocket local.');
      return;
    }

    const demora = Math.min(10000, 1500 * Math.pow(1.5, this.intentosReconexion));
    this.intentosReconexion++;

    this.timerReconexion = setTimeout(() => {
      this.iniciarConexionWebSocket();
    }, demora);
  }

  private notificarListeners(mensaje: MensajeSincronizacion): void {
    if (this.mensajesProcesadosIds.has(mensaje.id)) {
      return; // Mensaje duplicado ya procesado por el otro canal
    }

    this.mensajesProcesadosIds.add(mensaje.id);
    if (this.mensajesProcesadosIds.size > 500) {
      // Limpiar los más antiguos si excede 500
      const primerElemento = this.mensajesProcesadosIds.values().next().value;
      if (primerElemento) {
        this.mensajesProcesadosIds.delete(primerElemento);
      }
    }

    for (const listener of this.listeners) {
      try {
        listener(mensaje);
      } catch (err: unknown) {
        console.error('[ServicioSincronizacion] Error en listener:', err);
      }
    }
  }

  private notificarEstadoConexion(): void {
    const mensaje: MensajeSincronizacion = {
      id: `conn-status-${Date.now()}`,
      tipo: 'ESTADO_CONEXION_ACTUALIZADO',
      timestamp: new Date().toISOString(),
      remitenteId: this.idDispositivo,
      payload: {
        conectado: this.conectado,
        clientesConectadosCount: this.dispositivosActivos,
      },
    };
    for (const listener of this.listeners) {
      try {
        listener(mensaje);
      } catch (err: unknown) {
        console.error('[ServicioSincronizacion] Error en listener:', err);
      }
    }
  }

  /**
   * Emite un evento a todos los dispositivos conectados (vía WebSocket y BroadcastChannel local).
   */
  public emitir(tipo: TipoEventoSync, payload: unknown): void {
    const mensaje: MensajeSincronizacion = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tipo,
      timestamp: new Date().toISOString(),
      remitenteId: this.idDispositivo,
      payload,
    };

    // 1. Enviar por canal local de navegador
    try {
      if (this.canalLocal) {
        this.canalLocal.postMessage(mensaje);
      }
    } catch (err: unknown) {
      console.warn('[ServicioSincronizacion] Error al enviar a canal local:', err);
    }

    // 2. Enviar por WebSocket si está conectado
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(mensaje));
      } catch (err: unknown) {
        console.error('[ServicioSincronizacion] Error al enviar por WebSocket:', err);
      }
    }
  }

  public suscribir(listener: ListenerSincronizacion): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public estaConectado(): boolean {
    return this.conectado;
  }

  public totalDispositivos(): number {
    return this.dispositivosActivos;
  }
}

export const servicioSincronizacion = ServicioSincronizacion.obtenerInstancia();
