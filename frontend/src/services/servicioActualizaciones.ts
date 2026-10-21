export interface InformacionVersion {
  readonly version: string;
  readonly nombre: string;
  readonly timestamp: number;
  readonly fecha: string;
  readonly notas: string;
}

export interface ResultadoVerificacionOta {
  readonly hayActualizacion: boolean;
  readonly versionActual: string;
  readonly versionRemota?: string;
  readonly notas?: string;
  readonly mensaje: string;
}

// Interfaz para el puente nativo de Android en MainActivity.kt
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

const CLAVE_STORAGE_VERSION = 'taqueria_km243_version_instalada';
const CLAVE_RECARGA_RECIENTE = 'taqueria_frontend_ultima_recarga_ota';

export const VERSION_LOCAL_POR_DEFECTO: InformacionVersion = {
  version: '1.3.6',
  nombre: 'LA ESTACIÓN GRILL',
  timestamp: 1792605000000,
  fecha: '21 de octubre de 2026',
  notas: 'Permitir configurar y cambiar dinámicamente el número de personas/comensales en la mesa.',
};

export const URL_VERSION_SUPABASE =
  'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/version.json';
export const URL_BUNDLE_SUPABASE =
  'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/web-bundle.zip';

export type ListenerActualizacion = (resultado: ResultadoVerificacionOta) => void;

export class ServicioActualizaciones {
  private static instancia: ServicioActualizaciones | null = null;
  private autodescargaEnCurso: boolean = false;
  private ultimoChequeoAuto: number = 0;
  private listeners: Set<ListenerActualizacion> = new Set();
  private ultimoResultado: ResultadoVerificacionOta | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.servicioActualizacionesAuto = () => {
        void this.verificarYActualizarSilencioso(true);
      };

      // 1. Chequeo periódico proactivo cada 45 segundos (ligero: 200 bytes)
      setInterval(() => {
        void this.verificarYActualizarSilencioso();
      }, 45 * 1000);

