import React, { useState, useEffect, useCallback } from 'react';
import { RestauranteProvider, useRestaurante } from './context/RestauranteContext';
import { NavbarSuperior } from './components/NavbarSuperior';
import { DashboardMesas } from './components/DashboardMesas';
import { Comandero } from './components/Comandero';
import { DetalleCuenta } from './components/DetalleCuenta';
import { gestorNavegacion } from './utils/navegacionDispositivo';

const ModalTicket = React.lazy(() =>
  import('./components/ModalTicket').then((m) => ({ default: m.ModalTicket }))
);
const PantallaCocina = React.lazy(() =>
  import('./components/PantallaCocina').then((m) => ({ default: m.PantallaCocina }))
);
const ModalCobro = React.lazy(() =>
  import('./components/ModalCobro').then((m) => ({ default: m.ModalCobro }))
);
const CorteCajaModal = React.lazy(() =>
  import('./components/CorteCajaModal').then((m) => ({ default: m.CorteCajaModal }))
);
const HistorialPedidosModal = React.lazy(() =>
  import('./components/HistorialPedidosModal').then((m) => ({ default: m.HistorialPedidosModal }))
);
const ModalConfiguracionServidor = React.lazy(() =>
  import('./components/ModalConfiguracionServidor').then((m) => ({ default: m.ModalConfiguracionServidor }))
);

import { Utensils, Receipt } from 'lucide-react';
import { formatearMoneda } from './utils/formateadores';
import { LienzoOroLiquido } from './components/LienzoOroLiquido';
import { servicioActualizaciones } from './services/servicioActualizaciones';
import { servicioLicencia, type EstadoLicencia } from './services/servicioLicencia';
import { PantallaBloqueoLicencia } from './components/PantallaBloqueoLicencia';
import { servicioSeguridadPin, type EstadoSeguridadPin } from './services/servicioSeguridadPin';
import { PantallaBloqueoPin } from './components/PantallaBloqueoPin';
import { TourGuiadoFlotante } from './components/TourGuiadoFlotante';
import { ModalManualFunciones } from './components/ModalManualFunciones';

