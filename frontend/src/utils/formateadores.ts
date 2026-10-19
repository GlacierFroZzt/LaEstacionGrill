/**
 * Formatea un valor numérico a moneda mexicana (MXN).
 */
export const formatearMoneda = (cantidad: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(cantidad);
};

/**
 * Calcula el tiempo transcurrido en minutos u horas a partir de una fecha ISO.
 */
export const formatearTiempoTranscurrido = (fechaIso: string | null): string => {
  if (!fechaIso) return '0 min';
  try {
    const inicio = new Date(fechaIso).getTime();
    const ahora = Date.now();
    const diferenciaMs = Math.max(0, ahora - inicio);
    const minutos = Math.floor(diferenciaMs / (1000 * 60));

    if (minutos < 1) return 'Recién abierta';
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const minRestantes = minutos % 60;
    return `${horas}h ${minRestantes}m`;
  } catch (error: unknown) {
    console.error('[formatearTiempoTranscurrido] Error al procesar fecha:', error);
    return '0 min';
  }
};

/**
 * Formatea una fecha ISO a hora local legible (ej: 03:45 PM).
 */
export const formatearHoraCorta = (fechaIso: string): string => {
  try {
    const fecha = new Date(fechaIso);
    return fecha.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error: unknown) {
    console.error('[formatearHoraCorta] Error al procesar hora:', error);
    return '';
  }
};

/**
 * Formatea una fecha para encabezados de turno.
 */
export const formatearFechaCompleta = (fechaInput: string | Date): string => {
  try {
    const fecha = typeof fechaInput === 'string' ? new Date(fechaInput) : fechaInput;
    return fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error: unknown) {
    console.error('[formatearFechaCompleta] Error:', error);
    return '';
  }
};
