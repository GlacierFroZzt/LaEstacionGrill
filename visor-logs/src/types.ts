export type NivelLog = 'CRASH' | 'ERROR' | 'WARN' | 'INFO';

export interface DetallesLog {
  stack?: string;
  componentStack?: string;
  origenError?: string;
  archivo?: string;
  linea?: number;
  columna?: number;
  userAgent?: string;
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
}
