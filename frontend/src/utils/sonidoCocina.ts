/**
 * Utilidad de alerta sonora para la pantalla de cocina (KDS).
 * Genera un sonido de campanilla acústica de restaurante mediante Web Audio API.
 * 
 * Implementa el patrón Singleton y desbloqueo proactivo para el motor WebKit de iOS / Safari,
 * asegurando que las alertas de comandas nuevas suenen sin bloqueos de reproducción automática
 * ni agotamiento de contextos de audio concurrentes.
 */

class GestorAudioCocina {
  private static instancia: GestorAudioCocina | null = null;
  private audioContext: AudioContext | null = null;
  private desbloqueado: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.instalarDesbloqueadorIOS();
    }
  }

  public static obtenerInstancia(): GestorAudioCocina {
    if (!this.instancia) {
      this.instancia = new GestorAudioCocina();
    }
    return this.instancia;
  }

  /**
   * Obtiene o inicializa perezosamente el AudioContext singleton.
   */
  private obtenerContexto(): AudioContext | null {
    if (!this.audioContext && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass) {
        try {
          this.audioContext = new AudioContextClass();
        } catch (error: unknown) {
          console.error('[GestorAudioCocina] Error al inicializar AudioContext:', error);
        }
      }
    }
    return this.audioContext;
  }

  /**
   * Escucha la primera interacción táctil o clic del usuario para desbloquear el AudioContext en iOS Safari.
   */
  private instalarDesbloqueadorIOS(): void {
    const eventosDesbloqueo: (keyof WindowEventMap)[] = ['touchstart', 'touchend', 'pointerdown', 'click'];

    const handler = async (): Promise<void> => {
      try {
        const ctx = this.obtenerContexto();
        if (ctx) {
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          this.desbloqueado = true;
        }
      } catch (error: unknown) {
        console.warn('[GestorAudioCocina] Advertencia al desbloquear audio en iOS:', error);
      } finally {
        eventosDesbloqueo.forEach((nombreEvento) => {
          window.removeEventListener(nombreEvento, handler);
        });
      }
    };

    eventosDesbloqueo.forEach((nombreEvento) => {
      window.addEventListener(nombreEvento, handler, { once: true, passive: true });
    });
  }

  /**
   * Fuerza el intento de reanudación del contexto de audio.
   */
  public async asegurarDesbloqueo(): Promise<boolean> {
    const ctx = this.obtenerContexto();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.desbloqueado = true;
      } catch (error: unknown) {
        console.warn('[GestorAudioCocina] No se pudo reanudar AudioContext:', error);
        return false;
      }
    }
    return true;
  }

  /**
   * Reproduce el tono de campanilla acústica de dos armónicos (La5 y Mi6).
   */
  public async reproducirCampana(): Promise<void> {
    try {
      const ctx = this.obtenerContexto();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const tiempoActual = ctx.currentTime;

      // Campana tono 1 (880 Hz - Nota La5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, tiempoActual);

      gain1.gain.setValueAtTime(0.3, tiempoActual);
      gain1.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.8);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(tiempoActual);
      osc1.stop(tiempoActual + 0.8);

      // Campana tono 2 (1320 Hz - Nota Mi6 armónico brillante)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1320, tiempoActual + 0.15);

      gain2.gain.setValueAtTime(0.25, tiempoActual + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 1.1);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(tiempoActual + 0.15);
      osc2.stop(tiempoActual + 1.1);
    } catch (error: unknown) {
      console.warn('[GestorAudioCocina] No se pudo reproducir el tono acústico:', error);
    }
  }

  public estaDesbloqueado(): boolean {
    return this.desbloqueado || (this.audioContext ? this.audioContext.state === 'running' : false);
  }

  /**
   * Reproduce un timbre doble festivo (Do6 -> Mi6 -> Sol6) para avisar al mesero
   * que un pedido está LISTO para recogerse en barra/cocina.
   */
  public async reproducirTimbreListo(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([120, 60, 180]);
      }

      const ctx = this.obtenerContexto();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const ahora = ctx.currentTime;
      const notas = [1046.5, 1318.5, 1567.98]; // Do6, Mi6, Sol6

      notas.forEach((frecuencia, idx) => {
        const inicio = ahora + idx * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frecuencia, inicio);

        gain.gain.setValueAtTime(0.28, inicio);
        gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(inicio);
        osc.stop(inicio + 0.65);
      });
    } catch (error: unknown) {
      console.warn('[GestorAudioCocina] No se pudo reproducir timbre de pedido listo:', error);
    }
  }
}

export const gestorAudioCocina = GestorAudioCocina.obtenerInstancia();

export const reproducirCampanaCocina = (): void => {
  void gestorAudioCocina.reproducirCampana();
};

export const reproducirTimbrePedidoListo = (): void => {
  void gestorAudioCocina.reproducirTimbreListo();
};
