import React, { useState, useEffect } from 'react';
import {
  Flame,
  Maximize,
  Minimize,
  ShieldCheck,
  User,
  Clock,
  ChefHat,
  LayoutGrid,
  ClipboardList,
  Sun,
  Moon,
  Menu,
  X,
  Cloud,
  Smartphone,
  Sparkles,
  FileText,
  RefreshCw,
  Lock,
  GraduationCap,
} from 'lucide-react';
import { useRestaurante } from '../context/RestauranteContext';
import { gestorNavegacion } from '../utils/navegacionDispositivo';
import { servicioSeguridadPin } from '../services/servicioSeguridadPin';
import { GuiaInstalacionIosModal } from './GuiaInstalacionIosModal';
import { LienzoOroLiquido } from './LienzoOroLiquido';
import { BotonOroLiquido } from './BotonOroLiquido';
import { ModalHistorialFacturas } from './ModalHistorialFacturas';
import { ModalActualizacionOta } from './ModalActualizacionOta';

interface NavbarSuperiorProps {
  onAbrirCorteCaja: () => void;
  onAbrirHistorialPedidos: () => void;
  onAbrirConfiguracionServidor: () => void;
  onIrAlInicio?: () => void;
  onIniciarTourTutorial?: () => void;
  onAbrirManualFunciones?: () => void;
}

