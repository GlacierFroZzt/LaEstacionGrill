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
  }
}

const CLAVE_STORAGE_VERSION = 'taqueria_km243_version_instalada';
export const VERSION_LOCAL_POR_DEFECTO: InformacionVersion = {
  version: '1.0.1',
  nombre: 'LA ESTACIÓN GRILL',
  timestamp: 1792289900000,
  fecha: '18 de octubre de 2026',
  notas: 'Pantalla de inicio rápida, optimizaciones de fluidez y mejoras continuas de servicio.',
};

export const URL_VERSION_SUPABASE =
  'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/version.json';
export const URL_BUNDLE_SUPABASE =
  'https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/web-bundle.zip';

export class ServicioActualizaciones {
  private static instancia: ServicioActualizaciones | null = null;
  private autodescargaEnCurso: boolean = false;
  private ultimoChequeoAuto: number = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      // 1. Al recuperar conexión de red, comprobar actualización automáticamente
      window.addEventListener('online', () => {
        setTimeout(() => this.verificarYActualizarSilencioso(), 2000);
      });

      // 2. Al reanudar la app tras suspensión o bloqueo de pantalla
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          setTimeout(() => this.verificarYActualizarSilencioso(), 1500);
        }
      });

      // 3. Chequeo periódico cada 10 minutos en segundo plano
      setInterval(() => {
        this.verificarYActualizarSilencioso();
      }, 10 * 60 * 1000);
    }
  }

  public static obtenerInstancia(): ServicioActualizaciones {
    if (!this.instancia) {
      this.instancia = new ServicioActualizaciones();
    }
    return this.instancia;
  }

  /**
   * Comprueba en segundo plano si hay una nueva versión en Supabase y la descarga
   * e instala de inmediato de forma 100% automática y transparente sin intervención del usuario.
   */
  public async verificarYActualizarSilencioso(): Promise<boolean> {
    const ahora = Date.now();
    // Prevenir ejecuciones repetitivas si ya se comprobó hace menos de 25 segundos o si una descarga está en progreso
    if (this.autodescargaEnCurso || ahora - this.ultimoChequeoAuto < 25000) {
      return false;
    }

    this.ultimoChequeoAuto = ahora;

    try {
      const res = await this.verificarActualizacion();
      if (res.hayActualizacion) {
        console.log(`[ServicioActualizaciones] 🔥 Nueva versión v${res.versionRemota} detectada en la nube. Aplicando actualización automática...`);
        this.autodescargaEnCurso = true;
        await this.aplicarActualizacion();
        return true;
      }
    } catch (e) {
      console.warn('[ServicioActualizaciones] Error en actualización automática silenciosa:', e);
      this.autodescargaEnCurso = false;
    }
    return false;
  }

  /**
   * Obtiene los datos de la versión local almacenada.
   */
  public obtenerVersionActual(): InformacionVersion {
    try {
      const guardada = localStorage.getItem(CLAVE_STORAGE_VERSION);
      if (guardada) {
        return JSON.parse(guardada) as InformacionVersion;
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
   * Consulta el archivo version.json local para saber la versión instalada y lo compara
   * con la versión remota oficial en Supabase Storage.
   */
  public async verificarActualizacion(): Promise<ResultadoVerificacionOta> {
    const timestampConsulta = Date.now();

    // 1. Obtener la versión que realmente está instalada en el dispositivo
    let versionLocal = this.obtenerVersionActual();
    try {
      const respLocal = await fetch(`./version.json?_t=${timestampConsulta}`, {
        cache: 'no-store',
      });
      if (respLocal.ok) {
        versionLocal = (await respLocal.json()) as InformacionVersion;
        try {
          localStorage.setItem(CLAVE_STORAGE_VERSION, JSON.stringify(versionLocal));
        } catch {
          // Ignorar error de cuota en storage
        }
      }
    } catch (errLocal) {
      console.warn('[ServicioActualizaciones] Error al consultar version.json local:', errLocal);
    }

    try {
      // 2. Consultar la versión remota disponible en la nube de Supabase
      let versionRemota: InformacionVersion = versionLocal;
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

      // Si el timestamp o número de versión remoto es superior, hay actualización
      const hayNueva =
        versionRemota.timestamp > versionLocal.timestamp ||
        versionRemota.version !== versionLocal.version;

      return {
        hayActualizacion: hayNueva,
        versionActual: versionLocal.version,
        versionRemota: versionRemota.version,
        notas: versionRemota.notas,
        mensaje: hayNueva
          ? `Nueva versión ${versionRemota.version} disponible (${versionRemota.fecha}).`
          : `La aplicación está al día con la versión ${versionLocal.version}.`,
      };
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
   * Aplica la actualización en caliente:
   * - En Android: Invoca el puente nativo para descargar de Supabase Storage y reemplazar assets sin reinstalar APK.
   * - En Web/PWA: Limpia los caches de almacenamiento y recarga la página.
   */
  public async aplicarActualizacion(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.AndroidOtaBridge?.descargarYActualizar) {
        console.log('[ServicioActualizaciones] Delegando actualización a Supabase Storage mediante puente nativo...');
        window.AndroidOtaBridge.descargarYActualizar(URL_BUNDLE_SUPABASE);
        return;
      }

      // Si está en Web/PWA, limpiar caches de navegadores y recargar
      if ('caches' in window) {
        const nombresCache = await caches.keys();
        await Promise.all(nombresCache.map((nombre) => caches.delete(nombre)));
      }

      // Guardar la versión más reciente consultada
      const resultado = await this.verificarActualizacion();
      if (resultado.versionRemota) {
        const infoActualizada: InformacionVersion = {
          ...VERSION_LOCAL_POR_DEFECTO,
          version: resultado.versionRemota,
          timestamp: Date.now(),
        };
        localStorage.setItem(CLAVE_STORAGE_VERSION, JSON.stringify(infoActualizada));
      }

      // Forzar recarga sin caché
      window.location.reload();
    } catch (e) {
      console.error('[ServicioActualizaciones] Error al aplicar actualización:', e);
      window.location.reload();
    }
  }
}

export const servicioActualizaciones = ServicioActualizaciones.obtenerInstancia();