const PantallaPrincipal: React.FC = () => {
  const {
    mesaSeleccionada,
    seleccionarMesa,
    vistaActual,
    setVistaActual,
    tema,
    cuentaActiva,
    estaEnLinea,
    dispositivosConectados,
    ticketImpresion,
    cerrarTicketImpresion,
    nivelOroLiquido,
    parametrosOro,
  } = useRestaurante();
  const [modalCobroAbierto, setModalCobroAbierto] = useState<boolean>(false);
  const [modalCorteAbierto, setModalCorteAbierto] = useState<boolean>(false);
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState<boolean>(false);
  const [modalServidorAbierto, setModalServidorAbierto] = useState<boolean>(false);
  const [tourTutorialAbierto, setTourTutorialAbierto] = useState<boolean>(false);
  const [manualFuncionesAbierto, setManualFuncionesAbierto] = useState<boolean>(false);
  const [pestanaMovil, setPestanaMovil] = useState<'menu' | 'cuenta'>('menu');

  // Navegación con botones del celular/tablet para modales
  useEffect(() => {
    if (modalCobroAbierto) {
      return gestorNavegacion.empujarPaso('modal-cobro', () => setModalCobroAbierto(false));
    }
  }, [modalCobroAbierto]);

  useEffect(() => {
    if (modalCorteAbierto) {
      return gestorNavegacion.empujarPaso('modal-corte', () => setModalCorteAbierto(false));
    }
  }, [modalCorteAbierto]);

  useEffect(() => {
    if (modalHistorialAbierto) {
      return gestorNavegacion.empujarPaso('modal-historial', () => setModalHistorialAbierto(false));
    }
  }, [modalHistorialAbierto]);

  useEffect(() => {
    if (modalServidorAbierto) {
      return gestorNavegacion.empujarPaso('modal-servidor', () => setModalServidorAbierto(false));
    }
  }, [modalServidorAbierto]);

  useEffect(() => {
    if (ticketImpresion) {
      return gestorNavegacion.empujarPaso('modal-ticket', () => cerrarTicketImpresion());
    }
  }, [ticketImpresion, cerrarTicketImpresion]);

  // Navegación con botones del celular/tablet entre comanda y dashboard
  useEffect(() => {
    if (mesaSeleccionada?.id) {
      return gestorNavegacion.empujarPaso('mesa-activa', () => {
        seleccionarMesa(null);
        setPestanaMovil('menu');
      });
    }
  }, [mesaSeleccionada?.id, seleccionarMesa]);

  // Ocultar pantalla de carga inicial y comprobar actualizaciones en segundo plano
  useEffect(() => {
    const timer = setTimeout(() => {
      const ocultar = (window as unknown as { __ocultarPantallaCarga?: () => void }).__ocultarPantallaCarga;
      if (typeof ocultar === 'function') {
        ocultar();
      }
      // Actualización automática transparente en segundo plano (sin modales ni botones)
      servicioActualizaciones.verificarYActualizarSilencioso();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // Navegación con botones del celular/tablet entre cocina y mesas
  useEffect(() => {
    if (vistaActual === 'cocina') {
      return gestorNavegacion.empujarPaso('vista-cocina', () => {
        setVistaActual('mesas');
      });
    }
  }, [vistaActual, setVistaActual]);

  // Navegación móvil entre pestañas de Menú y Cuenta
  useEffect(() => {
    if (pestanaMovil === 'cuenta' && mesaSeleccionada?.id) {
      return gestorNavegacion.empujarPaso('pestana-cuenta-movil', () => {
        setPestanaMovil('menu');
      });
    }
  }, [pestanaMovil, mesaSeleccionada?.id]);

  const esClaro = tema === 'claro';
  const totalArticulos = cuentaActiva?.items.reduce((acc, it) => acc + it.cantidad, 0) ?? 0;
  const totalCuenta = cuentaActiva?.total ?? 0;

  const handleAbrirCobro = (): void => {
    setModalCobroAbierto(true);
  };

  const handleCerrarCobro = (): void => {
    setModalCobroAbierto(false);
  };

  const handleCobroExitoso = (): void => {
    setModalCobroAbierto(false);
    seleccionarMesa(null);
    setPestanaMovil('menu');
    gestorNavegacion.limpiarAInicio();
  };

  const handleIrAlInicioCompleto = (): void => {
    setModalCobroAbierto(false);
    setModalCorteAbierto(false);
    setModalHistorialAbierto(false);
    setModalServidorAbierto(false);
    setPestanaMovil('menu');
  };

  const handleCerrarTour = useCallback((): void => {
    setTourTutorialAbierto(false);
  }, []);

  const handleIniciarTour = useCallback((): void => {
    setTourTutorialAbierto(true);
  }, []);

  return (
    <div
      style={{
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
      className={`h-[100dvh] max-h-[100dvh] w-full flex flex-col font-sans select-none antialiased overflow-hidden ${
        esClaro ? 'bg-stone-100 text-stone-900' : 'bg-stone-950 text-stone-100'
      }`}
    >
      {/* Barra de navegación superior fija */}
      <NavbarSuperior
        onAbrirCorteCaja={() => setModalCorteAbierto(true)}
        onAbrirHistorialPedidos={() => setModalHistorialAbierto(true)}
        onAbrirConfiguracionServidor={() => setModalServidorAbierto(true)}
        onIrAlInicio={handleIrAlInicioCompleto}
        onIniciarTourTutorial={() => setTourTutorialAbierto(true)}
        onAbrirManualFunciones={() => setManualFuncionesAbierto(true)}
      />

      {/* Área de trabajo dinámica: Mesas, Comandero o Pantalla de Cocina (KDS) */}
      <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden relative">
        {/* Capa de Fondo de Oro Líquido Derretido Continuo */}
        {nivelOroLiquido !== 'apagado' && (
          <div
            style={{ opacity: parametrosOro.opacidadFondoAmbiental }}
            className="absolute inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-700"
          >
            <LienzoOroLiquido
              key={nivelOroLiquido}
              velocidad={parametrosOro.velocidad * 0.55}
              brillo={parametrosOro.brillo}
              densidadOndas={parametrosOro.densidadOndas}
            />
          </div>
        )}

        <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col overflow-hidden">
          {vistaActual === 'cocina' ? (
            <React.Suspense fallback={null}>
              <PantallaCocina />
            </React.Suspense>
          ) : !mesaSeleccionada ? (
            <DashboardMesas />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden">
              {/* Panel de Catálogo de Menú y Categorías */}
              <div
                className={`flex-1 min-h-0 flex-col overflow-hidden ${
                  pestanaMovil === 'menu' ? 'flex' : 'hidden'
                } lg:flex`}
              >
                <Comandero onVerCuentaMovil={() => setPestanaMovil('cuenta')} />
              </div>

              {/* Panel Lateral de Comanda y Cuenta Activa */}
              <div
                className={`w-full lg:w-[390px] xl:w-[440px] flex-col overflow-hidden ${
                  pestanaMovil === 'cuenta' ? 'flex flex-1 min-h-0' : 'hidden'
                } lg:flex`}
              >
                <DetalleCuenta
                  onAbrirCobro={handleAbrirCobro}
                  onVolverMenuMovil={() => setPestanaMovil('menu')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Barra de alternancia rápida para celulares y tablets verticales cuando hay una mesa abierta */}
        {mesaSeleccionada && vistaActual !== 'cocina' && (
          <div
            style={{
              paddingBottom: 'calc(0.5rem + var(--safe-bottom))',
            }}
            className={`lg:hidden shrink-0 border-t flex items-center justify-around px-3 py-2 z-20 shadow-lg ${
              esClaro
                ? 'bg-stone-200 border-stone-300'
                : 'bg-stone-900 border-stone-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setPestanaMovil('menu')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
                pestanaMovil === 'menu'
                  ? 'bg-amber-500 text-stone-950 font-black shadow-md shadow-amber-950/40'
                  : esClaro
                  ? 'text-stone-600 hover:text-stone-900'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>1. Menú Grill</span>
            </button>

            <button
              type="button"
              onClick={() => setPestanaMovil('cuenta')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ml-2 ${
                pestanaMovil === 'cuenta'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : esClaro
                  ? 'text-stone-600 hover:text-stone-900'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>
                2. Cuenta ({totalArticulos}) · {formatearMoneda(totalCuenta)}
              </span>
            </button>
          </div>
        )}
      </main>

      {/* Modales del Sistema Cargados de Forma Perezosa */}
      <React.Suspense fallback={null}>
        {modalCobroAbierto && (
          <ModalCobro onCerrar={handleCerrarCobro} onCobroExitoso={handleCobroExitoso} />
        )}

        {modalCorteAbierto && (
          <CorteCajaModal onCerrar={() => setModalCorteAbierto(false)} />
        )}

        {modalHistorialAbierto && (
          <HistorialPedidosModal onCerrar={() => setModalHistorialAbierto(false)} />
        )}

        {modalServidorAbierto && (
          <ModalConfiguracionServidor
            abierto={modalServidorAbierto}
            alCerrar={() => setModalServidorAbierto(false)}
            estaConectado={estaEnLinea}
            totalDispositivos={dispositivosConectados}
          />
        )}

        <ModalTicket />

        <TourGuiadoFlotante
          activo={tourTutorialAbierto}
          alCerrar={handleCerrarTour}
          onCambiarVista={setVistaActual}
          vistaActual={vistaActual}
        />

        <ModalManualFunciones
          abierto={manualFuncionesAbierto}
          alCerrar={() => setManualFuncionesAbierto(false)}
          onIniciarTourGuiado={handleIniciarTour}
        />
      </React.Suspense>
    </div>
  );
};

interface PropsGuardianLicencia {
  children: React.ReactNode;
}

const GuardianLicencia: React.FC<PropsGuardianLicencia> = ({ children }) => {
  const [estadoLicencia, setEstadoLicencia] = useState<EstadoLicencia>(() =>
    servicioLicencia.obtenerEstado()
  );

  useEffect(() => {
    return servicioLicencia.suscribir((nuevoEstado) => {
      setEstadoLicencia(nuevoEstado);
    });
  }, []);

  if (!estadoLicencia.activa) {
    return <PantallaBloqueoLicencia estado={estadoLicencia} />;
  }

  return <>{children}</>;
};

interface PropsGuardianSeguridadPin {
  children: React.ReactNode;
}

const GuardianSeguridadPin: React.FC<PropsGuardianSeguridadPin> = ({ children }) => {
  const [estadoPin, setEstadoPin] = useState<EstadoSeguridadPin>(() =>
    servicioSeguridadPin.obtenerEstado()
  );

  useEffect(() => {
    return servicioSeguridadPin.suscribir((nuevoEstado) => {
      setEstadoPin(nuevoEstado);
    });
  }, []);

  if (!estadoPin.estaDesbloqueado) {
    return <PantallaBloqueoPin />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <GuardianLicencia>
      <GuardianSeguridadPin>
        <RestauranteProvider>
          <PantallaPrincipal />
        </RestauranteProvider>
      </GuardianSeguridadPin>
    </GuardianLicencia>
  );
};

export default App;
