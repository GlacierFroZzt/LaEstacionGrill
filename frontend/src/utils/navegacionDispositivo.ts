/**
 * Gestor de navegación para botones de retroceso en dispositivos móviles y tablets.
 * Sincroniza el historial del navegador/WebView con las pantallas, modales y comandas
 * para que el botón físico, virtual o gestual de retroceso navegue intuitivamente
 * y NUNCA cierre la aplicación por accidente en el punto de venta.
 */

type HandlerRetroceso = () => void;

interface EntradaPilaNavegacion {
  id: string;
  handler: HandlerRetroceso;
}

class GestorNavegacionDispositivo {
  private static instancia: GestorNavegacionDispositivo | null = null;
  private pila: EntradaPilaNavegacion[] = [];
  private suprimiendoPopstate: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState);

      // Instalar función global para invocación directa desde MainActivity en Android
      (window as unknown as { __manejarBotonAtras?: () => boolean }).__manejarBotonAtras = () => {
        return this.retroceder();
      };

      // Seguro inicial para que el navegador/WebView nunca salga de la app al presionar Atrás
      try {
        window.history.pushState({ raizTaqueria: true }, '', window.location.href);
      } catch {
        // Ignorar en entornos sin soporte
      }
    }
  }

  public static obtenerInstancia(): GestorNavegacionDispositivo {
    if (!this.instancia) {
      this.instancia = new GestorNavegacionDispositivo();
    }
    return this.instancia;
  }

  private handlePopState = (): void => {
    if (this.suprimiendoPopstate) {
      this.suprimiendoPopstate = false;
      return;
    }

    if (this.pila.length > 0) {
      const ultimaEntrada = this.pila.pop();
      if (ultimaEntrada) {
        try {
          ultimaEntrada.handler();
        } catch (error: unknown) {
          console.error('[GestorNavegacionDispositivo] Error al ejecutar retroceso:', error);
        }
      }
    } else {
      // Si la pila está vacía (estamos en el inicio), reponer el seguro para no salir ni cerrar la app
      try {
        window.history.pushState({ raizTaqueria: true }, '', window.location.href);
      } catch {
        // Ignorar
      }
    }
  };

  /**
   * Ejecuta el retroceso del elemento más reciente en la pila.
   * Retorna true si retrocedió una pantalla/modal, o false si ya estaba en el inicio.
   */
  public retroceder(): boolean {
    if (this.pila.length > 0) {
      const ultimaEntrada = this.pila.pop();
      if (ultimaEntrada) {
        try {
          this.suprimiendoPopstate = true;
          window.history.back();
          ultimaEntrada.handler();
          return true;
        } catch (error: unknown) {
          console.error('[GestorNavegacionDispositivo] Error en retroceso manual:', error);
          return true;
        }
      }
    }

    // Reponer seguro de navegación en la raíz
    try {
      window.history.pushState({ raizTaqueria: true }, '', window.location.href);
    } catch {
      // Ignorar
    }

    return false;
  }

  /**
   * Registra una acción de retroceso en la pila del historial del celular/tablet.
   * Al presionar Atrás en el dispositivo, se ejecutará el callback provisto.
   *
   * @param id Identificador único de la vista o modal
   * @param handler Función a ejecutar al presionar Atrás
   * @returns Función de desregistro para cuando se cierra manualmente por la UI
   */
  public empujarPaso(id: string, handler: HandlerRetroceso): () => void {
    if (typeof window === 'undefined') return () => {};

    // 1. Si ya existe este id en la pila, actualizar el handler sin alterar el historial del navegador
    const entradaExistente = this.pila.find((it) => it.id === id);
    if (entradaExistente) {
      entradaExistente.handler = handler;
      return () => {
        const idx = this.pila.findIndex((it) => it.id === id);
        if (idx >= 0) {
          this.pila.splice(idx, 1);
        }
      };
    }

    // 2. Registrar nuevo paso en la navegación del dispositivo
    this.pila.push({ id, handler });
    try {
      window.history.pushState({ navegacionTaqueriaId: id, timestamp: Date.now() }, '');
    } catch {
      // Ignorar
    }

    let cancelado = false;
    return () => {
      if (cancelado) return;
      cancelado = true;

      const indice = this.pila.findIndex((it) => it.id === id);
      if (indice >= 0) {
        this.pila.splice(indice, 1);
        // Si el estado actual del historial corresponde a este paso y se cerró por la UI,
        // sincronizamos el historial del navegador consumiendo el popstate de forma silenciosa.
        try {
          const estadoActual = window.history.state as { navegacionTaqueriaId?: string } | null;
          if (estadoActual?.navegacionTaqueriaId === id) {
            this.suprimiendoPopstate = true;
            window.history.back();
          }
        } catch {
          // Ignorar
        }
      }
    };
  }

  /**
   * Limpia toda la pila de navegación y regresa la interfaz a la raíz (Inicio).
   */
  public limpiarAInicio(): void {
    if (typeof window === 'undefined') return;

    const totalAtras = this.pila.length;
    this.pila = [];

    if (totalAtras > 0) {
      this.suprimiendoPopstate = true;
      try {
        window.history.go(-totalAtras);
      } catch {
        // En caso de que no haya tantas entradas en la ventana
      }
    }

    try {
      window.history.pushState({ raizTaqueria: true }, '', window.location.href);
    } catch {
      // Ignorar
    }
  }

  public tienePasos(): boolean {
    return this.pila.length > 0;
  }
}

export const gestorNavegacion = GestorNavegacionDispositivo.obtenerInstancia();
