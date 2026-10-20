export type NivelLog = 'CRASH' | 'ERROR' | 'WARN' | 'INFO';

export interface DetallesLog {
  ip?: string;
  nombreDispositivo?: string;
  stack?: string;
  componentStack?: string;
  origenError?: string;
  archivo?: string;
  linea?: number;
  columna?: number;
  userAgent?: string;
  plataforma?: string;
  url?: string;
  timestampMs?: number;
  errorOriginal?: string;
  [key: string]: unknown;
}

export interface RegistroLog {
  id: string;
  nivel: NivelLog;
  origen: string;
  dispositivo_id: string;
  mensaje: string;
  detalles: DetallesLog;
  creado_en: string;
}

export interface EstadisticasLogs {
  total: number;
  crashes: number;
  errores: number;
  advertencias: number;
  informativos: number;
  dispositivosUnicos: number;
}

export interface FiltroLogs {
  texto: string;
  nivel: NivelLog | 'TODOS';
  dispositivoId: string;
  rangoFecha: 'hoy' | '24h' | '7dias' | 'todos';
  soloCatalogo?: boolean;
}

export interface DetallePresencia {
  key: string;
  dispositivoId: string;
  nombreDispositivo?: string;
  ip?: string;
  plataforma?: string;
  userAgent?: string;
  conectadoEn?: string;
  rol?: string;
}

export interface InfoDispositivoUnificado {
  clave: string;
  direccionIp: string | null;
  idsDispositivo: string[];
  nombrePrincipal: string;
  nombreReportado?: string;
  aliasPersonalizado?: string;
  plataforma: string;
  userAgent?: string;
  enLinea: boolean;
  sesionesActivas: number;
  ultimaActividad: string;
  totalLogs: number;
  totalCrashes: number;
  totalErrores: number;
  esMismoDispositivoActual?: boolean;
}
