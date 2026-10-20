import { useRef, useCallback } from 'react';

export interface OpcionesPulsacionProlongada {
  readonly tiempoMs?: number;
  readonly umbralMovimientoPx?: number;
}

export interface RetornoPulsacionProlongada {
  readonly onTouchStart: (e: React.TouchEvent) => void;
  readonly onTouchMove: (e: React.TouchEvent) => void;
  readonly onTouchEnd: (e: React.TouchEvent) => void;
  readonly onTouchCancel: () => void;
  readonly onMouseDown: (e: React.MouseEvent) => void;
  readonly onMouseUp: (e: React.MouseEvent) => void;
  readonly onMouseLeave: () => void;
  readonly onContextMenu: (e: React.MouseEvent) => void;
  readonly handleClickSeguro: (e: React.MouseEvent, callbackClickNormal: () => void) => void;
}

/**
 * Hook para detectar de forma robusta pulsaciones prolongadas (long-press) en pantallas táctiles
 * y clics derechos en ordenadores, distinguiendo limpiamente entre gestos de scroll y toques normales.
 */
export function usePulsacionProlongada(
  alActivar: () => void,
  opciones: OpcionesPulsacionProlongada = {}
): RetornoPulsacionProlongada {
  const { tiempoMs = 500, umbralMovimientoPx = 10 } = opciones;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicioCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const seActivoLongPressRef = useRef<boolean>(false);
  const bloquearClickRef = useRef<boolean>(false);

  const limpiarTemporizador = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    inicioCoordsRef.current = null;
  }, []);

  const dispararActivacion = useCallback((): void => {
    seActivoLongPressRef.current = true;
    bloquearClickRef.current = true;

    // Vibración háptica suave si el dispositivo cuenta con motor vibrador
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(35);
      }
    } catch {
      // Ignorar de forma segura si no está permitido por la política del navegador
    }

    alActivar();
  }, [alActivar]);

  // Manejadores Táctiles (Smartphones y Tablets)
  const onTouchStart = useCallback(
    (e: React.TouchEvent): void => {
      if (e.touches.length !== 1) {
        limpiarTemporizador();
        return;
      }

      seActivoLongPressRef.current = false;
      const toque = e.touches[0];
      inicioCoordsRef.current = { x: toque.clientX, y: toque.clientY };

      timerRef.current = setTimeout(() => {
        dispararActivacion();
      }, tiempoMs);
    },
    [dispararActivacion, limpiarTemporizador, tiempoMs]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent): void => {
      if (!inicioCoordsRef.current || e.touches.length !== 1) return;

      const toque = e.touches[0];
      const deltaX = Math.abs(toque.clientX - inicioCoordsRef.current.x);
      const deltaY = Math.abs(toque.clientY - inicioCoordsRef.current.y);

      // Si el desplazamiento supera el umbral, el usuario está haciendo scroll: cancelar
      if (deltaX > umbralMovimientoPx || deltaY > umbralMovimientoPx) {
        limpiarTemporizador();
      }
    },
    [limpiarTemporizador, umbralMovimientoPx]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent): void => {
      limpiarTemporizador();

      if (seActivoLongPressRef.current) {
        // Prevenir que el toque suelto dispare el click normal de ordenar
        if (e.cancelable) {
          e.preventDefault();
        }
        setTimeout(() => {
          bloquearClickRef.current = false;
          seActivoLongPressRef.current = false;
        }, 100);
      }
    },
    [limpiarTemporizador]
  );

  const onTouchCancel = useCallback((): void => {
    limpiarTemporizador();
    seActivoLongPressRef.current = false;
  }, [limpiarTemporizador]);

  // Manejadores de Ratón (Escritorio / Laptop)
  const onMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      if (e.button !== 0) return; // Solo clic primario (izquierdo)
      seActivoLongPressRef.current = false;
      timerRef.current = setTimeout(() => {
        dispararActivacion();
      }, tiempoMs);
    },
    [dispararActivacion, tiempoMs]
  );

  const onMouseUp = useCallback((): void => {
    limpiarTemporizador();
    if (seActivoLongPressRef.current) {
      setTimeout(() => {
        bloquearClickRef.current = false;
        seActivoLongPressRef.current = false;
      }, 100);
    }
  }, [limpiarTemporizador]);

  const onMouseLeave = useCallback((): void => {
    limpiarTemporizador();
  }, [limpiarTemporizador]);

  // Clic Derecho
  const onContextMenu = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      limpiarTemporizador();
      bloquearClickRef.current = true;
      alActivar();
      setTimeout(() => {
        bloquearClickRef.current = false;
      }, 100);
    },
    [alActivar, limpiarTemporizador]
  );

  // Wrapper para el click normal de la tarjeta
  const handleClickSeguro = useCallback(
    (e: React.MouseEvent, callbackClickNormal: () => void): void => {
      if (bloquearClickRef.current || seActivoLongPressRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      callbackClickNormal();
    },
    []
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
    handleClickSeguro,
  };
}
