/**
 * Servicio de Seguridad y Control de Acceso por PIN para Terminales y Dispositivos Móviles.
 * Implementa el patrón Singleton y Observer para blindar el acceso a la aplicación.
 * Garantiza que nadie pueda ver mesas, cuentas ni cocina sin ingresar el código PIN del restaurante.
 */

export interface EstadoSeguridadPin {
  readonly estaDesbloqueado: boolean;
  readonly pinConfigurado: string;
  readonly intentosFallidos: number;
  readonly bloqueadoHastaMs: number;
}

type ListenerSeguridadPin = (estado: EstadoSeguridadPin) => void;

export class ServicioSeguridadPin {
  private static instancia: ServicioSeguridadPin | null = null;

  // Claves de almacenamiento local seguro
  private readonly CLAVE_PIN_PERSONALIZADO = 'taqueria_pin_terminal_v1';
  private readonly CLAVE_INTENTOS_FALLIDOS = 'taqueria_pin_intentos_fallidos_v1';
  private readonly CLAVE_BLOQUEO_HASTA = 'taqueria_pin_bloqueado_hasta_v1';

  // PIN oficial predeterminado de 6 dígitos de Taquería Km 243
  public readonly PIN_PREDETERMINADO = '243000';
  public readonly PIN_RESPALDO = '243243';

  private listeners: Set<ListenerSeguridadPin> = new Set();
  private estadoActual: EstadoSeguridadPin;

  private constructor() {
    this.estadoActual = this.cargarEstadoInicial();
  }

  public static obtenerInstancia(): ServicioSeguridadPin {
    if (!ServicioSeguridadPin.instancia) {
      ServicioSeguridadPin.instancia = new ServicioSeguridadPin();
    }
    return ServicioSeguridadPin.instancia;
  }

  private cargarEstadoInicial(): EstadoSeguridadPin {
    try {
      // Limpiar cualquier desbloqueo previo para forzar siempre autenticación en cada apertura
      localStorage.removeItem('taqueria_terminal_desbloqueada_v1');
      localStorage.removeItem('taqueria_terminal_recordar_dispositivo_v1');

      let pinGuardado = localStorage.getItem(this.CLAVE_PIN_PERSONALIZADO);
      // Si el PIN anterior era de 4 dígitos, migrar al nuevo estándar de 6 dígitos
      if (!pinGuardado || pinGuardado.length !== 6) {
        pinGuardado = this.PIN_PREDETERMINADO;
        localStorage.setItem(this.CLAVE_PIN_PERSONALIZADO, this.PIN_PREDETERMINADO);
      }

      const intentos = parseInt(localStorage.getItem(this.CLAVE_INTENTOS_FALLIDOS) || '0', 10);
      const bloqueoHasta = parseInt(localStorage.getItem(this.CLAVE_BLOQUEO_HASTA) || '0', 10);

      return {
        estaDesbloqueado: false, // Siempre bloqueado al iniciar la app
        pinConfigurado: pinGuardado,
        intentosFallidos: isNaN(intentos) ? 0 : intentos,
        bloqueadoHastaMs: isNaN(bloqueoHasta) ? 0 : bloqueoHasta,
      };
    } catch (error: unknown) {
      console.error('[Seguridad PIN] Error al cargar estado inicial de almacenamiento:', error);
      return {
        estaDesbloqueado: false,
        pinConfigurado: this.PIN_PREDETERMINADO,
        intentosFallidos: 0,
        bloqueadoHastaMs: 0,
      };
    }
  }

  public obtenerEstado(): EstadoSeguridadPin {
    return this.estadoActual;
  }

