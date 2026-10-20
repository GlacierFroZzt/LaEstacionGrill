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
  version: '1.2.3',
  nombre: 'LA ESTACIÓN GRILL',
  timestamp: 1792340000000,
  fecha: '19 de octubre de 2026',
  notas: 'Notificaciones nativas, presencia activa, deduplicación de IP y sincronización robusta.',
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
      window.servicioActualizacionesAuto = () => {
        this.verificarYActualizarSilencioso();
      };

      // Chequeo periódico no intrusivo cada 15 minutos
      setInterval(() => {
        this.verificarYActualizarSilencioso();
      }, 15 * 60 * 1000);
    }
  }

  public static obtenerInstancia(): ServicioActualizaciones {
    if (!this.instancia) {
      this.instancia = new ServicioActualizaciones();
    }
    return this.instancia;
  }

  /**
   * Comprueba en segundo plano si hay una nueva versión y la aplica de forma segura sin bucles.
   */
  public async verificarYActualizarSilencioso(): Promise<boolean> {
    const ahora = Date.now();

    // 1. Cooldown de 10 minutos entre comprobaciones automáticas
    if (this.autodescargaEnCurso || ahora - this.ultimoChequeoAuto < 10 * 60 * 1000) {
      return false;
    }

    // 2. Cooldown persistente en sessionStorage: Si se recargó hace menos de 5 minutos, abortar
    if (typeof window !== 'undefined') {
      try {
        const ultimaRecargaStr = sessionStorage.getItem(CLAVE_RECARGA_RECIENTE);
        if (ultimaRecargaStr) {
          const ultimaRecarga = parseInt(ultimaRecargaStr, 10);
          if (ahora - ultimaRecarga < 5 * 60 * 1000) {
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
   * Obtiene los datos de la versión local almacenada.
   */
  public obtenerVersionActual(): InformacionVersion {
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

    // 1. Obtener la versión que realmente está instalada en el dispositivo
    let versionLocal = this.obtenerVersionActual();
    try {
      const respLocal = await fetch(`./version.json?_t=${timestampConsulta}`, {
        cache: 'no-store',
      });
      if (respLocal.ok) {
        const infoLocalArchivo = (await respLocal.json()) as InformacionVersion;
        if (infoLocalArchivo?.version) {
          if (this.compararVersiones(infoLocalArchivo.version, versionLocal.version) >= 0) {
            versionLocal = infoLocalArchivo;
            try {
              localStorage.setItem(CLAVE_STORAGE_VERSION, JSON.stringify(versionLocal));
            } catch {
              // Ignorar
            }
          }
        }
      }
    } catch (errLocal) {
      console.warn('[ServicioActualizaciones] Error al consultar version.json local:', errLocal);
    }

    try {
      // 2. Consultar la versión remota disponible en Supabase Storage
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

      // Comparación semver estricta: sólo hay actualización si la versión remota es estrictamente superior
      const esSuperior = this.compararVersiones(versionRemota.version, versionLocal.version) > 0;

      if (esSuperior) {
        return {
          hayActualizacion: true,
          versionActual: versionLocal.version,
          versionRemota: versionRemota.version,
          notas: versionRemota.notas,
          mensaje: `Nueva versión ${versionRemota.version} disponible (${versionRemota.fecha}).`,
        };
      }

      // Si la versión es igual o menor, aseguramos que la local quede sincronizada
      try {
        localStorage.setItem(CLAVE_STORAGE_VERSION, JSON.stringify(versionRemota));
      } catch {
        // Ignorar
      }

      return {
        hayActualizacion: false,
        versionActual: versionLocal.version,
        mensaje: `La aplicación está al día con la versión ${versionLocal.version}.`,
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
   * Aplica la actualización en caliente de forma segura guardando la versión previamente.
   */
  public async aplicarActualizacion(): Promise<void> {
    try {
      const resultado = await this.verificarActualizacion();
      if (!resultado.hayActualizacion || !resultado.versionRemota) return;

      // 1. Guardar INMEDIATAMENTE en localStorage antes de que recargue
      const infoActualizada: InformacionVersion = {
        ...VERSION_LOCAL_POR_DEFECTO,
        version: resultado.versionRemota,
        timestamp: Date.now(),
        notas: resultado.notas || '',
      };
      localStorage.setItem(CLAVE_STORAGE_VERSION, JSON.stringify(infoActualizada));

      // 2. Marcar en sessionStorage para proteger contra bucles de recarga
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(CLAVE_RECARGA_RECIENTE, Date.now().toString());
        } catch {
          // Ignorar
        }
      }

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

      window.location.reload();
    } catch (e) {
      console.error('[ServicioActualizaciones] Error al aplicar actualización:', e);
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
