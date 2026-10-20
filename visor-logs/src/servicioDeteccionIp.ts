/**
 * Servicio Singleton de Detección de Dirección IP para la Terminal de Auditoría.
 */

export class ServicioDeteccionIp {
  private static instancia: ServicioDeteccionIp | null = null;
  private ipCache: string | null = null;
  private promesaEnVuelo: Promise<string | null> | null = null;
  private readonly CLAVE_STORAGE_IP = 'taqueria_terminal_ip_cache_v1';

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        const guardada = sessionStorage.getItem(this.CLAVE_STORAGE_IP);
        if (guardada) {
          this.ipCache = guardada;
        }
      } catch {
        // Fallback si no hay soporte de storage
      }
    }
  }

  public static obtenerInstancia(): ServicioDeteccionIp {
    if (!ServicioDeteccionIp.instancia) {
      ServicioDeteccionIp.instancia = new ServicioDeteccionIp();
    }
    return ServicioDeteccionIp.instancia;
  }

  public obtenerIpCache(): string | null {
    return this.ipCache;
  }

  public async obtenerIp(): Promise<string | null> {
    if (this.ipCache) {
      return this.ipCache;
    }

    if (this.promesaEnVuelo) {
      return this.promesaEnVuelo;
    }

    this.promesaEnVuelo = this.resolverIpInterno();
    try {
      const res = await this.promesaEnVuelo;
      return res;
    } finally {
      this.promesaEnVuelo = null;
    }
  }

  private async resolverIpInterno(): Promise<string | null> {
    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 1200);
      const respuesta = await fetch('https://api.ipify.org?format=json', { signal: controlador.signal });
      clearTimeout(timer);
      if (respuesta.ok) {
        const data = (await respuesta.json()) as { ip?: string };
        if (data?.ip) {
          this.ipCache = data.ip;
          try {
            sessionStorage.setItem(this.CLAVE_STORAGE_IP, data.ip);
          } catch {
            // Ignorar
          }
          return data.ip;
        }
      }
    } catch {
      // Ignorar fallo de red
    }

    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 1200);
      const respuesta = await fetch('https://api64.ipify.org?format=json', { signal: controlador.signal });
      clearTimeout(timer);
      if (respuesta.ok) {
        const data = (await respuesta.json()) as { ip?: string };
        if (data?.ip) {
          this.ipCache = data.ip;
          try {
            sessionStorage.setItem(this.CLAVE_STORAGE_IP, data.ip);
          } catch {
            // Ignorar
          }
          return data.ip;
        }
      }
    } catch {
      // Ignorar fallo de red
    }

    return null;
  }
}

export const servicioDeteccionIp = ServicioDeteccionIp.obtenerInstancia();