      // 2. Chequeo inmediato cada vez que el usuario regresa a la app (desbloqueo de tablet/celular o cambio de pestaña)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.verificarYActualizarSilencioso();
        }
      });

      window.addEventListener('focus', () => {
        void this.verificarYActualizarSilencioso();
      });

      // 3. Chequeo inmediato al recuperar conexión a internet
      window.addEventListener('online', () => {
        void this.verificarYActualizarSilencioso(true);
      });
    }
  }

  public static obtenerInstancia(): ServicioActualizaciones {
    if (!this.instancia) {
      this.instancia = new ServicioActualizaciones();
    }
    return this.instancia;
  }

  public suscribir(listener: ListenerActualizacion): () => void {
    this.listeners.add(listener);
    if (this.ultimoResultado) {
      try {
        listener(this.ultimoResultado);
      } catch (e) {
        console.error('[ServicioActualizaciones] Error en listener:', e);
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notificarListeners(resultado: ResultadoVerificacionOta): void {
    this.ultimoResultado = resultado;
    this.listeners.forEach((listener) => {
      try {
        listener(resultado);
      } catch (e) {
        console.error('[ServicioActualizaciones] Error en listener:', e);
      }
    });
  }

  /**
   * Comprueba en segundo plano si hay una nueva versión y la aplica de forma segura sin bucles.
   */
  public async verificarYActualizarSilencioso(forzar = false): Promise<boolean> {
    const ahora = Date.now();

    // 1. Cooldown de 15 segundos entre comprobaciones automáticas (a menos que se fuerce)
    if (this.autodescargaEnCurso || (!forzar && ahora - this.ultimoChequeoAuto < 15 * 1000)) {
      return false;
    }

    // 2. Cooldown persistente en sessionStorage: Si se recargó hace menos de 20 segundos, evitar bucle
    if (typeof window !== 'undefined') {
      try {
        const ultimaRecargaStr = sessionStorage.getItem(CLAVE_RECARGA_RECIENTE);
        if (ultimaRecargaStr) {
          const ultimaRecarga = parseInt(ultimaRecargaStr, 10);
          if (ahora - ultimaRecarga < 20 * 1000) {
            return false;
          }
        }
      } catch {
        // Ignorar
      }
    }

    this.ultimoChequeoAuto = ahora;

    try {
      const res = await this.verificarActualizacion();
      if (res.hayActualizacion) {
        console.log(`[ServicioActualizaciones] Nueva versión v${res.versionRemota} detectada.`);
        this.autodescargaEnCurso = true;
        await this.aplicarActualizacion();
        return true;
      }
    } catch (e) {
      console.warn('[ServicioActualizaciones] Error en actualización silenciosa:', e);
    } finally {
      this.autodescargaEnCurso = false;
    }
    return false;
  }

  /**
   * Obtiene la versión real inmutable del código compilado que se encuentra en ejecución.
   */
  public obtenerVersionActual(): InformacionVersion {
    // 1. Si Vite inyectó la versión en tiempo de compilación, es la fuente de verdad inmutable
    if (typeof __APP_VERSION_INFO__ !== 'undefined' && __APP_VERSION_INFO__?.version) {
      return __APP_VERSION_INFO__;
    }

    // 2. Si no, intentar leer la guardada localmente
    try {
      const guardada = localStorage.getItem(CLAVE_STORAGE_VERSION);
      if (guardada) {
        const parsed = JSON.parse(guardada) as InformacionVersion;
        if (parsed?.version) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[ServicioActualizaciones] Error al leer versión local:', e);
    }

    return VERSION_LOCAL_POR_DEFECTO;
  }

  /**
   * Determina si la aplicación se está ejecutando dentro del WebView de Android nativo.
   */
  public esAndroidNativo(): boolean {
    return typeof window !== 'undefined' && Boolean(window.AndroidOtaBridge);
  }

  /**
   * Consulta el archivo version.json local y lo compara con la versión remota de Supabase.
   */
  public async verificarActualizacion(): Promise<ResultadoVerificacionOta> {
    const timestampConsulta = Date.now();

    // 1. La versión local real en ejecución
    const versionLocal = this.obtenerVersionActual();

    try {
      // 2. Consultar la versión remota disponible en Supabase Storage (bypaseando cualquier caché HTTP)
      let versionRemota: InformacionVersion | null = null;
      try {
        const respRemota = await fetch(`${URL_VERSION_SUPABASE}?_t=${timestampConsulta}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        if (respRemota.ok) {
          versionRemota = (await respRemota.json()) as InformacionVersion;
        }
      } catch (errSupabase) {
        console.warn('[ServicioActualizaciones] Supabase no respondió a la consulta de versión:', errSupabase);
      }

      if (!versionRemota || !versionRemota.version) {
        return {
          hayActualizacion: false,
          versionActual: versionLocal.version,
          mensaje: 'No se pudo obtener información del servidor de actualizaciones.',
        };
      }

      // Comparación semver estricta: sólo hay actualización si la versión remota es estrictamente superior
      const esSuperior = this.compararVersiones(versionRemota.version, versionLocal.version) > 0;

      const resultado: ResultadoVerificacionOta = esSuperior
        ? {
            hayActualizacion: true,
            versionActual: versionLocal.version,
            versionRemota: versionRemota.version,
            notas: versionRemota.notas,
            mensaje: `Nueva versión ${versionRemota.version} disponible (${versionRemota.fecha}).`,
          }
        : {
            hayActualizacion: false,
            versionActual: versionLocal.version,
            mensaje: `La aplicación está al día con la versión ${versionLocal.version}.`,
          };

      this.notificarListeners(resultado);
      return resultado;
    } catch (error) {
      console.error('[ServicioActualizaciones] Error al verificar versión:', error);
      return {
        hayActualizacion: false,
        versionActual: versionLocal.version,
        mensaje: 'No se pudo consultar el servidor de actualizaciones en este momento.',
      };
    }
  }

  /**
   * Aplica la actualización en caliente de forma segura.
   * Si forzar es true, omite la verificación de versión y aplica el paquete directamente.
   */
  public async aplicarActualizacion(forzar = false): Promise<void> {
    try {
      if (!forzar) {
        const resultado = await this.verificarActualizacion();
        if (!resultado.hayActualizacion || !resultado.versionRemota) return;
      }

      // 1. Marcar en sessionStorage para proteger contra bucles de recarga
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(CLAVE_RECARGA_RECIENTE, Date.now().toString());
        } catch {
          // Ignorar
        }
      }

      // 2. Si está en Android nativo, delegar la descarga y descompresión al puente nativo
      if (typeof window !== 'undefined' && window.AndroidOtaBridge?.descargarYActualizar) {
        console.log('[ServicioActualizaciones] Delegando actualización a Supabase Storage mediante puente nativo...');
        window.AndroidOtaBridge.descargarYActualizar(URL_BUNDLE_SUPABASE);
        return;
      }

      // 3. Si está en Web/PWA, limpiar caches de Service Worker y recargar limpiamente
      if (typeof window !== 'undefined') {
        if ('caches' in window) {
          try {
            const nombresCache = await caches.keys();
            await Promise.all(nombresCache.map((nombre) => caches.delete(nombre)));
          } catch {
            // Ignorar
          }
        }

        // Forzar recarga con timestamp en URL para descartar el index.html en memoria
        const urlDestino = new URL(window.location.href);
        urlDestino.searchParams.set('_ota', Date.now().toString());
        window.location.replace(urlDestino.toString());
      }
    } catch (e) {
      console.error('[ServicioActualizaciones] Error al aplicar actualización:', e);
      throw e;
    }
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

export const servicioActualizaciones = ServicioActualizaciones.obtenerInstancia();
