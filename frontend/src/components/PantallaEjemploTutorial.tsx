import React, { useState } from 'react';
import {
  Plus,
  Flame,
  Check,
  Send,
  Eye,
  Edit3,
  Trash2,
  DollarSign,
  CreditCard,
  Smartphone,
  Sparkles,
  Users,
  Image as ImageIcon,
} from 'lucide-react';
import { formatearMoneda } from '../utils/formateadores';

interface PantallaEjemploTutorialProps {
  readonly paso: 2 | 3 | 5;
  readonly esClaro?: boolean;
}

export const PantallaEjemploTutorial: React.FC<PantallaEjemploTutorialProps> = ({
  paso,
  esClaro = false,
}) => {
  // Estados interactivos para simulación del Paso 2 (Comanda)
  const [itemsDemo, setItemsDemo] = useState<
    { id: string; nombre: string; cantidad: number; precio: number; notas: string }[]
  >([
    { id: '1', nombre: 'Orden de Tacos de Trompo', cantidad: 2, precio: 130, notas: 'Con todo, tortilla de maíz' },
    { id: '2', nombre: 'Gringa de Pastor con Queso', cantidad: 1, precio: 70, notas: 'Doble queso asadero' },
    { id: '3', nombre: 'Coca-Cola 600ml', cantidad: 2, precio: 35, notas: 'Bien fría' },
  ]);
  const [enviadoCocina, setEnviadoCocina] = useState(false);

  // Estados interactivos para simulación del Paso 5 (Cobro)
  const [metodoPagoDemo, setMetodoPagoDemo] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'>('efectivo');
  const [montoRecibidoDemo, setMontoRecibidoDemo] = useState<number>(500);
  const [propinaDemo, setPropinaDemo] = useState<number>(40);
  const [personasDivisionDemo, setPersonasDivisionDemo] = useState<number>(2);

  const subtotalDemo = itemsDemo.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const totalCobroDemo = 400 + propinaDemo;
  const cambioDemo = Math.max(0, montoRecibidoDemo - totalCobroDemo);

  const handleAgregarPlatilloDemo = (nombre: string, precio: number) => {
    setItemsDemo((prev) => [
      ...prev,
      {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        nombre,
        cantidad: 1,
        precio,
        notas: 'Agregado desde simulador',
      },
    ]);
  };

  const handleMandarCocinaDemo = () => {
    setEnviadoCocina(true);
    setTimeout(() => setEnviadoCocina(false), 2500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden select-none relative animate-in fade-in duration-200">
      {/* Banner Superior Distintivo de Modo Demostración */}
      <div
        className={`px-4 py-2 border-b flex items-center justify-between gap-3 shrink-0 z-20 ${
          esClaro
            ? 'bg-amber-100/90 border-amber-200 text-amber-950'
            : 'bg-amber-950/60 border-amber-500/30 text-amber-200 backdrop-blur-md'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-black">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="uppercase tracking-wider">
            Pantalla de Demostración del Paso {paso}
          </span>
          <span className="hidden sm:inline font-normal opacity-80">
            — Simulador interactivo que no altera tus datos reales
          </span>
        </div>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
          Modo Demo
        </span>
      </div>

      {/* ========================================================
          PASO 2: DEMOSTRACIÓN DE COMANDERO Y ENVÍO AL COMAL
          ======================================================== */}
      {paso === 2 && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden">
          {/* Panel Izquierdo: Catálogo de Platillos Simulado */}
          <div className="flex-1 min-h-0 flex flex-col border-r border-stone-800 p-3 sm:p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  Mesa 4 · Salón Principal (Demo)
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold">
                  En Servicio
                </span>
              </div>
              <span className="text-xs text-stone-400">Mesero: Juan P.</span>
            </div>

            {/* Pastillas de Categorías de Prueba */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-black text-xs shrink-0 flex items-center gap-1.5 shadow-sm">
                <Flame className="w-3.5 h-3.5" /> 1. Tacos
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 font-bold text-xs shrink-0">
                2. Burgers
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 font-bold text-xs shrink-0">
                3. Papas
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 font-bold text-xs shrink-0">
                5. Bebidas
              </span>
            </div>

            {/* Cuadrícula de Platillos Demo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {[
                { nombre: 'Tacos de Trompo', precio: 130, desc: 'Orden norteña marinada con cebolla y cilantro' },
                { nombre: 'Gringa de Pastor', precio: 70, desc: 'Tortilla de harina con abundante queso asadero' },
                { nombre: 'Campechana Especial', precio: 80, desc: 'Combinación jugosa de bistec y trompo' },
                { nombre: 'Pirata Parrillero', precio: 80, desc: 'Carne asada al carbón con queso fundido' },
              ].map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col justify-between min-h-[90px] shadow-sm hover:border-amber-500/50 transition-colors"
                >
                  <div>
                    <h5 className="font-extrabold text-sm text-stone-100">{p.nombre}</h5>
                    <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">{p.desc}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-800/60">
                    <span className="font-black text-amber-400 text-sm">{formatearMoneda(p.precio)}</span>
                    <button
                      type="button"
                      onClick={() => handleAgregarPlatilloDemo(p.nombre, p.precio)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-stone-950 text-amber-400 border border-amber-500/30 transition-all cursor-pointer active:scale-95"
                    >
                      + Ordenar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Derecho: Detalle de Comanda Simulado */}
          <div className="w-full lg:w-[380px] bg-stone-950/90 flex flex-col justify-between p-3 sm:p-4 border-t lg:border-t-0 border-stone-800">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Comanda en Preparación
                </span>
                <span className="text-[11px] text-stone-400 font-bold">3 Platillos</span>
              </div>

              {/* Lista de Items con Badges de Ronda y Cocina */}
              <div className="space-y-2 mt-3 max-h-[42vh] overflow-y-auto pr-1">
                {itemsDemo.map((it) => (
                  <div
                    key={it.id}
                    className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800/80 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-amber-400">{it.cantidad}x</span>
                        <span className="font-bold text-xs text-stone-200">{it.nombre}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5 italic">{it.notas}</p>
                      <span className="inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        ● Por enviar al comal
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-stone-300 shrink-0">
                      {formatearMoneda(it.precio * it.cantidad)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales y Botón Mandar a Cocina */}
            <div className="pt-3 border-t border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-400 font-bold">Total Comanda:</span>
                <span className="font-black text-lg text-amber-400">{formatearMoneda(subtotalDemo)}</span>
              </div>

              <button
                type="button"
                onClick={handleMandarCocinaDemo}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 active:scale-95 transition-all ring-2 ring-amber-400/60 animate-pulse cursor-pointer"
              >
                {enviadoCocina ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>¡Enviado a Cocina con Éxito!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Mandar a Cocina (3 Platillos)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PASO 3: DEMOSTRACIÓN DE GESTIÓN DE MENÚ Y FOTOGRAFÍAS
          ======================================================== */}
      {paso === 3 && (
        <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto space-y-4">
          {/* Barra de Herramientas con el Botón + Nuevo Platillo Iluminado */}
          <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between gap-3 shadow-md">
            <div>
              <h4 className="font-black text-sm text-stone-100">Catálogo de Productos de Taquería</h4>
              <p className="text-xs text-stone-400">
                Da de alta nuevos platillos o gestiona precios y fotos existentes.
              </p>
            </div>

            <button
              type="button"
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg ring-4 ring-amber-400/40 animate-pulse transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Nuevo Platillo</span>
            </button>
          </div>

          {/* Cuadrícula de Demostración con Menú Contextual Desplegado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Tarjeta 1: Producto Normal con Miniatura */}
            <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col justify-between min-h-[120px]">
              <div className="flex items-start gap-2.5">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="font-extrabold text-sm text-stone-100">Taco Campechano</h5>
                  <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">
                    Bistec y trompo con queso en tortilla suave.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-800">
                <span className="font-black text-amber-400 text-base">$80.00 MXN</span>
                <span className="text-[10px] text-stone-400">Toca para ordenar</span>
              </div>
            </div>

            {/* Tarjeta 2: Simulación de Tarjeta con Menú de Opciones Abierto (Pulsación Prolongada) */}
            <div className="relative p-3.5 rounded-2xl bg-stone-900 border-2 border-amber-500 shadow-2xl ring-4 ring-amber-400/30 flex flex-col justify-between min-h-[140px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                    Mantuviste Pulsado Aquí ⬇️
                  </span>
                  <span className="text-[10px] bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full font-black">
                    Clic Derecho / Long Press
                  </span>
                </div>
                <h5 className="font-extrabold text-base text-stone-100 mt-1">Gringa Especial con Pastor</h5>
              </div>

              {/* Menú Contextual Flotante Simulado */}
              <div className="mt-3 p-2 rounded-xl bg-stone-950 border border-amber-500/50 space-y-1.5 shadow-2xl">
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-stone-900 text-amber-300 font-bold text-xs">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Ver Fotografía Ampliada</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-stone-900 text-blue-300 font-bold text-xs">
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>2. Editar Platillo y Foto</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-stone-900 text-red-300 font-bold text-xs">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>3. Eliminar del Menú</span>
                </div>
              </div>
            </div>

            {/* Tarjeta 3: Bebida sin Cocina */}
            <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col justify-between min-h-[120px] opacity-80">
              <div>
                <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
                  Bebida Directa (Sin Cocina)
                </span>
                <h5 className="font-extrabold text-sm text-stone-100 mt-0.5">Agua Fresca de Horchata 1L</h5>
                <p className="text-xs text-stone-400 mt-0.5">Receta artesanal bien fría.</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-800">
                <span className="font-black text-amber-400 text-base">$45.00 MXN</span>
                <span className="text-[10px] text-stone-400">Entrega el mesero</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PASO 5: DEMOSTRACIÓN DE COBRO, PAGO MIXTO Y CIERRE
          ======================================================== */}
      {paso === 5 && (
        <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto max-w-2xl mx-auto w-full space-y-3.5">
          {/* Ficha Resumen de Cuenta Simulado */}
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                Mesa 4 · Cuenta a Liquidar
              </span>
              <h4 className="text-xl sm:text-2xl font-black text-stone-100 mt-0.5">Total: $400.00 MXN</h4>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-400 block font-semibold">Subtotal: $400.00</span>
              <div className="flex items-center gap-1 mt-1 justify-end">
                <span className="text-[10px] text-stone-400 font-bold">Propina:</span>
                {[0, 20, 40, 60].map((monto) => (
                  <button
                    key={monto}
                    type="button"
                    onClick={() => setPropinaDemo(monto)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      propinaDemo === monto
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    ${monto}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Selector Interactivo de Método de Pago */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Método de Pago Seleccionado
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'efectivo', label: 'Efectivo', icon: DollarSign },
                { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                { id: 'transferencia', label: 'Transfer', icon: Smartphone },
                { id: 'mixto', label: 'Pago Mixto', icon: Users },
              ].map((m) => {
                const Icon = m.icon;
                const seleccionado = metodoPagoDemo === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoPagoDemo(m.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      seleccionado
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md ring-2 ring-amber-400/40'
                        : 'bg-stone-900 text-stone-300 border-stone-800 hover:bg-stone-850'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cálculo de Efectivo y Cambio Dinámico */}
          {metodoPagoDemo === 'efectivo' && (
            <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">
                    Efectivo Recibido ($)
                  </label>
                  <input
                    type="number"
                    value={montoRecibidoDemo}
                    onChange={(e) => setMontoRecibidoDemo(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 font-black text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">
                    Cambio a Entregar
                  </label>
                  <div className="px-3 py-2 rounded-xl bg-stone-950 border border-emerald-900/50 text-emerald-400 font-black text-sm">
                    {formatearMoneda(cambioDemo)}
                  </div>
                </div>
              </div>

              {/* Botones de Efectivo Rápido */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] text-stone-400 font-bold shrink-0">Billetes:</span>
                {[440, 500, 1000].map((monto) => (
                  <button
                    key={monto}
                    type="button"
                    onClick={() => setMontoRecibidoDemo(monto)}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer transition-colors"
                  >
                    ${monto}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* División de Cuenta Interactiva (Split Bill) */}
          <div className="p-3 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-stone-300">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Dividir cuenta entre:</span>
              <select
                value={personasDivisionDemo}
                onChange={(e) => setPersonasDivisionDemo(Number(e.target.value))}
                className="bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 text-amber-400 font-bold outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} personas
                  </option>
                ))}
              </select>
            </div>
            <div className="font-mono font-black text-amber-400 text-sm">
              {formatearMoneda(totalCobroDemo / personasDivisionDemo)} / persona
            </div>
          </div>

          {/* Botón de Confirmación de Cobro y Cierre */}
          <button
            type="button"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-400/50 animate-pulse transition-all cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>Cobrar {formatearMoneda(totalCobroDemo)} y Liberar Mesa 4</span>
          </button>
        </div>
      )}
    </div>
  );
};
