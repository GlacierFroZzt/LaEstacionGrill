/**
 * TAQUERÍA KM 243 / LA ESTACIÓN GRILL
 * Servicio de Actualizaciones Automáticas OTA para la Terminal de Auditoría y Logs.
 * Gestiona la detección, descarga y aplicación en caliente de nuevas versiones de la Terminal.
 */

export interface InformacionVersionTerminal {
  readonly version: string;
  readonly nombre: string;
  readonly timestamp: number;
  readonly fecha: string;
  readonly notas: string;
}

export interface ResultadoVerificacionOtaTerminal {
  readonly hayActualizacion: boolean;
  readonly versionActual: string;
  readonly versionRemota?: string;
  readonly notas?: string;
  readonly mensaje: string;
}

interface AndroidOtaBridgeInterface {
  verificarActualizaciones?: () => void;
  descargarYActualizar?: (urlDescarga?: string) => void;
  esAndroidNativo?: () => boolean;
  obtenerVersionNativa?: () => string;
}

declare global {
  interface Window {
    AndroidOtaBridge?: AndroidOtaBridgeInterface;
    servicioActualizacionesAuto?: () => void;
  }
}

const CLAVE_STORAGE_VERSION = 'taqueria_terminal_version_instalada';

export const VERSION_TERMINAL_LOCAL: InformacionVersionTerminal = {
  version: '1.0.0',
  nombre: 'TERMINAL ADMIN - LA ESTACIÓN GRILL',
  timestamp: Date.now(),
  fecha: new Date().toLocaleDateString('es-MX'),
  notas: 'Monitoreo en tiempo real, presencia activa y protección de notch.',
};

export const URL_VERSION_TERMINAL_SUPABASE =
  'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/terminal-version.json';
export const URL_BUNDLE_TERMINAL_SUPABASE =
  'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/terminal-bundle.zip';

export class ServicioActualizacionesTerminal {
  private static instancia: ServicioActualizacionesTerminal | null = null;
  private autodescargaEnCurso: boolean = false;
  private ultimoChequeoAuto: number = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      // Registrar función global invocada por MainActivity.kt en onPageFinished
      window.servicioActualizacionesAuto = () => {
        this.verificarYActualizarSilencioso();
      };

      // 1. Al recuperar conexión de red, comprobar actualización automáticamente
      window.addEventListener('online', () => {
        setTimeout(() => this.verificarYActualizarSilencioso(), 2000);
      });

      // 2. Al volver a la app tras suspensión o bloqueo
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          setTimeout(() => this.verificarYActualizarSilencioso(), 1500);
        }
      });

      // 3. Chequeo periódico cada 5 minutos
      setInterval(() => {
        this.verificarYActualizarSilencioso();
      }, 5 * 60 * 1000);
    }
  }

  public static obtenerInstancia(): ServicioActualizacionesTerminal {
    if (!this.instancia) {
      this.instancia = new ServicioActualizacionesTerminal();
    }
    return this.instancia;
  }

  public obtenerVersionInstalada(): InformacionVersionTerminal {
    if (typeof window === 'undefined') return VERSION_TERMINAL_LOCAL;
    try {
      const guardada = localStorage.getItem(CLAVE_STORAGE_VERSION);
      if (guardada) {
        return JSON.parse(guardada) as InformacionVersionTerminal;
      }
    } catch {
      // Ignorar error de parsing
    }
    return VERSION_TERMINAL_LOCAL;
  }

  public guardarVersionInstalada(info: InformacionVersionTerminal): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CLAVE_STORAGE_VERSION, JSON.stringify(info));
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  public async verificarActualizacion(): Promise<ResultadoVerificacionOtaTerminal> {
    const versionLocal = this.obtenerVersionInstalada();

    try {
      const urlConsulta = `${URL_VERSION_TERMINAL_SUPABASE}?_t=${Date.now()}`;
      const respuesta = await fetch(urlConsulta, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!respuesta.ok) {
        return {
          hayActualizacion: false,
          versionActual: versionLocal.version,
          mensaje: 'Servidor de versiones no disponible.',
        };
      }

      const infoRemota = (await respuesta.json()) as InformacionVersionTerminal;

      const esSuperior = this.compararVersiones(infoRemota.version, versionLocal.version) > 0;
      const tieneTimestampNuevo = (infoRemota.timestamp || 0) > (versionLocal.timestamp || 0);

      if (esSuperior || (infoRemota.version === versionLocal.version && tieneTimestampNuevo)) {
        return {
          hayActualizacion: true,
          versionActual: versionLocal.version,
          versionRemota: infoRemota.version,
          notas: infoRemota.notas,
          mensaje: `Nueva versión disponible: v${infoRemota.version}`,
        };
      }

      return {
        hayActualizacion: false,
        versionActual: versionLocal.version,
        mensaje: 'La Terminal está al día.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      return {
        hayActualizacion: false,
        versionActual: versionLocal.version,
        mensaje: `Error al comprobar actualizaciones: ${msg}`,
      };
    }
  }

  public async aplicarActualizacion(): Promise<void> {
    try {
      const resultado = await this.verificarActualizacion();
      if (!resultado.hayActualizacion) return;

      const puente = window.AndroidOtaBridge;
      if (puente && typeof puente.descargarYActualizar === 'function') {
        // En Android WebView nativo delegamos al puente OTA en segundo plano
        puente.descargarYActualizar(URL_BUNDLE_TERMINAL_SUPABASE);
      } else {
        // En navegador web limpiamos caché y recargamos
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        window.location.reload();
      }
    } catch (err: unknown) {
      console.error('[ServicioActualizacionesTerminal] Error al aplicar actualización:', err);
    }
  }

  public async verificarYActualizarSilencioso(): Promise<boolean> {
    const ahora = Date.now();
    if (this.autodescargaEnCurso || ahora - this.ultimoChequeoAuto < 20000) {
      return false;
    }
    this.ultimoChequeoAuto = ahora;

    try {
      const res = await this.verificarActualizacion();
      if (res.hayActualizacion) {
        console.log(`[ServicioActualizacionesTerminal] Actualización v${res.versionRemota} detectada.`);
        this.autodescargaEnCurso = true;
        await this.aplicarActualizacion();
        return true;
      }
    } catch (e: unknown) {
      console.warn('[ServicioActualizacionesTerminal] Error silencioso:', e);
    }
    return false;
  }

  private compararVersiones(v1: string, v2: string): number {
    const partes1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
    const partes2 = v2.split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(partes1.length, partes2.length);

    for (let i = 0; i < len; i++) {
      const num1 = partes1[i] ?? 0;
      const num2 = partes2[i] ?? 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }
}

export const servicioActualizacionesTerminal = ServicioActualizacionesTerminal.obtenerInstancia();