export const NavbarSuperior: React.FC<NavbarSuperiorProps> = ({
  onAbrirCorteCaja,
  onAbrirHistorialPedidos,
  onAbrirConfiguracionServidor,
  onIrAlInicio,
  onIniciarTourTutorial,
  onAbrirManualFunciones,
}) => {
  const {
    estaEnLinea,
    meseroActual,
    setMeseroActual,
    vistaActual,
    setVistaActual,
    pedidosCocina,
    dispositivosConectados,
    seleccionarMesa,
    tema,
    alternarTema,
    nivelOroLiquido,
    setNivelOroLiquido,
  } = useRestaurante();

  const [menuHamburguesaAbierto, setMenuHamburguesaAbierto] = useState<boolean>(false);
  const [esPantallaCompleta, setEsPantallaCompleta] = useState<boolean>(false);
  const [horaActual, setHoraActual] = useState<string>('');
  const [modalMeseroAbierto, setModalMeseroAbierto] = useState<boolean>(false);
  const [nuevoNombreMesero, setNuevoNombreMesero] = useState<string>(meseroActual);
  const [modalGuiaIosAbierto, setModalGuiaIosAbierto] = useState<boolean>(false);
  const [modalFacturasAbierto, setModalFacturasAbierto] = useState<boolean>(false);
  const [modalOtaAbierto, setModalOtaAbierto] = useState<boolean>(false);

  // Botón Atrás del celular/tablet para el modal de actualizaciones OTA
  useEffect(() => {
    if (modalOtaAbierto) {
      const limpiar = gestorNavegacion.empujarPaso('modal-ota', () => {
        setModalOtaAbierto(false);
      });
      return limpiar;
    }
  }, [modalOtaAbierto]);

  // Botón Atrás del celular/tablet para el modal de facturas CFDI
  useEffect(() => {
    if (modalFacturasAbierto) {
      const limpiar = gestorNavegacion.empujarPaso('modal-facturas', () => {
        setModalFacturasAbierto(false);
      });
      return limpiar;
    }
  }, [modalFacturasAbierto]);

  // Botón Atrás del celular/tablet para el menú lateral
  useEffect(() => {
    if (menuHamburguesaAbierto) {
      const limpiar = gestorNavegacion.empujarPaso('menu-hamburguesa', () => {
        setMenuHamburguesaAbierto(false);
      });
      return limpiar;
    }
  }, [menuHamburguesaAbierto]);

  // Botón Atrás del celular/tablet para el modal de mesero
  useEffect(() => {
    if (modalMeseroAbierto) {
      const limpiar = gestorNavegacion.empujarPaso('modal-mesero', () => {
        setModalMeseroAbierto(false);
      });
      return limpiar;
    }
  }, [modalMeseroAbierto]);

  // Actualizar hora cada segundo
  useEffect(() => {
    const actualizar = (): void => {
      const ahora = new Date();
      setHoraActual(
        ahora.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, []);

  const handleIrAlInicio = (): void => {
    setMenuHamburguesaAbierto(false);
    setModalMeseroAbierto(false);
    setModalGuiaIosAbierto(false);
    setVistaActual('mesas');
    seleccionarMesa(null);
    gestorNavegacion.limpiarAInicio();
    if (onIrAlInicio) {
      onIrAlInicio();
    }
  };

  const alternarPantallaCompleta = async (): Promise<void> => {
    try {
      // En Safari iOS (iPhone), document.documentElement.requestFullscreen no está disponible
      const soporteFullscreen =
        'requestFullscreen' in document.documentElement ||
        'webkitRequestFullscreen' in document.documentElement;

      if (!soporteFullscreen) {
        setMenuHamburguesaAbierto(false);
        setModalGuiaIosAbierto(true);
        return;
      }

      const docConFullscreen = document as unknown as {
        fullscreenElement?: Element | null;
        webkitFullscreenElement?: Element | null;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
      };

      const elemConFullscreen = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
      };

      const estaActivo = !!(docConFullscreen.fullscreenElement || docConFullscreen.webkitFullscreenElement);

      if (!estaActivo) {
        if (elemConFullscreen.requestFullscreen) {
          await elemConFullscreen.requestFullscreen();
        } else if (elemConFullscreen.webkitRequestFullscreen) {
          await elemConFullscreen.webkitRequestFullscreen();
        }
        setEsPantallaCompleta(true);
      } else {
        if (docConFullscreen.exitFullscreen) {
          await docConFullscreen.exitFullscreen();
        } else if (docConFullscreen.webkitExitFullscreen) {
          await docConFullscreen.webkitExitFullscreen();
        }
        setEsPantallaCompleta(false);
      }
    } catch (error: unknown) {
      console.warn('[alternarPantallaCompleta] Modo pantalla completa no admitido:', error);
      setMenuHamburguesaAbierto(false);
      setModalGuiaIosAbierto(true);
    }
  };

  const guardarMesero = (e: React.FormEvent): void => {
    e.preventDefault();
    if (nuevoNombreMesero.trim()) {
      setMeseroActual(nuevoNombreMesero.trim());
      setModalMeseroAbierto(false);
    }
  };

  const pedidosPendientesCount = pedidosCocina.filter(
    (p) => p.estado === 'pendiente' || p.estado === 'en_preparacion'
  ).length;

  const esClaro = tema === 'claro';

  return (
    <>
      <header
        style={{
          paddingTop: 'calc(0.4rem + var(--safe-top))',
          paddingLeft: 'calc(0.5rem + var(--safe-left))',
          paddingRight: 'calc(0.5rem + var(--safe-right))',
        }}
        className={`w-full max-w-full overflow-hidden border-b pb-1.5 sm:pb-2 flex items-center justify-between gap-1 sm:gap-2.5 sticky top-0 z-30 transition-colors relative ${
          esClaro
            ? 'bg-white border-stone-200 text-stone-900 shadow-xs'
            : 'bg-stone-900 border-stone-800 text-stone-100 shadow-md'
        }`}
      >
        {/* Cinta inferior continua de Oro Líquido o franja amarilla sólida si está apagado */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden pointer-events-none z-10 ${
            nivelOroLiquido !== 'apagado'
              ? 'cinta-oro-liquido-unificada'
              : 'bg-amber-500 shadow-[0_1px_8px_rgba(245,158,11,0.5)]'
          }`}
        />

        {/* Identidad de la Taquería (Clic para volver al Inicio) */}
        <button
          type="button"
          onClick={handleIrAlInicio}
          title="Ir al inicio de mesas"
          aria-label="Ir al inicio de mesas"
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group active:scale-95 transition-all text-left bg-transparent border-0 p-0.5 rounded-xl hover:bg-stone-500/10 focus:outline-hidden shrink-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl relative overflow-hidden flex items-center justify-center text-stone-950 shadow-inner shrink-0 group-hover:brightness-110 transition-all font-black border border-amber-400/80 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600">
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 pointer-events-none" />
            <Flame className="relative z-10 w-4 h-4 sm:w-5 sm:h-5 text-stone-950 stroke-[2.5] drop-shadow-xs" />
          </div>
          <div className="hidden sm:block min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span
                className={`font-black text-xs sm:text-base md:text-lg tracking-wider uppercase transition-colors whitespace-nowrap ${
                  esClaro
                    ? 'text-amber-600 group-hover:text-amber-700'
                    : 'text-amber-400 group-hover:text-amber-300'
                }`}
              >
                La Estación
              </span>
              <span className="inline-flex relative overflow-hidden items-center text-[9px] sm:text-[10px] md:text-xs px-2 py-0.5 rounded font-black uppercase tracking-wider border bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 border-amber-400/90 shadow-xs">
                <span className="relative z-10">Grill</span>
              </span>
            </div>
            <p className="text-[10px] text-stone-400 hidden lg:block group-hover:text-stone-300 transition-colors truncate">
              Control de Comandas y Cuentas de Mesas
            </p>
          </div>
        </button>

        {/* Conmutador Central de Módulos (Mesas vs Cocina KDS) */}
        <div
          className={`flex items-center p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border shrink-0 ${
            esClaro ? 'bg-stone-100 border-stone-300' : 'bg-stone-950 border-stone-800'
          }`}
        >
          {vistaActual === 'mesas' ? (
            <BotonOroLiquido
              onClick={() => {
                setVistaActual('mesas');
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm"
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Mesas</span>
            </BotonOroLiquido>
          ) : (
            <button
              type="button"
              onClick={() => {
                setVistaActual('mesas');
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${
                esClaro ? 'text-stone-600 hover:text-stone-900' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Mesas</span>
            </button>
          )}

          {vistaActual === 'cocina' ? (
            <BotonOroLiquido
              onClick={() => {
                seleccionarMesa(null);
                setVistaActual('cocina');
              }}
              className="relative flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm"
            >
              <ChefHat className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Cocina</span>
              {pedidosPendientesCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white font-black text-[9px] sm:text-[10px] animate-pulse shadow">
                  {pedidosPendientesCount}
                </span>
              )}
            </BotonOroLiquido>
          ) : (
            <button
              type="button"
              onClick={() => {
                seleccionarMesa(null);
                setVistaActual('cocina');
              }}
              className={`relative flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${
                esClaro ? 'text-stone-600 hover:text-stone-900' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Cocina</span>
              {pedidosPendientesCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white font-black text-[9px] sm:text-[10px] animate-pulse shadow">
                  {pedidosPendientesCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Acciones Derecha: Monitor de red y Botón Hamburguesa */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Monitor de sincronización clickeable */}
          <button
            type="button"
            onClick={onAbrirConfiguracionServidor}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-colors cursor-pointer active:scale-95 shrink-0 ${
              estaEnLinea
                ? esClaro
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/50 text-emerald-400'
                : 'bg-amber-950/90 hover:bg-amber-900 border-amber-500 text-amber-300'
            }`}
            title="Ver estado de conexión del restaurante"
          >
            {estaEnLinea ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-500 animate-pulse shrink-0" />
                <span className="font-black hidden xs:inline">En línea</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="font-black hidden xs:inline">Sin red</span>
              </>
            )}
          </button>

          {/* Botón Acceso Rápido Tutorial */}
          <button
            type="button"
            onClick={onAbrirManualFunciones}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black border transition-all cursor-pointer active:scale-95 shrink-0 ${
              esClaro
                ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900 shadow-2xs'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
            }`}
            title="Abrir Tutorial y Manual de Funciones"
            aria-label="Abrir Tutorial y Manual de Funciones"
          >
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>

          {/* Botón Menú Hamburguesa Principal */}
          <button
            type="button"
            onClick={() => setMenuHamburguesaAbierto(true)}
            className={`p-1.5 sm:p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 ${
              esClaro
                ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
                : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-100'
            }`}
            title="Abrir menú de opciones"
            aria-label="Abrir menú principal"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </button>
        </div>
      </header>

      {/* Drawer / Menú Hamburguesa Lateral */}
      {menuHamburguesaAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs cursor-pointer"
            onClick={() => setMenuHamburguesaAbierto(false)}
          />

          {/* Panel Lateral Deslizante */}
          <aside
            style={{
              paddingTop: 'calc(1rem + var(--safe-top))',
              paddingBottom: 'calc(1rem + var(--safe-bottom))',
            }}
            className={`relative w-80 max-w-[85vw] h-full shadow-2xl flex flex-col justify-between z-10 border-l transition-transform ${
              esClaro
                ? 'bg-white border-stone-200 text-stone-900'
                : 'bg-stone-900 border-stone-800 text-stone-100'
            }`}
          >
            {/* Cabecera y Opciones del Menú */}
            <div className="overflow-y-auto flex-1">
              {/* Título y botón cerrar */}
              <div className="flex items-center justify-between pb-4 border-b px-5 border-stone-700/40">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="font-black text-base uppercase tracking-wider text-amber-400">
                      LA ESTACIÓN GRILL
                    </h3>
                    <p className="text-[11px] text-stone-400">Menú del Sistema</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuHamburguesaAbierto(false)}
                  className={`p-2 rounded-xl transition-all active:scale-90 cursor-pointer ${
                    esClaro
                      ? 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                  }`}
                  title="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tarjeta de Mesero Activo */}
              <div
                className={`p-4 mx-4 mt-4 rounded-2xl border transition-colors ${
                  esClaro
                    ? 'bg-amber-50/80 border-amber-200/90 shadow-xs'
                    : 'bg-stone-950/40 border-stone-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        esClaro
                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-xs'
                          : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      }`}
                    >
                      <User className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <span
                        className={`text-[10px] uppercase font-black block tracking-wider ${
                          esClaro ? 'text-stone-500' : 'text-stone-400'
                        }`}
                      >
                        Mesero en turno:
                      </span>
                      <span
                        className={`font-black text-sm truncate max-w-[140px] block ${
                          esClaro ? 'text-amber-900' : 'text-amber-400'
                        }`}
                      >
                        {meseroActual}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNuevoNombreMesero(meseroActual);
                      setModalMeseroAbierto(true);
                      setMenuHamburguesaAbierto(false);
                    }}
                    className={`text-xs font-black px-2.5 py-1 rounded-lg border transition-all active:scale-95 cursor-pointer ${
                      esClaro
                        ? 'text-amber-900 border-amber-300 bg-amber-100 hover:bg-amber-200'
                        : 'text-amber-400 hover:text-amber-300 border-amber-500/30 hover:bg-amber-500/10'
                    }`}
                  >
                    Cambiar
                  </button>
                </div>
              </div>

              {/* Banner Destacado Tutorial Interactivo */}
              <div className="px-4 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    if (onIniciarTourTutorial) onIniciarTourTutorial();
                  }}
                  className="w-full p-3 rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer border bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-amber-500/35 hover:border-amber-400 text-amber-200 shadow-md shadow-amber-950/20 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-105 transition-transform">
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-sm text-white block">
                        Tutorial Interactivo
                      </span>
                      <span className={`text-[11px] block ${esClaro ? 'text-amber-900/80 font-medium' : 'text-amber-300/80'}`}>
                        Tour guiado de funciones
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-amber-500 text-stone-950 shadow-xs uppercase tracking-wider">
                    Iniciar
                  </span>
                </button>
              </div>

              {/* Opciones y Módulos Principales */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] uppercase font-black text-stone-500 tracking-wider">
                    Operaciones y Caja
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuHamburguesaAbierto(false);
                      if (onAbrirManualFunciones) onAbrirManualFunciones();
                    }}
                    className="text-[11px] text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    📖 Ver Manual
                  </button>
                </div>

                {/* Opción Historial de Pedidos */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    onAbrirHistorialPedidos();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-amber-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-extrabold text-sm block">Historial de Órdenes</span>
                    <span className="text-xs text-stone-400">Comandas enviadas y auditoría</span>
                  </div>
                </button>

                {/* Opción Corte de Caja */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    onAbrirCorteCaja();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-amber-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-extrabold text-sm block">Corte de Caja</span>
                    <span className="text-xs text-stone-400">Arqueo de turno y total cobrado</span>
                  </div>
                </button>

                {/* Opción Facturación CFDI 4.0 SAT */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    setModalFacturasAbierto(true);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-cyan-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm block">Facturación Electrónica</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
                        SAT
                      </span>
                    </div>
                    <span className="text-xs text-stone-400">Emisión, historial y consulta de tickets</span>
                  </div>
                </button>

                {/* Opción Conexión y Sincronización */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    onAbrirConfiguracionServidor();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-emerald-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-extrabold text-sm block">Conexión del Restaurante</span>
                    <span className="text-xs text-stone-400">Compartir pedidos en tiempo real y respaldo automático</span>
                  </div>
                </button>

                {/* Opción Actualización en Vivo OTA */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    setModalOtaAbierto(true);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-amber-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm block">Actualización del Sistema</span>
                    </div>
                    <span className="text-xs text-stone-400">Verificar novedades y mejoras de servicio</span>
                  </div>
                </button>

                <div className="pt-2">
                  <span className="text-[11px] uppercase font-black text-stone-500 px-2 tracking-wider">
                    Preferencias de Visualización
                  </span>
                </div>

                {/* Control de Nivel de Oro Líquido Fundido */}
                <div
                  className={`w-full p-3.5 rounded-2xl border space-y-2.5 transition-all ${
                    esClaro
                      ? 'bg-stone-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/70 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl relative overflow-hidden flex items-center justify-center text-stone-950 shadow-inner border border-amber-400/80 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 pointer-events-none" />
                        <Sparkles className="relative z-10 w-4 h-4 text-stone-950 stroke-[2.5]" />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-sm block">Oro Líquido Fundido</span>
                        <span className="text-[11px] text-stone-400">
                          Fluido reflectante en tiempo real
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Selector de Nivel */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {(
                      [
                        { id: 'intenso', label: 'Intenso', desc: '25%' },
                        { id: 'elegante', label: 'Elegante', desc: '14%' },
                        { id: 'sutil', label: 'Sutil', desc: '7%' },
                        { id: 'apagado', label: 'Apagado', desc: '0%' },
                      ] as const
                    ).map((opc) => {
                      const activo = nivelOroLiquido === opc.id;
                      return (
                        <button
                          key={opc.id}
                          type="button"
                          onClick={() => setNivelOroLiquido(opc.id)}
                          className={`py-1.5 px-1 rounded-xl text-center text-xs font-black transition-all active:scale-95 cursor-pointer border ${
                            activo
                              ? 'bg-amber-500 border-amber-400 text-stone-950 shadow-md shadow-amber-950/40'
                              : esClaro
                              ? 'bg-stone-200 border-stone-300 text-stone-600 hover:text-stone-900'
                              : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <span className="block text-[11px] leading-tight">{opc.label}</span>
                          <span className={`text-[9px] block ${activo ? 'text-stone-900' : 'text-stone-500'}`}>
                            {opc.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Previsualización en Vivo Reactiva */}
                  <div
                    className={`h-9 w-full rounded-xl relative overflow-hidden border transition-all duration-300 shadow-inner ${
                      nivelOroLiquido === 'apagado'
                        ? esClaro
                          ? 'border-stone-300 bg-stone-100'
                          : 'border-stone-800 bg-stone-900/90'
                        : 'border-amber-400/80 shadow-amber-950/40'
                    }`}
                  >
                    {nivelOroLiquido !== 'apagado' ? (
                      <>
                        <LienzoOroLiquido
                          key={nivelOroLiquido}
                          velocidad={
                            nivelOroLiquido === 'intenso'
                              ? 1.25
                              : nivelOroLiquido === 'elegante'
                              ? 0.9
                              : 0.55
                          }
                          brillo={
                            nivelOroLiquido === 'intenso'
                              ? 1.6
                              : nivelOroLiquido === 'elegante'
                              ? 1.25
                              : 0.9
                          }
                          densidadOndas={
                            nivelOroLiquido === 'intenso'
                              ? 1.35
                              : nivelOroLiquido === 'elegante'
                              ? 1.05
                              : 0.8
                          }
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/35 via-transparent to-stone-950/35 pointer-events-none" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-stone-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.65)] pointer-events-none">
                          {nivelOroLiquido === 'intenso'
                            ? 'Oro Líquido: Intenso (25%)'
                            : nivelOroLiquido === 'elegante'
                            ? 'Oro Líquido: Elegante (14%)'
                            : 'Oro Líquido: Sutil (7%)'}
                        </span>
                      </>
                    ) : (
                      <span
                        className={`absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-widest uppercase pointer-events-none ${
                          esClaro ? 'text-stone-600' : 'text-stone-500'
                        }`}
                      >
                        Oro Líquido: Apagado (0%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Conmutador Tema Claro / Oscuro */}
                <button
                  type="button"
                  onClick={() => {
                    alternarTema();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                      {esClaro ? <Moon className="w-5 h-5 text-indigo-600" /> : <Sun className="w-5 h-5 text-amber-400" />}
                    </div>
                    <div className="text-left">
                      <span className="font-extrabold text-sm block">Tema Visual</span>
                      <span className="text-xs text-stone-400">
                        {esClaro ? 'Modo Claro activo' : 'Modo Oscuro activo'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950">
                    {esClaro ? '☀️ Claro' : '🌙 Oscuro'}
                  </span>
                </button>

                {/* Pantalla Completa */}
                <button
                  type="button"
                  onClick={() => {
                    alternarPantallaCompleta();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      {esPantallaCompleta ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                      <span className="font-extrabold text-sm block">Pantalla Completa</span>
                      <span className="text-xs text-stone-400">
                        {esPantallaCompleta ? 'Salir de pantalla completa' : 'Maximizar vista'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Opción Guía iPhone y iPad */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    setModalGuiaIosAbierto(true);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-stone-50 hover:bg-amber-50 border-stone-200 text-stone-800'
                      : 'bg-stone-950/60 hover:bg-stone-800 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="font-extrabold text-sm block">Instalar en iPhone / iPad</span>
                      <span className="text-xs text-stone-400">
                        Añadir a pantalla de inicio
                      </span>
                    </div>
                  </div>
                </button>

                {/* Opción Bloquear Terminal por Seguridad */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuHamburguesaAbierto(false);
                    servicioSeguridadPin.bloquearTerminal();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer border ${
                    esClaro
                      ? 'bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-900'
                      : 'bg-rose-950/20 hover:bg-rose-950/40 border-rose-900/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="font-extrabold text-sm block">Bloquear Terminal</span>
                      <span className={`text-xs ${esClaro ? 'text-rose-700/80' : 'text-stone-400'}`}>
                        Requerir PIN para ingresar
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    PIN
                  </span>
                </button>
              </div>
            </div>

            {/* Pie del Menú con Estado y Reloj */}
            <div
              className={`p-4 mx-4 mb-2 rounded-2xl border space-y-2 transition-colors ${
                esClaro
                  ? 'bg-stone-100/90 border-stone-200 text-stone-800 shadow-2xs'
                  : 'bg-stone-950/50 border-stone-800 text-stone-400'
              }`}
            >
              <div
                className={`flex items-center justify-between text-xs font-semibold ${
                  esClaro ? 'text-stone-700' : 'text-stone-300'
                }`}
              >
                <span className="flex items-center gap-1.5 font-mono">
                  <Clock className={`w-3.5 h-3.5 ${esClaro ? 'text-amber-600' : 'text-amber-400'}`} />
                  {horaActual}
                </span>
                <span className={`text-[11px] font-bold ${esClaro ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {estaEnLinea ? '● Sincronizado' : '○ Sin conexión'}
                </span>
              </div>
              <div
                className={`pt-2 border-t text-[10px] flex justify-between items-center ${
                  esClaro ? 'border-stone-200 text-stone-600' : 'border-stone-800 text-stone-500'
                }`}
              >
                <span className="font-semibold">La Estación Grill</span>
                <span>{dispositivosConectados} dispositivo(s)</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Modal para cambiar mesero */}
      {modalMeseroAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-stone-100">
            <h3 className="text-lg font-bold text-amber-400 mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              Asignar Mesero en Turno
            </h3>
            <p className="text-xs text-stone-400 mb-4">
              Las comandas y cobros se registrarán bajo este nombre.
            </p>
            <form onSubmit={guardarMesero} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Nombre del Mesero / Capitán
                </label>
                <input
                  type="text"
                  value={nuevoNombreMesero}
                  onChange={(e) => setNuevoNombreMesero(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 focus:outline-hidden focus:border-amber-500 text-base"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalMeseroAbierto(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-black shadow-md shadow-amber-950/40 cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal interactivo de instalación en iPhone y iPad */}
      <GuiaInstalacionIosModal
        abierto={modalGuiaIosAbierto}
        alCerrar={() => setModalGuiaIosAbierto(false)}
      />

      {/* Modal de Historial y Consulta de Facturas CFDI 4.0 */}
      {modalFacturasAbierto && (
        <ModalHistorialFacturas onClose={() => setModalFacturasAbierto(false)} />
      )}

      {/* Modal de Actualizaciones en Caliente OTA */}
      <ModalActualizacionOta
        abierto={modalOtaAbierto}
        alCerrar={() => setModalOtaAbierto(false)}
      />
    </>
  );
};
