import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Sparkles,
  Utensils,
  ChefHat,
  Receipt,
  ChevronDown,
  ChevronUp,
  Flame,
  PlayCircle,
  Users,
  Smartphone,
  Lock,
  ClipboardList,
} from 'lucide-react';
import { FICHAS_MANUAL } from '../services/datosTutorial';
import type { RolTutorial } from '../types/tutorial';
import { gestorNavegacion } from '../utils/navegacionDispositivo';

interface PropsModalManualFunciones {
  abierto: boolean;
  alCerrar: () => void;
  onIniciarTourGuiado: () => void;
}

export const ModalManualFunciones: React.FC<PropsModalManualFunciones> = ({
  abierto,
  alCerrar,
  onIniciarTourGuiado,
}) => {
  const [filtroRol, setFiltroRol] = useState<RolTutorial | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState<string>('');
  const [tarjetaExpandidaId, setTarjetaExpandidaId] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      const limpiar = gestorNavegacion.empujarPaso('modal-manual', alCerrar);
      return limpiar;
    }
  }, [abierto, alCerrar]);

  const fichasFiltradas = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    return FICHAS_MANUAL.filter((ficha) => {
      const coincideRol = filtroRol === 'todos' || ficha.rol === filtroRol;
      if (!coincideRol) return false;

      if (!query) return true;
      const enTitulo = ficha.titulo.toLowerCase().includes(query);
      const enResumen = ficha.resumen.toLowerCase().includes(query);
      const enPasos = ficha.pasos.some((p) => p.toLowerCase().includes(query));
      return enTitulo || enResumen || enPasos;
    });
  }, [filtroRol, busqueda]);

  if (!abierto) return null;

  const renderIcono = (nombreIcono: string) => {
    switch (nombreIcono) {
      case 'Utensils':
        return <Utensils className="w-4 h-4 text-amber-400" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'Smartphone':
        return <Smartphone className="w-4 h-4 text-amber-400" />;
      case 'ChefHat':
        return <ChefHat className="w-4 h-4 text-amber-400" />;
      case 'Receipt':
        return <Receipt className="w-4 h-4 text-amber-400" />;
      case 'Users':
        return <Users className="w-4 h-4 text-amber-400" />;
      case 'ClipboardList':
        return <ClipboardList className="w-4 h-4 text-amber-400" />;
      case 'Lock':
        return <Lock className="w-4 h-4 text-amber-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#14120f] border border-stone-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-stone-100">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-800/80 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white">
                  Manual de Funciones y Ayuda
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Taquería Km 243
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Consulta rápida de instrucciones operativas por rol
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            className="p-2 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 transition-all active:scale-95 cursor-pointer"
            aria-label="Cerrar manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Acciones: Buscador + Botón Iniciar Tour en Vivo */}
        <div className="p-4 border-b border-stone-800/60 bg-stone-950/40 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Input de Búsqueda */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar función (ej. comal, cobro mixto, pin, mesa)..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/60"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Botón Lanzar Tour en Vivo */}
            <button
              type="button"
              onClick={() => {
                alCerrar();
                onIniciarTourGuiado();
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/30 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Iniciar Tour en Vivo</span>
            </button>
          </div>

          {/* Filtros por Rol */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'mesero', label: '🌮 Meseros' },
              { id: 'cocina', label: '🔥 Cocina (KDS)' },
              { id: 'caja', label: '💵 Caja y Cobro' },
              { id: 'general', label: '⚙️ Seguridad y Ajustes' },
            ].map((tab) => {
              const activo = filtroRol === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFiltroRol(tab.id as RolTutorial | 'todos')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                    activo
                      ? 'bg-stone-800 text-amber-400 border border-amber-500/40 shadow-xs'
                      : 'bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Fichas de Funciones */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {fichasFiltradas.length === 0 ? (
            <div className="p-8 text-center text-stone-400 space-y-2">
              <Search className="w-8 h-8 text-stone-600 mx-auto" />
              <p className="text-sm font-semibold">No se encontraron funciones con "{busqueda}"</p>
              <p className="text-xs text-stone-500">Prueba con otro término como "tacos", "comanda" o "cuenta".</p>
            </div>
          ) : (
            fichasFiltradas.map((ficha) => {
              const expandida = tarjetaExpandidaId === ficha.id;
              return (
                <div
                  key={ficha.id}
                  className={`rounded-2xl border transition-all ${
                    expandida
                      ? 'bg-stone-900/90 border-amber-500/40 shadow-lg'
                      : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700'
                  }`}
                >
                  {/* Encabezado colapsable */}
                  <button
                    type="button"
                    onClick={() => setTarjetaExpandidaId(expandida ? null : ficha.id)}
                    className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-stone-900 border border-stone-800 shrink-0">
                        {renderIcono(ficha.iconoNombre)}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white leading-tight">
                          {ficha.titulo}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5 line-clamp-1">
                          {ficha.resumen}
                        </p>
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-stone-400 shrink-0 ml-2">
                      {expandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {expandida && (
                    <div className="px-4 pb-4 pt-1 border-t border-stone-800/60 space-y-3 text-xs animate-in fade-in">
                      <div className="space-y-2 pt-2">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 block">
                          Instrucciones Paso a Paso:
                        </span>
                        {ficha.pasos.map((paso, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-stone-300">
                            <span className="w-4 h-4 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-[10px] font-bold text-amber-400 shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-snug">{paso}</span>
                          </div>
                        ))}
                      </div>

                      {ficha.consejoNorteno && (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-200/90">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            <strong>Consejo:</strong> {ficha.consejoNorteno}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pie del Modal */}
        <div className="p-4 border-t border-stone-800/80 bg-stone-950/90 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            {fichasFiltradas.length} tema(s) disponible(s)
          </span>
          <button
            type="button"
            onClick={alCerrar}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
          >
            Cerrar Manual
          </button>
        </div>
      </div>
    </div>
  );
};
