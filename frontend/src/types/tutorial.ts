/**
 * Tipos e interfaces estrictas para el sistema de Tutorial y Guía Interactiva
 * de Taquería Km 243.
 */

export type RolTutorial = 'mesero' | 'cocina' | 'caja' | 'general';

export interface PasoTutorial {
  readonly id: string;
  readonly numero: number;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly descripcion: string;
  readonly puntosClave: readonly string[];
  readonly rol: RolTutorial;
  readonly vistaRequerida?: 'mesas' | 'cocina';
  readonly targetId?: string; // ID o selector semántico del elemento a resaltar
  readonly posicionTooltip?: 'arriba' | 'abajo' | 'centro';
  readonly accionSugerida?: string;
}

export interface FichaManual {
  readonly id: string;
  readonly rol: RolTutorial;
  readonly titulo: string;
  readonly resumen: string;
  readonly pasos: readonly string[];
  readonly consejoNorteno?: string;
  readonly iconoNombre: string;
}
