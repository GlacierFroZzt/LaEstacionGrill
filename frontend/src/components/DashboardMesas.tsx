import React, { useState, useEffect } from 'react';
import {
  Users,
  Bike,
  Plus,
  Minus,
  Trash2,
  Settings2,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Pencil,
  ArrowRightLeft,
  BellRing,
  Flame,
  User,
} from 'lucide-react';
import type { Mesa, TipoArea } from '../types';
import { useRestaurante } from '../context/RestauranteContext';
import { formatearMoneda, formatearTiempoTranscurrido } from '../utils/formateadores';
import { BotonOroLiquido } from './BotonOroLiquido';
import { gestorNavegacion } from '../utils/navegacionDispositivo';
import { ModalRenombrarMesa } from './ModalRenombrarMesa';
import { ModalMoverMesa } from './ModalMoverMesa';
import { esRelevanteParaMesero } from '../utils/filtroMesero';

type FiltroZona = TipoArea | 'todas';

interface MensajeFeedback {
  tipo: 'exito' | 'error' | 'info';
  texto: string;
}

export const DashboardMesas: React.FC = () => {
  const {
    mesas,
    seleccionarMesa,
    abrirMesa,
    cambiarCapacidadMesa,
    solicitarCuenta,
    agregarMesa,
    eliminarMesa,
    agregarDomicilio,
    eliminarDomicilio,
    liberarMesaManual,
    tema,
    nivelOroLiquido,
    pedidosCocina,
    cambiarEstadoPedidoCocina,
    meseroActual,
  } = useRestaurante();

  const [filtroArea, setFiltroArea] = useState<FiltroZona>('todas');
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<MensajeFeedback | null>(null);
  const [mesaParaAbrir, setMesaParaAbrir] = useState<Mesa | null>(null);
  const [capacidadParaAbrir, setCapacidadParaAbrir] = useState<number>(4);
  const [mesaParaRenombrar, setMesaParaRenombrar] = useState<Mesa | null>(null);
  const [mesaParaMover, setMesaParaMover] = useState<Mesa | null>(null);

  const esClaro = tema === 'claro';

  const mostrarMensaje = (texto: string, tipo: 'exito' | 'error' | 'info'): void => {
    setMensajeFeedback({ texto, tipo });
    setTimeout(() => {
      setMensajeFeedback((actual) => (actual?.texto === texto ? null : actual));
    }, 3200);
  };

  const mesasComedor = mesas.filter((m) => m.area === 'mesa');
  const pedidosDomicilio = mesas.filter((m) => m.area === 'domicilio');

  const mesasFiltradas = mesas.filter((m) => {
    if (filtroArea === 'todas') return true;
    return m.area === filtroArea;
  });

  // Conteo de estados
  const libres = mesas.filter((m) => m.estado === 'libre').length;
  const ocupadas = mesas.filter((m) => m.estado === 'ocupada').length;
  const porCobrar = mesas.filter((m) => m.estado === 'por_cobrar').length;

  // Conteo de pedidos activos en cocina
  const pedidosCocinaActivos = pedidosCocina.filter((p) => p.estado !== 'entregado');
  const totalCocinaListos = pedidosCocinaActivos.filter((p) => p.estado === 'listo').length;
  const totalCocinaEnPrep = pedidosCocinaActivos.filter((p) => p.estado === 'en_preparacion').length;

  const handleMesaClick = (mesa: Mesa): void => {
    if (modoEdicion) return;
    if (mesa.estado === 'libre') {
      // Doble confirmación obligatoria para evitar aperturas accidentales
      setMesaParaAbrir(mesa);
      setCapacidadParaAbrir(mesa.capacidad || 4);
      return;
    }
    seleccionarMesa(mesa);
  };

  const handleConfirmarApertura = (): void => {
    if (!mesaParaAbrir) return;
    const mesaObjetivo = mesaParaAbrir;
    const capacidadElegida = capacidadParaAbrir;
    setMesaParaAbrir(null);
    if (mesaObjetivo.area !== 'domicilio' && capacidadElegida !== mesaObjetivo.capacidad) {
      cambiarCapacidadMesa(mesaObjetivo.id, capacidadElegida);
    }
    abrirMesa(mesaObjetivo.id);
    seleccionarMesa({ ...mesaObjetivo, capacidad: capacidadElegida });
    mostrarMensaje(`Se abrió "${mesaObjetivo.nombre}" (${capacidadElegida} personas) para servicio.`, 'exito');
  };

  const handleCancelarApertura = (): void => {
    setMesaParaAbrir(null);
  };

  // Botón atrás del dispositivo móvil o tablet para cerrar el diálogo
  useEffect(() => {
    if (mesaParaAbrir) {
      return gestorNavegacion.empujarPaso('modal-confirmar-apertura', handleCancelarApertura);
    }
  }, [mesaParaAbrir]);

  // Soporte de atajos con teclado físico (Enter confirma, Escape cancela)
  useEffect(() => {
    if (!mesaParaAbrir) return;

    const manejarKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmarApertura();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelarApertura();
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    return () => window.removeEventListener('keydown', manejarKeyDown);
  }, [mesaParaAbrir]);

  // Creación de espacios
  const handleAgregarMesa = (): void => {
    const nueva = agregarMesa(4);
    mostrarMensaje(`Se agregó "${nueva.nombre}".`, 'exito');
  };

  const handleAgregarDomicilio = (): void => {
    const nuevo = agregarDomicilio();
    mostrarMensaje(`Se agregó "${nuevo.nombre}".`, 'exito');
  };

  // Eliminación de espacios en modo gestión
  const handleEliminarElemento = (e: React.MouseEvent, mesa: Mesa): void => {
    e.stopPropagation();
    let resultado: { exito: boolean; mensaje: string };
    if (mesa.area === 'domicilio') {
      resultado = eliminarDomicilio(mesa.id);
    } else {
      resultado = eliminarMesa(mesa.id);
    }
    mostrarMensaje(resultado.mensaje, resultado.exito ? 'exito' : 'error');
  };

  const handleLiberarMesaForzada = (e: React.MouseEvent, mesa: Mesa): void => {
    e.stopPropagation();
    liberarMesaManual(mesa.id);
    mostrarMensaje(`Se canceló la comanda y se liberó "${mesa.nombre}" a estado libre.`, 'exito');
  };

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col p-2.5 sm:p-4 md:p-5 overflow-y-auto overscroll-contain pb-28 transition-colors ${
        esClaro
          ? nivelOroLiquido !== 'apagado'
            ? 'bg-stone-100/75 backdrop-blur-[2px] text-stone-900'
            : 'bg-stone-100 text-stone-900'
          : nivelOroLiquido !== 'apagado'
          ? 'bg-stone-950/75 backdrop-blur-[2px] text-stone-100'
          : 'bg-stone-950 text-stone-100'
      }`}
    >
      {/* Notificación Toast flotante compacta */}
      {mensajeFeedback && (
        <div
          className={`fixed top-16 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold border transition-all animate-in fade-in slide-in-from-top-3 ${
            mensajeFeedback.tipo === 'exito'
              ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-emerald-950/60'
              : mensajeFeedback.tipo === 'error'
              ? 'bg-red-950/95 border-red-500/80 text-red-200 shadow-red-950/60'
              : 'bg-stone-900 border-amber-500 text-amber-200 shadow-stone-950/80'
          }`}
        >
          {mensajeFeedback.tipo === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          )}
          <span>{mensajeFeedback.texto}</span>
          <button
            type="button"
            onClick={() => setMensajeFeedback(null)}
            className="ml-2 text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Barra de Control Consolidada (Optimizada para Celular y Tablet) */}
      <div
        className={`w-full max-w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3 pb-2 border-b ${
          esClaro ? 'border-stone-300' : 'border-stone-800/80'
        }`}
      >
        {/* Pestañas de Filtrado (Comedor y A Domicilio) */}
        <div
          className={`flex items-center gap-1 p-0.5 sm:p-1 rounded-xl border overflow-x-auto self-start max-w-full ${
            esClaro ? 'bg-stone-200/90 border-stone-300' : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          {filtroArea === 'todas' ? (
            <BotonOroLiquido
              onClick={() => setFiltroArea('todas')}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs whitespace-nowrap shadow-sm"
            >
              Todas ({mesas.length})
            </BotonOroLiquido>
          ) : (
            <button
              type="button"
              onClick={() => setFiltroArea('todas')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                esClaro ? 'text-stone-600 hover:text-stone-900' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Todas ({mesas.length})
            </button>
          )}

          {filtroArea === 'mesa' ? (
            <BotonOroLiquido
              onClick={() => setFiltroArea('mesa')}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs whitespace-nowrap shadow-sm flex items-center gap-1 sm:gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-stone-950 shrink-0 stroke-[2.5]" />
              <span>Mesas ({mesasComedor.length})</span>
            </BotonOroLiquido>
          ) : (
            <button
              type="button"
              onClick={() => setFiltroArea('mesa')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                esClaro ? 'text-stone-600 hover:text-stone-900' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Mesas ({mesasComedor.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFiltroArea('domicilio')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              filtroArea === 'domicilio'
                ? 'bg-cyan-600 text-white shadow-sm'
                : esClaro
                ? 'text-stone-600 hover:text-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Bike className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span>A Domicilio ({pedidosDomicilio.length})</span>
          </button>
        </div>

        {/* Semáforo y Botones de Creación */}
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Indicadores de Semáforo */}
          <div
            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-xl border ${
              esClaro
                ? 'bg-stone-200/80 border-stone-300 text-stone-700'
                : 'bg-stone-900/60 border-stone-800/60 text-stone-300'
            }`}
          >
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {libres} lib
            </span>
            <span className="text-stone-400">|</span>
            <span className="flex items-center gap-1 text-amber-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {ocupadas} ocup
            </span>
            {totalCocinaEnPrep > 0 && (
              <>
                <span className="text-stone-400">|</span>
                <span className="flex items-center gap-1 text-orange-500 font-black animate-pulse" title="Pedidos al carbón en cocina">
                  <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                  {totalCocinaEnPrep} prep
                </span>
              </>
            )}
            {totalCocinaListos > 0 && (
              <>
                <span className="text-stone-400">|</span>
                <span className="flex items-center gap-1 text-emerald-500 font-black animate-bounce" title="¡Pedidos listos para servir!">
                  <BellRing className="w-3 h-3 text-emerald-400" />
                  {totalCocinaListos} listos
                </span>
              </>
            )}
            {porCobrar > 0 && (
              <>
                <span className="text-stone-400">|</span>
                <span className="flex items-center gap-1 text-blue-600 font-black animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  {porCobrar} cobrar
                </span>
              </>
            )}
          </div>

          {/* Botonera de Creación */}
          <div className="flex items-center gap-1.5">
            <BotonOroLiquido
              onClick={handleAgregarMesa}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs"
              title="Agregar nueva mesa de comedor"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Mesa</span>
            </BotonOroLiquido>

            <button
              type="button"
              onClick={handleAgregarDomicilio}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                esClaro
                  ? 'bg-white hover:bg-stone-50 border-stone-300 text-stone-800 shadow-2xs'
                  : 'bg-stone-900 hover:bg-stone-800 border-stone-700/70 text-stone-200'
              }`}
              title="Agregar nuevo pedido a domicilio"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-500" />
              <span>Domicilio</span>
            </button>

            {/* Alternador de Modo Gestión */}
            {modoEdicion ? (
              <BotonOroLiquido
                onClick={() => setModoEdicion(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs"
                title="Modo gestión para eliminar espacios vacíos"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Listo</span>
              </BotonOroLiquido>
            ) : (
              <button
                type="button"
                onClick={() => setModoEdicion(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  esClaro
                    ? 'bg-white hover:bg-stone-50 border border-stone-300 text-stone-600'
                    : 'bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400'
                }`}
                title="Modo gestión para eliminar espacios vacíos"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Gestionar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aviso informativo de Modo Gestión */}
      {modoEdicion && (
        <div className="mb-3 p-2.5 px-3 bg-amber-500/15 border border-amber-500/50 rounded-xl text-xs text-amber-600 font-semibold flex items-center justify-between">
          <span>Modo Gestión activo: toca la papelera para eliminar espacios vacíos, o toca &quot;Liberar&quot; en mesas ocupadas para cancelar órdenes atascadas.</span>
          <button
            type="button"
            onClick={() => setModoEdicion(false)}
            className="text-xs font-bold underline ml-2 cursor-pointer"
          >
            Terminar
          </button>
        </div>
      )}

      {/* Cuadrícula Holgada: 1 columna en celular, 2 en phablet, MÁXIMO 3 en tablet/pantalla ancha */}
      {mesasFiltradas.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border my-auto ${
            esClaro ? 'bg-white border-stone-200' : 'bg-stone-900/30 border-stone-800/60'
          }`}
        >
          <p className="text-sm font-semibold text-stone-500">No hay pedidos o mesas en esta zona.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 flex-1">
          {mesasFiltradas.map((mesa) => {
            const esLibre = mesa.estado === 'libre';
            const esOcupada = mesa.estado === 'ocupada';
            const esPorCobrar = mesa.estado === 'por_cobrar';
            const esDomicilio = mesa.area === 'domicilio';

            // --- CASO 1: MESA / PEDIDO LIBRE ---
            if (esLibre) {
              const tarjetaLibreClase = esClaro
                ? 'bg-white border-stone-200 hover:border-emerald-500/70 hover:shadow-md text-stone-900'
                : 'bg-stone-900/40 border-stone-800/80 hover:bg-stone-900/80 hover:border-emerald-600/50 hover:shadow-md hover:shadow-emerald-950/20 text-stone-200';

              return (
                <div
                  key={mesa.id}
                  onClick={() => handleMesaClick(mesa)}
                  className={`tarjeta-tactil-suave group relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between cursor-pointer border select-none transition-all duration-150 active:scale-95 min-h-[140px] sm:min-h-[155px] ${
                    modoEdicion ? 'border-dashed border-amber-500/60' : tarjetaLibreClase
                  }`}
                >
                  {/* Botones de acción en Modo Gestión */}
                  {modoEdicion && (
                    <div className="absolute -top-2 -right-2 flex items-center gap-1 z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMesaParaRenombrar(mesa);
                        }}
                        className="p-1.5 rounded-full bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-lg cursor-pointer"
                        title={`Renombrar ${mesa.nombre}`}
                      >
                        <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleEliminarElemento(e, mesa)}
                        className="p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg cursor-pointer"
                        title={`Eliminar ${mesa.nombre}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Cabecera */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="font-extrabold text-base sm:text-lg group-hover:text-amber-500 transition-colors flex items-center gap-1.5 min-w-0">
                      {esDomicilio ? (
                        <Bike className="w-4 h-4 text-cyan-500 shrink-0" />
                      ) : (
                        <Users className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">{mesa.nombre}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMesaParaRenombrar(mesa);
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-amber-400 hover:bg-stone-500/10 transition-colors cursor-pointer shrink-0"
                        title={`Cambiar nombre de ${mesa.nombre}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        esDomicilio ? 'bg-cyan-500' : 'bg-emerald-500'
                      }`}
                      title="Disponible"
                    ></span>
                  </div>

                  {/* Centro */}
                  <div className="my-auto py-2 text-center">
                    <span className="text-xs text-stone-400 font-medium">
                      {esDomicilio ? 'Pedido a Domicilio' : `${mesa.capacidad} personas`}
                    </span>
                  </div>

                  {/* Pie */}
                  <div
                    className={`text-center pt-2 border-t ${
                      esClaro ? 'border-stone-100' : 'border-stone-800/50'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold transition-colors ${
                        esDomicilio
                          ? 'text-cyan-500 group-hover:text-cyan-600'
                          : 'text-stone-400 group-hover:text-emerald-500'
                      }`}
                    >
                      {esDomicilio ? '+ Abrir Domicilio' : '+ Abrir Mesa'}
                    </span>
                  </div>
                </div>
              );
            }

            // --- CASO 2: MESA / PEDIDO ACTIVO (OCUPADA O POR COBRAR) ---
            // Búsqueda exhaustiva de pedidos en cocina vinculados a esta mesa
            const nombreMesaBase = mesa.nombre.trim().toLowerCase();
            const pedidosMesa = pedidosCocina.filter((p) => {
              if (p.estado === 'entregado') return false;
              if (p.mesaId && p.mesaId === mesa.id) return true;
              if (mesa.cuentaActivaId && p.comandaId === mesa.cuentaActivaId) return true;
              const nombrePedido = p.nombreMesa.trim().toLowerCase();
              if (nombrePedido === nombreMesaBase) return true;
              if (nombrePedido.startsWith(nombreMesaBase + ' ') || nombrePedido.startsWith(nombreMesaBase + '(')) return true;
              return false;
            });

            const pedidosListosMesa = pedidosMesa.filter((p) => p.estado === 'listo');
            const pedidosEnPrepMesa = pedidosMesa.filter((p) => p.estado === 'en_preparacion');
            const pedidosPendientesMesa = pedidosMesa.filter((p) => p.estado === 'pendiente');

            const tienePedidoListo = pedidosListosMesa.length > 0;
            const tienePedidoEnPrep = pedidosEnPrepMesa.length > 0;
            const tienePedidoPendiente = pedidosPendientesMesa.length > 0;

            // Extraer el mesero más relevante registrado en la comanda/pedidos de la mesa
            const meseroRegistrado = mesa.meseroAsignado || pedidosMesa[0]?.mesero || '';
            const esMesaDelMeseroActual = esRelevanteParaMesero(meseroRegistrado, meseroActual);

            let claseBordeLiquido = '';
            let fondoInterior = esClaro ? 'bg-amber-50/90' : 'bg-stone-900/95';

            if (tienePedidoListo) {
              // COLOR ESPECIAL VERDE ESMERALDA RESPLANDECIENTE: ¡Pedido Listo en Cocina!
              // Si la mesa es del mesero logueado, se activa animación pulsante de alta prioridad
              claseBordeLiquido = esMesaDelMeseroActual
                ? 'tarjeta-borde-listo-cocina animate-pulse'
                : 'tarjeta-borde-listo-cocina';
              fondoInterior = esClaro ? 'bg-emerald-50/95' : 'bg-emerald-950/85';
            } else if (tienePedidoEnPrep) {
              // COLOR ESPECIAL NARANJA BRASA: Cocina está preparando la orden
              claseBordeLiquido = 'tarjeta-borde-preparando-cocina';
              fondoInterior = esClaro ? 'bg-orange-50/90' : 'bg-stone-900/95';
            } else if (esPorCobrar) {
              claseBordeLiquido = 'tarjeta-borde-azul-liquido animacion-por-cobrar';
              fondoInterior = esClaro ? 'bg-blue-50/95' : 'bg-stone-900/95';
            } else if (esDomicilio) {
              claseBordeLiquido = 'tarjeta-borde-cyan-liquido';
              fondoInterior = esClaro ? 'bg-cyan-50/90' : 'bg-stone-900/95';
            } else if (nivelOroLiquido !== 'apagado') {
              claseBordeLiquido = 'tarjeta-borde-oro-liquido';
              fondoInterior = esClaro ? 'bg-amber-50/90' : 'bg-stone-900/95';
            } else {
              // Modo Apagado: marco amarillo ámbar sólido sin animación
              claseBordeLiquido = 'bg-amber-500 shadow-md shadow-amber-950/40';
              fondoInterior = esClaro ? 'bg-amber-50/90' : 'bg-stone-900/95';
            }

            return (
              <div
                key={mesa.id}
                onClick={() => handleMesaClick(mesa)}
                className={`tarjeta-tactil-suave group relative rounded-2xl p-[2px] flex flex-col cursor-pointer select-none transition-all duration-150 active:scale-95 min-h-[145px] sm:min-h-[160px] ${claseBordeLiquido}`}
              >
                {/* Contenedor interior que deja visible el borde de oro líquido en movimiento */}
                <div
                  className={`w-full h-full rounded-[14px] p-3.5 sm:p-4.5 flex flex-col justify-between ${fondoInterior} ${
                    esClaro ? 'text-stone-900' : 'text-stone-100'
                  }`}
                >
                {/* Botones de acción en Modo Gestión */}
                {modoEdicion && (
                  <div className="absolute -top-2 -right-2 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMesaParaRenombrar(mesa);
                      }}
                      className="p-1.5 rounded-full bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-lg cursor-pointer"
                      title={`Renombrar ${mesa.nombre}`}
                    >
                      <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleLiberarMesaForzada(e, mesa)}
                      className="px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-[11px] shadow-lg cursor-pointer flex items-center gap-1 active:scale-95 border border-white/20"
                      title={`Liberar y cancelar orden de ${mesa.nombre}`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Liberar</span>
                    </button>
                  </div>
                )}

                {/* Cabecera con Nombre, Mesero Asignado y Tiempo */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-black text-base sm:text-lg flex items-center gap-1.5 min-w-0">
                      {esDomicilio ? (
                        <Bike className="w-4 h-4 text-cyan-500 shrink-0" />
                      ) : (
                        <Users className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{mesa.nombre}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMesaParaRenombrar(mesa);
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-amber-400 hover:bg-stone-800/40 transition-colors cursor-pointer shrink-0"
                        title={`Cambiar nombre de ${mesa.nombre}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </span>

                    {/* Insignia de Mesero Asignado */}
                    {meseroRegistrado && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 border ${
                          esMesaDelMeseroActual
                            ? esClaro
                              ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold'
                            : esClaro
                            ? 'bg-stone-200 text-stone-700 border-stone-300'
                            : 'bg-stone-800/80 text-stone-400 border-stone-700/60'
                        }`}
                        title={`Mesero a cargo: ${meseroRegistrado}`}
                      >
                        <User className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate max-w-[70px]">
                          {esMesaDelMeseroActual ? 'Tú' : meseroRegistrado}
                        </span>
                      </span>
                    )}
                  </div>

                  <span
                    className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                      esClaro
                        ? 'bg-white text-amber-700 border-amber-300'
                        : 'bg-stone-950/80 text-amber-400 border-amber-600/30'
                    }`}
                  >
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatearTiempoTranscurrido(mesa.horaApertura)}</span>
                  </span>
                </div>

                {/* Centro: Total en Grande e Indicador de Cocina Prominente */}
                <div className="my-1.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-400 flex items-center gap-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      Total:
                    </span>
                    <span className="text-lg sm:text-xl font-black text-emerald-500 tabular-nums">
                      {formatearMoneda(mesa.totalParcial)}
                    </span>
                  </div>

                  {/* Banners e Insignias de Estado de Cocina en la Mesa (Destacado y Relevante) */}
                  {tienePedidoListo ? (
                    <div
                      className={`flex items-center justify-between p-2 rounded-xl border shadow-md transition-all ${
                        esMesaDelMeseroActual
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-emerald-950/40 ring-2 ring-emerald-500/40'
                          : 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300/90'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BellRing
                          className={`w-4 h-4 text-emerald-400 shrink-0 ${
                            esMesaDelMeseroActual ? 'animate-bounce' : ''
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] sm:text-xs font-black tracking-wide block truncate">
                            {esMesaDelMeseroActual
                              ? '¡TU PEDIDO ESTÁ LISTO!'
                              : `¡LISTO! (${meseroRegistrado || 'Cocina'})`}
                          </span>
                          <span className="text-[10px] text-emerald-300/80 block truncate">
                            {pedidosListosMesa.reduce((acc, p) => acc + p.items.length, 0)} platillo(s) en barra
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          pedidosListosMesa.forEach((p) => {
                            cambiarEstadoPedidoCocina(p.id, 'entregado');
                          });
                          mostrarMensaje(`Se marcó como entregado el pedido de ${mesa.nombre}.`, 'exito');
                        }}
                        className="ml-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-[10px] uppercase shadow-sm transition-transform active:scale-90 cursor-pointer shrink-0"
                        title="Marcar pedido como servido y entregado a los clientes"
                      >
                        ✓ Entregar
                      </button>
                    </div>
                  ) : tienePedidoEnPrep ? (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-extrabold ${
                        esMesaDelMeseroActual
                          ? 'bg-orange-500/20 border-orange-500/60 text-orange-300 shadow-sm'
                          : 'bg-orange-950/40 border-orange-600/40 text-orange-400/90'
                      }`}
                    >
                      <Flame className="w-4 h-4 text-orange-400 fill-orange-400 shrink-0 animate-bounce" />
                      <div className="min-w-0">
                        <span className="truncate block font-black">
                          {esMesaDelMeseroActual
                            ? 'Preparando tu comanda...'
                            : `En preparación (${meseroRegistrado || 'Cocina'})`}
                        </span>
                        <span className="text-[10px] text-orange-300/70 block truncate">
                          Al carbón en el comal
                        </span>
                      </div>
                    </div>
                  ) : tienePedidoPendiente ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-amber-400/80">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">Orden enviada a cocina</span>
                    </div>
                  ) : null}
                </div>

                {/* Pie con Acciones Compactas */}
                <div
                  className={`pt-2 border-t flex items-center gap-1.5 text-xs ${
                    esClaro ? 'border-stone-200' : 'border-stone-800/80'
                  }`}
                >
                  <BotonOroLiquido
                    onClick={(e) => {
                      e.stopPropagation();
                      seleccionarMesa(mesa);
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs"
                  >
                    Comanda
                  </BotonOroLiquido>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMesaParaMover(mesa);
                    }}
                    className={`py-1.5 px-2.5 rounded-lg font-bold text-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer border ${
                      esClaro
                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border-blue-800/60'
                    }`}
                    title={`Mover comanda de ${mesa.nombre} a otra mesa libre`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Mover</span>
                  </button>

                  {esOcupada && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        solicitarCuenta(mesa.id);
                      }}
                      className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold active:scale-95 transition-all cursor-pointer shadow-xs"
                      title="Pedir Cuenta"
                    >
                      Cuenta
                    </button>
                  )}

                  {esPorCobrar && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        seleccionarMesa(mesa);
                      }}
                      className="py-1.5 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold active:scale-95 transition-all cursor-pointer animate-pulse shadow-md"
                    >
                      Cobrar
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
      {/* Modal de Doble Confirmación para Apertura de Mesas y Pedidos */}
      {mesaParaAbrir && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleCancelarApertura}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md bg-[#161412] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/90 flex flex-col items-center text-center animate-in zoom-in-95 duration-150"
          >
            {/* Botón cerrar X */}
            <button
              type="button"
              onClick={handleCancelarApertura}
              className="absolute top-4 right-4 p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Ícono de Espacio con halo */}
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-3 shadow-inner border ${
                mesaParaAbrir.area === 'domicilio'
                  ? 'bg-cyan-500/15 border-cyan-500/30'
                  : 'bg-amber-500/15 border-amber-500/30'
              }`}
            >
              {mesaParaAbrir.area === 'domicilio' ? (
                <Bike className="w-8 h-8 text-cyan-400 stroke-[2.2]" />
              ) : (
                <Users className="w-8 h-8 text-amber-400 stroke-[2.2]" />
              )}
            </div>

            {/* Badge de confirmación */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Confirmar Apertura</span>
              </span>
            </div>

            {/* Título y Pregunta */}
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
              ¿Abrir {mesaParaAbrir.nombre}?
            </h3>

            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xs mb-3">
              {mesaParaAbrir.area === 'domicilio'
                ? '¿Deseas iniciar este pedido a domicilio para comenzar a registrar platillos y comanda?'
                : 'Selecciona cuántas personas ocuparán la mesa para iniciar el servicio:'}
            </p>

            {/* Selector de Personas antes de abrir (Solo para mesas convencionales) */}
            {mesaParaAbrir.area !== 'domicilio' && (
              <div className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    Personas en la mesa:
                  </span>
                  <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full">
                    {capacidadParaAbrir} {capacidadParaAbrir === 1 ? 'persona' : 'personas'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCapacidadParaAbrir((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold active:scale-90 cursor-pointer"
                    title="Menos personas"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={capacidadParaAbrir}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setCapacidadParaAbrir(Math.min(50, Math.max(1, v)));
                    }}
                    className="flex-1 text-center py-1.5 px-2 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 font-black text-sm focus:outline-hidden focus:border-amber-500"
                  />

                  <button
                    type="button"
                    onClick={() => setCapacidadParaAbrir((p) => Math.min(50, p + 1))}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold active:scale-90 cursor-pointer"
                    title="Más personas"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Chips rápidos */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {[2, 4, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCapacidadParaAbrir(num)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        capacidadParaAbrir === num
                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-black'
                          : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
                      }`}
                    >
                      {num} pers.
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones de Doble Confirmación */}
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmarApertura}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
              >
                <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                <span>
                  Sí, Abrir {mesaParaAbrir.area === 'domicilio' ? 'Domicilio' : 'Mesa'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCancelarApertura}
                className="w-full py-2.5 sm:py-3 px-4 rounded-2xl bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white font-bold text-xs sm:text-sm transition-all cursor-pointer border border-stone-800/80 active:scale-95"
              >
                Cancelar
              </button>
            </div>

            {/* Atajos táctiles y de teclado */}
            <p className="text-[10px] text-stone-400 mt-3 select-none">
              Protección contra toques accidentales · [Enter] Abrir · [Esc] Cancelar
            </p>
          </div>
        </div>
      )}

      {/* Modales de Cambio de Nombre y Mover Mesa */}
      <ModalRenombrarMesa
        mesa={mesaParaRenombrar}
        isOpen={Boolean(mesaParaRenombrar)}
        onClose={() => setMesaParaRenombrar(null)}
        onExito={(nuevo) => mostrarMensaje(`Se actualizó el nombre a "${nuevo}".`, 'exito')}
      />

      <ModalMoverMesa
        mesaOrigen={mesaParaMover}
        isOpen={Boolean(mesaParaMover)}
        onClose={() => setMesaParaMover(null)}
        onExito={(destino) => mostrarMensaje(`Se movió la orden a "${destino.nombre}".`, 'exito')}
      />
    </div>
  );
};

export default DashboardMesas;
