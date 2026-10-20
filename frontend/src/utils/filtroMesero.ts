/**
 * Utilidad estricta para determinar si una mesa, comanda o pedido de cocina
 * pertenece o es relevante para el mesero conectado en la terminal actual.
 */

/**
 * Roles globales o administrativos que tienen visibilidad y alertas de todas las mesas y pedidos.
 */
const ROLES_ADMINISTRATIVOS: readonly string[] = [
  'caja',
  'admin',
  'administrador',
  'todos',
  'gerente',
  'general',
  'cocina',
  'barra',
];

/**
 * Normaliza una cadena de texto de identificador de mesero.
 */
export const normalizarNombreMesero = (nombre?: string | null): string => {
  if (!nombre) return '';
  return nombre.trim().toLowerCase();
};

/**
 * Determina si el mesero actual tiene perfil global (ve y recibe alertas de todos).
 */
export const esMeseroGlobal = (meseroActual?: string | null): boolean => {
  if (!meseroActual) return true;
  const act = normalizarNombreMesero(meseroActual);
  if (!act) return true;
  return ROLES_ADMINISTRATIVOS.some((rol) => act.includes(rol));
};

/**
 * Determina si una entidad (mesa o pedido) es relevante para el mesero logueado.
 * 
 * @param meseroEntidad Nombre del mesero registrado en la mesa, cuenta o pedido
 * @param meseroActual Nombre del mesero activo en la aplicación
 * @returns true si el mesero coincide o si el mesero actual es global/admin
 */
export const esRelevanteParaMesero = (
  meseroEntidad?: string | null,
  meseroActual?: string | null
): boolean => {
  if (!meseroActual) return true;
  if (esMeseroGlobal(meseroActual)) return true;
  const entidadNorm = normalizarNombreMesero(meseroEntidad);
  const actualNorm = normalizarNombreMesero(meseroActual);
  if (!entidadNorm) return true; // Si no tenía mesero asignado, es visible para todos
  return entidadNorm === actualNorm;
};

/**
 * Determina si una mesa física o un pedido coincide con el mesero logueado.
 * Puede verificar tanto el mesero de la mesa como el mesero registrado en la comanda.
 */
export const esMiMesaOMiPedido = (
  meseroMesa?: string | null,
  meseroPedido?: string | null,
  meseroActual?: string | null
): boolean => {
  if (!meseroActual) return true;
  if (esMeseroGlobal(meseroActual)) return true;
  const actualNorm = normalizarNombreMesero(meseroActual);
  const mesaNorm = normalizarNombreMesero(meseroMesa);
  const pedNorm = normalizarNombreMesero(meseroPedido);
  return (Boolean(mesaNorm) && mesaNorm === actualNorm) || (Boolean(pedNorm) && pedNorm === actualNorm);
};