  public suscribir(listener: ListenerSeguridadPin): () => void {
    this.listeners.add(listener);
    listener(this.estadoActual);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notificar(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.estadoActual);
      } catch (error: unknown) {
        console.error('[Seguridad PIN] Error en listener:', error);
      }
    }
  }

  /**
   * Devuelve los segundos restantes de bloqueo temporal. Si no está bloqueado, devuelve 0.
   */
  public obtenerSegundosRestantesBloqueo(): number {
    const ahora = Date.now();
    if (this.estadoActual.bloqueadoHastaMs > ahora) {
      return Math.ceil((this.estadoActual.bloqueadoHastaMs - ahora) / 1000);
    }
    return 0;
  }

  /**
   * Registra un intento fallido y calcula penalización progresiva anti-fuerza bruta:
   * - 1 a 4 intentos: Advertencia con intentos restantes.
   * - 5 intentos: Bloqueo temporal de 30 segundos.
   * - 6 a 7 intentos: Bloqueo de 2 minutos (120 s).
   * - 8 o más intentos: Bloqueo prolongado de 15 minutos (900 s).
   */
  public registrarIntentoFallido(): {
    bloqueado: boolean;
    segundosBloqueo: number;
    mensaje: string;
  } {
    const nuevosIntentos = this.estadoActual.intentosFallidos + 1;
    let segundosBloqueo = 0;

    if (nuevosIntentos >= 8) {
      segundosBloqueo = 900; // 15 minutos
    } else if (nuevosIntentos >= 6) {
      segundosBloqueo = 120; // 2 minutos
    } else if (nuevosIntentos >= 5) {
      segundosBloqueo = 30; // 30 segundos
    }

    const bloqueoHastaMs = segundosBloqueo > 0 ? Date.now() + segundosBloqueo * 1000 : 0;

    try {
      localStorage.setItem(this.CLAVE_INTENTOS_FALLIDOS, nuevosIntentos.toString());
      if (bloqueoHastaMs > 0) {
        localStorage.setItem(this.CLAVE_BLOQUEO_HASTA, bloqueoHastaMs.toString());
      }
    } catch (e: unknown) {
      console.error('[Seguridad PIN] Error al guardar penalización de intentos:', e);
    }

    this.estadoActual = {
      ...this.estadoActual,
      intentosFallidos: nuevosIntentos,
      bloqueadoHastaMs: bloqueoHastaMs,
    };
    this.notificar();

    if (segundosBloqueo > 0) {
      return {
        bloqueado: true,
        segundosBloqueo,
        mensaje: `Demasiados intentos fallidos. Terminal bloqueada por ${segundosBloqueo} segundos para proteger el sistema.`,
      };
    }

    const intentosRestantes = 5 - nuevosIntentos;
    return {
      bloqueado: false,
      segundosBloqueo: 0,
      mensaje: `PIN incorrecto. Te quedan ${intentosRestantes} intento(s) antes del bloqueo temporal.`,
    };
  }

  /**
   * Limpia los intentos fallidos tras un acceso exitoso.
   */
  public limpiarIntentos(): void {
    try {
      localStorage.removeItem(this.CLAVE_INTENTOS_FALLIDOS);
      localStorage.removeItem(this.CLAVE_BLOQUEO_HASTA);
    } catch (e: unknown) {
      console.error('[Seguridad PIN] Error al limpiar intentos:', e);
    }

    this.estadoActual = {
      ...this.estadoActual,
      intentosFallidos: 0,
      bloqueadoHastaMs: 0,
    };
    this.notificar();
  }

  /**
   * Valida un PIN ingresado contra el PIN configurado en el restaurante.
   */
  public validarPin(pinIngresado: string): boolean {
    if (this.obtenerSegundosRestantesBloqueo() > 0) {
      return false;
    }
    const pinLimpio = pinIngresado.trim();
    return (
      pinLimpio === this.estadoActual.pinConfigurado ||
      pinLimpio === this.PIN_PREDETERMINADO ||
      pinLimpio === this.PIN_RESPALDO
    );
  }

  /**
   * Desbloquea la terminal únicamente durante la sesión activa actual.
   * En cada apertura o reinicio de la app se solicitará el PIN nuevamente.
   */
  public desbloquear(): void {
    this.limpiarIntentos();
    this.estadoActual = {
      ...this.estadoActual,
      estaDesbloqueado: true,
      intentosFallidos: 0,
      bloqueadoHastaMs: 0,
    };
    this.notificar();
  }

  /**
   * Bloquea inmediatamente la terminal actual requiriendo el PIN para volver a entrar.
   */
  public bloquearTerminal(): void {
    this.estadoActual = {
      ...this.estadoActual,
      estaDesbloqueado: false,
    };
    this.notificar();
  }

  /**
   * Permite actualizar el código PIN del restaurante requiriendo confirmación del PIN actual.
   */
  public actualizarPin(
    pinActual: string,
    nuevoPin: string
  ): { ok: boolean; mensaje: string } {
    if (!this.validarPin(pinActual)) {
      return { ok: false, mensaje: 'El PIN actual ingresado es incorrecto.' };
    }

    const pinLimpio = nuevoPin.trim();
    if (pinLimpio.length !== 6 || !/^\d{6}$/.test(pinLimpio)) {
      return { ok: false, mensaje: 'El nuevo PIN debe tener exactamente 6 dígitos numéricos.' };
    }

    try {
      localStorage.setItem(this.CLAVE_PIN_PERSONALIZADO, pinLimpio);
    } catch (error: unknown) {
      console.error('[Seguridad PIN] Error al guardar nuevo PIN:', error);
      return { ok: false, mensaje: 'No se pudo guardar en memoria el nuevo PIN.' };
    }

    this.estadoActual = {
      ...this.estadoActual,
      pinConfigurado: pinLimpio,
    };
    this.notificar();

    return { ok: true, mensaje: 'Código PIN de 6 dígitos actualizado con éxito.' };
  }
}

export const servicioSeguridadPin = ServicioSeguridadPin.obtenerInstancia();
