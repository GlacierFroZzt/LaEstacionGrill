/**
 * Servicio Singleton de Detección y Deduplicación de Direcciones IP.
 * Permite identificar la dirección IP del dispositivo (tanto en red local como en internet pública)
 * para agrupar sesiones y evitar que múltiples pestañas o reconexiones se contabilicen como múltiples dispositivos.
 */

export class ServicioDeteccionIp {
  private static instancia: ServicioDeteccionIp | null = null;
  private ipCache: string | null = null;
  private promesaEnVuelo: Promise<string | null> | null = null;
  private readonly CLAVE_STORAGE_IP = 'taqueria_disp_ip_cache_v1';

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        const guardada = sessionStorage.getItem(this.CLAVE_STORAGE_IP);
        if (guardada) {
          this.ipCache = guardada;
        }
      } catch {
        // Fallback silencioso si sessionStorage no está disponible
      }
    }
  }

  public static obtenerInstancia(): ServicioDeteccionIp {
    if (!ServicioDeteccionIp.instancia) {
      ServicioDeteccionIp.instancia = new ServicioDeteccionIp();
    }
    return ServicioDeteccionIp.instancia;
  }

  /**
   * Retorna la IP en caché síncrona si ya fue resuelta previamente.
   */
  public obtenerIpCache(): string | null {
    return this.ipCache;
  }

  /**
   * Obtiene la dirección IP del dispositivo con mecanismos de respaldo rápidos (LAN y público).
   */
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
    // 1. Intentar obtener la IP local desde el servidor LAN si está configurado
    try {
      if (typeof window !== 'undefined') {
        const hostLan = localStorage.getItem('taqueria_servidor_host');
        if (hostLan) {
          const hostLimpio = hostLan.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
          const controlador = new AbortController();
          const timer = setTimeout(() => controlador.abort(), 900);
          const respuesta = await fetch(`http://${hostLimpio}/api/ping`, { signal: controlador.signal });
          clearTimeout(timer);
          if (respuesta.ok) {
            const data = (await respuesta.json()) as { tuIp?: string };
            if (data?.tuIp && data.tuIp !== '127.0.0.1' && data.tuIp !== '::1') {
              this.guardarIpEnCache(data.tuIp);
              return data.tuIp;
            }
          }
        }
      }
    } catch {
      // Continuar al proveedor público
    }

    // 2. Intentar servicio público ipify con timeout estricto de 1.2 segundos
    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 1200);
      const respuesta = await fetch('https://api.ipify.org?format=json', { signal: controlador.signal });
      clearTimeout(timer);
      if (respuesta.ok) {
        const data = (await respuesta.json()) as { ip?: string };
        if (data?.ip) {
          this.guardarIpEnCache(data.ip);
          return data.ip;
        }
      }
    } catch {
      // Intentar alternativa api64
    }

    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 1200);
      const respuesta = await fetch('https://api64.ipify.org?format=json', { signal: controlador.signal });
      clearTimeout(timer);
      if (respuesta.ok) {
        const data = (await respuesta.json()) as { ip?: string };
        if (data?.ip) {
          this.guardarIpEnCache(data.ip);
          return data.ip;
        }
      }
    } catch {
      // Red desconectada o bloqueada
    }

    return null;
  }

  private guardarIpEnCache(ip: string): void {
    this.ipCache = ip;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(this.CLAVE_STORAGE_IP, ip);
      } catch {
        // Ignorar falla de almacenamiento de sesión
      }
    }
  }
}

export const servicioDeteccionIp = ServicioDeteccionIp.obtenerInstancia();
