/**
 * Definiciones de tipos estrictos para el sistema de comandas Taquería Km 243.
 * Diseñado conforme a estándares de tipado estricto y modelos de dominio en español.
 */

export type EstadoMesa = 'libre' | 'ocupada' | 'por_cobrar';

export type CategoriaProducto =
  | 'tacos'
  | 'hamburguesas'
  | 'papas'
  | 'antojos'
  | 'bebidas'
  | 'extras';

export type TipoArea = 'mesa' | 'domicilio';

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

export type TemaVisual = 'oscuro' | 'claro';

export interface DesglosePagoMixto {
  readonly metodo1: MetodoPago;
  readonly monto1: number;
  readonly metodo2: MetodoPago;
  readonly monto2: number;
}

export interface DivisionCuentaInfo {
  readonly personas: number;
  readonly montoPorPersona: number;
}

export interface ModificadorOpcion {
  readonly id: string;
  readonly nombre: string;
  readonly precioExtra: number;
}

export interface Producto {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly precio: number;
  readonly categoria: CategoriaProducto;
  readonly modificadoresSugeridos?: readonly string[];
  readonly imagenUrl?: string;
  readonly requierePreparacion?: boolean; // false para bebidas directas que lleva el mesero
}

export interface FormularioProductoDTO {
  readonly id?: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly precio: number;
  readonly categoria: CategoriaProducto;
  readonly modificadoresSugeridos?: readonly string[];
  readonly imagenUrl?: string;
  readonly requierePreparacion?: boolean;
}

export interface ItemComanda {
  readonly id: string;
  readonly productoId: string;
  readonly nombre: string;
  readonly precioUnitario: number;
  readonly categoria?: CategoriaProducto;
  readonly requierePreparacion?: boolean;
  cantidad: number;
  cantidadEnviadaCocina?: number; // Cantidad acumulada ya despachada a cocina
  notas: string;
  modificadoresSeleccionados: string[];
  readonly fechaAgregado: string; // ISO string
}

export interface Mesa {
  readonly id: string;
  readonly numero: number;
  nombre: string;
  readonly area: TipoArea;
  readonly capacidad: number;
  estado: EstadoMesa;
  cuentaActivaId: string | null;
  horaApertura: string | null; // ISO string
  totalParcial: number;
  meseroAsignado?: string;
}

export interface Cuenta {
  readonly id: string;
  mesaId: string;
  numeroMesa: number;
  nombreMesa: string;
  readonly items: ItemComanda[];
  subtotal: number;
  descuento: number;
  propina: number;
  total: number;
  estado: 'abierta' | 'cerrada';
  horaApertura: string;
  horaCierre: string | null;
  metodoPago?: MetodoPago;
  montoRecibido?: number;
  cambioEntregado?: number;
  desgloseMixto?: DesglosePagoMixto;
  divisionCuenta?: DivisionCuentaInfo;
  mesero: string;
}

export interface CorteCaja {
  readonly id: string;
  readonly fechaApertura: string;
  fechaCierre: string | null;
  totalVentas: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalPropinas?: number;
  cuentasCobradasCount: number;
  ticketPromedio: number;
  estaAbierto: boolean;
  pinSeguridad: string;
}

export interface ResumenPropinaMesero {
  readonly mesero: string;
  readonly totalPropina: number;
  readonly cuentasCount: number;
  readonly propinaEfectivo: number;
  readonly propinaTarjeta: number;
  readonly propinaTransferencia: number;
  readonly porcentajeDelTotal: number;
}

export interface TurnoCerrado extends CorteCaja {
  readonly fechaCierre: string;
  readonly cuentasCobradas: readonly Cuenta[];
  readonly pedidosCocinaArchivados?: readonly PedidoCocina[];
}

export interface FiltroCategoria {
  readonly id: CategoriaProducto | 'todos';
  readonly etiqueta: string;
}

export type EstadoPedidoCocina = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';

export interface ItemPedidoCocina {
  readonly id: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly notas: string;
  readonly modificadores: readonly string[];
  completado: boolean;
}

export interface PedidoCocina {
  readonly id: string;
  readonly comandaId: string;
  mesaId: string;
  nombreMesa: string;
  readonly mesero: string;
  readonly horaEnvio: string; // ISO string
  items: ItemPedidoCocina[];
  estado: EstadoPedidoCocina;
  numeroRonda?: number; // 1 = Inicial, 2+ = Adicionales/Nuevos pedidos
}

export type VistaPrincipal = 'mesas' | 'cocina';

export type TipoEventoSync =
  | 'SYNC_ESTADO_COMPLETO'
  | 'SOLICITAR_ESTADO_ACTUAL'
  | 'MESA_ACTUALIZADA'
  | 'MESA_ELIMINADA'
  | 'NUEVA_COMANDA_COCINA'
  | 'PEDIDO_COCINA_ACTUALIZADO'
  | 'CUENTA_COBRADA'
  | 'TURNO_REINICIADO'
  | 'ESTADO_CONEXION_ACTUALIZADO'
  | 'DISPOSITIVOS_ACTUALIZADOS'
  | 'PRESENCIA_ANUNCIO'
  | 'PRESENCIA_ACK'
  | 'CATALOGO_PRODUCTOS_ACTUALIZADO';

export interface MensajeSincronizacion {
  readonly id: string;
  readonly tipo: TipoEventoSync;
  readonly timestamp: string;
  readonly remitenteId: string;
  readonly payload: unknown;
}

export * from './facturacion';


