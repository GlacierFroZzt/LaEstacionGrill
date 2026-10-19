import React from 'react';
import { useRestaurante } from '../context/RestauranteContext';

export interface PropsBotonOroLiquido
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: React.ReactNode;
  readonly activo?: boolean;
  readonly velocidad?: number;
  readonly brillo?: number;
  readonly densidadOndas?: number;
}

/**
 * Componente BotonOroLiquido:
 * - Si nivelOroLiquido !== 'apagado': Presenta acabado de oro fundido satinado de alto contraste con aceleración GPU.
 * - Si nivelOroLiquido === 'apagado': Presenta color amarillo ámbar sólido de alto contraste.
 * Diseñado para máximo rendimiento (0 WebGL contexts secundarios), reservando WebGL para el fondo ambiental.
 */
export const BotonOroLiquido: React.FC<PropsBotonOroLiquido> = ({
  children,
  className = '',
  activo = true,
  type = 'button',
  disabled = false,
  ...restoProps
}) => {
  const { nivelOroLiquido } = useRestaurante();
  const animacionActiva = activo && nivelOroLiquido !== 'apagado' && !disabled;

  return (
    <button
      type={type}
      disabled={disabled}
      {...restoProps}
      className={`relative overflow-hidden font-black text-stone-950 border transition-all active:scale-95 select-none ${
        activo
          ? animacionActiva
            ? 'boton-oro-liquido shadow-md shadow-amber-950/30'
            : 'border-amber-400/90 shadow-md shadow-amber-950/40 bg-amber-500'
          : 'border-stone-800 bg-stone-900 text-stone-400'
      } ${disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'} ${className}`}
    >
      {animacionActiva && (
        <>
          {/* Viñeteado lateral y superior para volumen tridimensional metálico */}
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/20 via-transparent to-stone-950/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 pointer-events-none" />
        </>
      )}
      <span className="relative z-10 flex items-center justify-center gap-1.5 w-full h-full drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">
        {children}
      </span>
    </button>
  );
};

export default BotonOroLiquido;
