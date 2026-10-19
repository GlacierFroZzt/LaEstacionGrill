import type { Mesa, TipoArea } from '../types';

/**
 * Deduplica y sanea una lista de mesas provenientes de almacenamiento local,
 * WebSockets o Supabase, garantizando que nunca existan duplicados por ID,
 * ni por combinación de área y número.
 *
 * @param mesas Lista bruta de mesas
 * @returns Lista normalizada, sin duplicados y ordenada de forma consistente
 */
export function deduplicarYSanearMesas(mesas: Mesa[]): Mesa[] {
  if (!Array.isArray(mesas) || mesas.length === 0) {
    return [];
  }

  // Mapa donde la clave es una llave unificada representativa del espacio físico
  const mapaMesas = new Map<string, Mesa>();

  for (const m of mesas) {
    if (!m || typeof m !== 'object') continue;

    const area: TipoArea = m.area === 'domicilio' ? 'domicilio' : 'mesa';
    const numero = typeof m.numero === 'number' && !Number.isNaN(m.numero) ? m.numero : 1;

    // Normalización de ID canónico si viene con prefijos legados como 'm-1' o 'dom-1'
    let idNormalizado = m.id;
    if (area === 'mesa' && /^m-\d+$/i.test(m.id)) {
      idNormalizado = `mesa-${numero}`;
    } else if (area === 'domicilio' && /^dom-\d+$/i.test(m.id)) {
      idNormalizado = `domicilio-${numero}`;
    }

    const mesaLimpia: Mesa = {
      ...m,
      id: idNormalizado,
      area,
      numero,
      nombre: m.nombre || (area === 'domicilio' ? `Domicilio ${numero}` : `Mesa ${numero}`),
      capacidad: typeof m.capacidad === 'number' && m.capacidad > 0 ? m.capacidad : 4,
      estado: m.estado === 'ocupada' || m.estado === 'por_cobrar' ? m.estado : 'libre',
      totalParcial: typeof m.totalParcial === 'number' ? m.totalParcial : 0,
      cuentaActivaId: m.cuentaActivaId ?? null,
      horaApertura: m.horaApertura ?? null,
      meseroAsignado: m.meseroAsignado ?? undefined,
    };

    // Llave única por área y número para evitar duplicar el mismo espacio físico
    const claveEspacio = `${area}:${numero}`;

    // Si ya existe la mesa en la colección, el elemento más reciente en el array
    // toma precedencia, garantizando que si una mesa se desocupa (pasa a 'libre'),
    // el cambio no sea bloqueado.
    mapaMesas.set(claveEspacio, mesaLimpia);
  }

  // Deduplicación secundaria por ID para casos de números anómalos
  const mapaPorId = new Map<string, Mesa>();
  for (const m of mapaMesas.values()) {
    mapaPorId.set(m.id, m);
  }

  const resultado = Array.from(mapaPorId.values());

  // Ordenamiento consistente: mesas de comedor primero, luego pedidos a domicilio
  resultado.sort((a, b) => {
    if (a.area !== b.area) {
      return a.area === 'mesa' ? -1 : 1;
    }
    return a.numero - b.numero;
  });

  return resultado;
}
