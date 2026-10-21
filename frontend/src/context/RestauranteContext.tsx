import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Mesa,
  Cuenta,
  ItemComanda,
  Producto,
  EstadoMesa,
  MetodoPago,
  CorteCaja,
  TurnoCerrado,
  PedidoCocina,
  EstadoPedidoCocina,
  VistaPrincipal,
  MensajeSincronizacion,
  DesglosePagoMixto,
  DivisionCuentaInfo,
  TemaVisual,
  FormularioProductoDTO,
} from '../types';
import { RepositorioStorage } from '../services/repositorioStorage';
import { servicioSincronizacion } from '../services/servicioSincronizacion';
import { servicioSupabase } from '../services/servicioSupabase';
import { servicioTelemetria } from '../services/servicioTelemetria';
import { reproducirCampanaCocina, reproducirTimbrePedidoListo } from '../utils/sonidoCocina';
import { deduplicarYSanearMesas } from '../utils/saneadorMesas';
import { esRelevanteParaMesero } from '../utils/filtroMesero';

export interface NotificacionCocinaMesero {
  readonly id: string;
  readonly pedidoId: string;
  readonly mesaId: string;
  readonly nombreMesa: string;
  readonly mesero?: string;
  readonly esMiMesa?: boolean;
  readonly estado: 'en_preparacion' | 'listo';
  readonly mensaje: string;
  readonly resumenItems: string;
  readonly timestamp: number;
}

export type NivelOroLiquido = 'intenso' | 'elegante' | 'sutil' | 'apagado';

export interface ParametrosOroLiquido {
  readonly velocidad: number;
  readonly brillo: number;
  readonly densidadOndas: number;
  readonly duracionSegundosCss: number;
  readonly opacidadFondoAmbiental: number;
}

export const PARAMETROS_NIVEL_ORO: Record<NivelOroLiquido, ParametrosOroLiquido> = {
  intenso: {
    velocidad: 1.35,
    brillo: 1.6,
    densidadOndas: 1.35,
    duracionSegundosCss: 3.5,
    opacidadFondoAmbiental: 0.7,
  },
  elegante: {
    velocidad: 0.9,
    brillo: 1.25,
    densidadOndas: 1.05,
    duracionSegundosCss: 5.0,
    opacidadFondoAmbiental: 0.45,
  },
  sutil: {
    velocidad: 0.5,
    brillo: 0.9,
    densidadOndas: 0.8,
    duracionSegundosCss: 7.5,
    opacidadFondoAmbiental: 0.2,
  },
  apagado: {
    velocidad: 0,
    brillo: 0,
    densidadOndas: 0,
    duracionSegundosCss: 0,
    opacidadFondoAmbiental: 0,
  },
};

/**
 * Determina si un producto o ítem debe enviarse a cocina (KDS).
 * Las bebidas NO se envían a cocina porque las lleva directamente el mesero,
 * a menos que sea una bebida que requiera preparación (requierePreparacion === true).
 */
export const esItemParaCocina = (
  item: Pick<ItemComanda, 'categoria' | 'requierePreparacion'>
): boolean => {
  if (item.categoria === 'bebidas') {
    return item.requierePreparacion === true;
  }
  return item.requierePreparacion !== false;
};

interface RestauranteContextType {
  mesas: Mesa[];
  mesaSeleccionada: Mesa | null;
  cuentaActiva: Cuenta | null;
  corteActual: CorteCaja;
  cuentasCerradas: Cuenta[];
  historialTurnos: TurnoCerrado[];
  pedidosCocina: PedidoCocina[];
  productos: Producto[];
  vistaActual: VistaPrincipal;
  estaEnLinea: boolean;
  dispositivosConectados: number;
  ticketImpresion: { cuenta: Cuenta; tipo: 'cocina' | 'cliente' } | null;
  meseroActual: string;
  tema: TemaVisual;
  nivelOroLiquido: NivelOroLiquido;
  parametrosOro: ParametrosOroLiquido;
  setNivelOroLiquido: (nivel: NivelOroLiquido) => void;
  alternarTema: () => void;
  setVistaActual: (vista: VistaPrincipal) => void;
  setMeseroActual: (nombre: string) => void;
  seleccionarMesa: (mesa: Mesa | null) => void;
  abrirMesa: (mesaId: string, mesero?: string) => void;
  cambiarEstadoMesa: (mesaId: string, nuevoEstado: EstadoMesa) => void;
  agregarProductoAComanda: (
    mesaId: string,
    producto: Producto,
    cantidad: number,
    notas: string,
    modificadores: string[]
  ) => void;
  agregarProducto: (datos: FormularioProductoDTO) => Promise<Producto>;
  editarProducto: (id: string, datos: FormularioProductoDTO) => Promise<void>;
  eliminarProducto: (id: string) => Promise<void>;
  restablecerProductos: () => void;
  modificarCantidadItem: (mesaId: string, itemId: string, delta: number) => void;
  eliminarItemComanda: (mesaId: string, itemId: string) => void;
  solicitarCuenta: (mesaId: string) => void;
  cerrarYCobrarCuenta: (
    mesaId: string,
    metodoPago: MetodoPago,
    propina: number,
    montoRecibido?: number,
    desgloseMixto?: DesglosePagoMixto,
    divisionCuenta?: DivisionCuentaInfo
  ) => { exito: boolean; cambio: number; cuentaCerrada?: Cuenta };
  liberarMesaManual: (mesaId: string) => void;
  cambiarNombreMesa: (mesaId: string, nuevoNombre: string) => { exito: boolean; mensaje: string };
  moverMesa: (mesaOrigenId: string, mesaDestinoId: string) => { exito: boolean; mensaje: string };
  agregarMesa: (capacidad?: number) => Mesa;
  eliminarMesa: (mesaId?: string) => { exito: boolean; mensaje: string };
  agregarDomicilio: () => Mesa;
  eliminarDomicilio: (mesaId?: string) => { exito: boolean; mensaje: string };
  imprimirTicket: (tipo: 'cocina' | 'cliente', cuentaEspecifica?: Cuenta) => void;
  cerrarTicketImpresion: () => void;
  reiniciarTurnoActual: (pin: string) => boolean;
  cargarHistorialTurnos: () => Promise<void>;
  enviarComandaACocina: (
    mesaId: string,
    forzarReenvioCompleto?: boolean
  ) => { enviadosCount: number; exito: boolean; mensaje: string };
  cambiarEstadoPedidoCocina: (pedidoId: string, nuevoEstado: EstadoPedidoCocina) => void;
  alternarItemCompletadoCocina: (pedidoId: string, itemId: string) => void;
  pasoTutorialDemo: number;
  setPasoTutorialDemo: (paso: number) => void;
  notificacionesCocina: NotificacionCocinaMesero[];
  descartarNotificacionCocina: (id: string) => void;
}

const MESA_DEMO_TUTORIAL_ID = 'mesa-demo-tutorial';
const CUENTA_DEMO_TUTORIAL_ID = 'cuenta-demo-tutorial';
const PEDIDO_COCINA_DEMO_ID = 'pedido-cocina-demo-tutorial';

const crearCuentaDemoInicial = (mesero: string): Cuenta => ({
  id: CUENTA_DEMO_TUTORIAL_ID,
  mesaId: MESA_DEMO_TUTORIAL_ID,
  numeroMesa: 4,
  nombreMesa: 'Mesa 4 · Salón (Ejemplo)',
  items: [
    {
      id: 'item-demo-tut-1',
      productoId: 'taco-trompo',
      nombre: 'Orden Tacos de Trompo (5 pzas)',
      precioUnitario: 95,
      categoria: 'tacos',
      requierePreparacion: true,
      cantidad: 2,
      cantidadEnviadaCocina: 2,
      notas: 'Bien dorados',
      modificadoresSeleccionados: ['Con todo', 'Con piña'],
      fechaAgregado: new Date().toISOString(),
    },
    {
      id: 'item-demo-tut-2',
      productoId: 'gringa-trompo',
      nombre: 'Gringa de Trompo',
      precioUnitario: 65,
      categoria: 'tacos',
      requierePreparacion: true,
      cantidad: 2,
      cantidadEnviadaCocina: 0,
      notas: '',
      modificadoresSeleccionados: ['Con todo', 'Queso extra'],
      fechaAgregado: new Date().toISOString(),
    },
    {
      id: 'item-demo-tut-3',
      productoId: 'coca-600',
      nombre: 'Coca-Cola 600ml',
      precioUnitario: 40,
      categoria: 'bebidas',
      requierePreparacion: false,
      cantidad: 2,
      cantidadEnviadaCocina: 2,
      notas: 'Bien frías',
      modificadoresSeleccionados: [],
      fechaAgregado: new Date().toISOString(),
    },
  ],
  subtotal: 400,
  descuento: 0,
  propina: 0,
  total: 400,
  estado: 'abierta',
  horaApertura: new Date(Date.now() - 12 * 60000).toISOString(),
  horaCierre: null,
  mesero,
});

const crearPedidoCocinaDemoInicial = (mesero: string): PedidoCocina => ({
  id: PEDIDO_COCINA_DEMO_ID,
  comandaId: CUENTA_DEMO_TUTORIAL_ID,
  mesaId: MESA_DEMO_TUTORIAL_ID,
  nombreMesa: 'Mesa 4 · Salón (Ejemplo)',
  mesero,
  horaEnvio: new Date(Date.now() - 4 * 60000).toISOString(),
  estado: 'en_preparacion',
  numeroRonda: 1,
  items: [
    {
      id: 'kds-demo-item-1',
      nombre: 'Orden Tacos de Trompo (5 pzas)',
      cantidad: 2,
      notas: 'Bien dorados',
      modificadores: ['Con todo', 'Con piña'],
      completado: true,
    },
    {
      id: 'kds-demo-item-2',
      nombre: 'Gringa de Trompo',
      cantidad: 2,
      notas: '',
      modificadores: ['Con todo', 'Queso extra'],
      completado: false,
    },
  ],
});

const RestauranteContext = createContext<RestauranteContextType | undefined>(undefined);

export const RestauranteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mesas, setMesas] = useState<Mesa[]>(() => RepositorioStorage.obtenerMesas());
  const [cuentasActivas, setCuentasActivas] = useState<Record<string, Cuenta>>(() =>
    RepositorioStorage.obtenerCuentasActivas()
  );
  const [cuentasCerradas, setCuentasCerradas] = useState<Cuenta[]>(() =>
    RepositorioStorage.obtenerCuentasCerradas()
  );
  const [corteActual, setCorteActual] = useState<CorteCaja>(() =>
    RepositorioStorage.obtenerCorteActual()
  );
  const [historialTurnos, setHistorialTurnos] = useState<TurnoCerrado[]>(() =>
    RepositorioStorage.obtenerHistorialTurnos()
  );
  const [pedidosCocina, setPedidosCocina] = useState<PedidoCocina[]>(() =>
    RepositorioStorage.obtenerPedidosCocina()
  );
  const [productos, setProductos] = useState<Producto[]>(() =>
    RepositorioStorage.obtenerProductos()
  );
  const [vistaActual, setVistaActual] = useState<VistaPrincipal>('mesas');
  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState<string | null>(null);
  const [estaEnLinea, setEstaEnLinea] = useState<boolean>(() => servicioSupabase.estaConectado());
  const [dispositivosConectados, setDispositivosConectados] = useState<number>(() =>
    servicioSincronizacion.totalDispositivos()
  );
  const [ticketImpresion, setTicketImpresion] = useState<{
    cuenta: Cuenta;
    tipo: 'cocina' | 'cliente';
  } | null>(null);
  const [meseroActual, setMeseroActual] = useState<string>('Beto (Mesero)');
  const [tema, setTema] = useState<TemaVisual>(() => RepositorioStorage.obtenerTema());

  // Estados en memoria para el Sandbox interactivo del tutorial (no afectan mesas ni cuentas reales)
  const [pasoTutorialDemo, setPasoTutorialDemoEstado] = useState<number>(0);
  const [cuentaDemoTutorial, setCuentaDemoTutorial] = useState<Cuenta>(() =>
    crearCuentaDemoInicial('Beto (Mesero)')
  );
  const [pedidoCocinaDemo, setPedidoCocinaDemo] = useState<PedidoCocina>(() =>
    crearPedidoCocinaDemoInicial('Beto (Mesero)')
  );

  const setPasoTutorialDemo = useCallback(
    (paso: number): void => {
      setPasoTutorialDemoEstado(paso);
      if (paso === 1) {
        // Reiniciar datos de ejemplo al iniciar el recorrido
        setCuentaDemoTutorial(crearCuentaDemoInicial(meseroActual));
        setPedidoCocinaDemo(crearPedidoCocinaDemoInicial(meseroActual));
      }
    },
    [meseroActual]
  );

  // Control de modificaciones recientes en cocina para evitar que ecos de Realtime o el latido
  // reviertan clics rápidos del cocinero (protección de condiciones de carrera)
  const ultimasModificacionesCocinaRef = useRef<Map<string, number>>(new Map());
  const timersGuardadoCocinaRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Notificaciones en tiempo real para meseros cuando cocina prepara o termina pedidos
  const [notificacionesCocina, setNotificacionesCocina] = useState<NotificacionCocinaMesero[]>([]);
  const estadosPreviosCocinaRef = useRef<Map<string, EstadoPedidoCocina> | null>(null);

  const descartarNotificacionCocina = useCallback((id: string): void => {
    setNotificacionesCocina((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    // En el primer render tras montar, registramos los estados actuales sin disparar alertas pasadas
    if (estadosPreviosCocinaRef.current === null) {
      const mapaInicial = new Map<string, EstadoPedidoCocina>();
      for (const p of pedidosCocina) {
        mapaInicial.set(p.id, p.estado);
      }
      estadosPreviosCocinaRef.current = mapaInicial;
      return;
    }

    const mapaPrevio = estadosPreviosCocinaRef.current;
    const nuevasAlertas: NotificacionCocinaMesero[] = [];
    const idsPedidosEntregados = new Set<string>();
    let sonarTimbreListo = false;

    for (const p of pedidosCocina) {
      const estadoAnterior = mapaPrevio.get(p.id);
      if (estadoAnterior !== p.estado) {
        mapaPrevio.set(p.id, p.estado);

        // Si el pedido ya estaba registrado y cambió a 'en_preparacion' o 'listo'
        if (estadoAnterior !== undefined) {
          const resumen = p.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ');
          const esRelevante = esRelevanteParaMesero(p.mesero, meseroActual);

          if (p.estado === 'en_preparacion' && estadoAnterior === 'pendiente') {
            nuevasAlertas.push({
              id: `notif-prep-${p.id}-${Date.now()}`,
              pedidoId: p.id,
              mesaId: p.mesaId,
              nombreMesa: p.nombreMesa,
              mesero: p.mesero,
              esMiMesa: esRelevante,
              estado: 'en_preparacion',
              mensaje: `Cocina está preparando el pedido de ${p.nombreMesa}`,
              resumenItems: resumen,
              timestamp: Date.now(),
            });
          } else if (p.estado === 'listo' && estadoAnterior !== 'listo') {
            // Sólo hacemos sonar la campanilla si el pedido es del mesero logueado (o si es perfil global)
            if (esRelevante) {
              sonarTimbreListo = true;
            }
            nuevasAlertas.push({
              id: `notif-listo-${p.id}-${Date.now()}`,
              pedidoId: p.id,
              mesaId: p.mesaId,
              nombreMesa: p.nombreMesa,
              mesero: p.mesero,
              esMiMesa: esRelevante,
              estado: 'listo',
              mensaje: `¡Pedido LISTO en cocina para ${p.nombreMesa}!`,
              resumenItems: resumen,
              timestamp: Date.now(),
            });
          } else if (p.estado === 'entregado') {
            idsPedidosEntregados.add(p.id);
          }
        }
      }
    }

    if (sonarTimbreListo) {
      reproducirTimbrePedidoListo();
    }

    if (nuevasAlertas.length > 0 || idsPedidosEntregados.size > 0) {
      setNotificacionesCocina((prev) => {
        const idsActualizados = new Set(nuevasAlertas.map((a) => a.pedidoId));
        const filtradas = prev.filter(
          (n) => !idsPedidosEntregados.has(n.pedidoId) && !idsActualizados.has(n.pedidoId)
        );
        return [...nuevasAlertas, ...filtradas].slice(0, 5);
      });
    }
  }, [pedidosCocina, meseroActual]);

  // Auto-descartar notificaciones informativas de "en_preparacion" después de 8 segundos
  useEffect(() => {
    const tieneEnPreparacion = notificacionesCocina.some((n) => n.estado === 'en_preparacion');
    if (!tieneEnPreparacion) return;

    const timer = setTimeout(() => {
      const limite = Date.now() - 7500;
      setNotificacionesCocina((prev) =>
        prev.filter((n) => n.estado !== 'en_preparacion' || n.timestamp > limite)
      );
    }, 8000);

    return () => clearTimeout(timer);
  }, [notificacionesCocina]);

  const [nivelOroLiquido, setNivelOroLiquidoEstado] = useState<NivelOroLiquido>(() => {
    try {
      const guardado = localStorage.getItem('taqueria_nivel_oro_liquido');
      if (
        guardado === 'intenso' ||
        guardado === 'elegante' ||
        guardado === 'sutil' ||
        guardado === 'apagado'
      ) {
        return guardado;
      }
    } catch {
      // Ignorar error de acceso a localStorage en navegadores restrictivos
    }
    return 'elegante';
  });

  const setNivelOroLiquido = useCallback((nivel: NivelOroLiquido): void => {
    setNivelOroLiquidoEstado(nivel);
    try {
      localStorage.setItem('taqueria_nivel_oro_liquido', nivel);
    } catch {
      // Ignorar error de guardado
    }
  }, []);

  const parametrosOro = useMemo<ParametrosOroLiquido>(() => {
    return PARAMETROS_NIVEL_ORO[nivelOroLiquido];
  }, [nivelOroLiquido]);

  // Sincronizar velocidad CSS y atributo de dataset global en el documento HTML
  useEffect(() => {
    document.documentElement.dataset.nivelOro = nivelOroLiquido;
    document.documentElement.style.setProperty(
      '--duracion-flujo-oro',
      parametrosOro.duracionSegundosCss > 0 ? `${parametrosOro.duracionSegundosCss}s` : '0s'
    );
  }, [nivelOroLiquido, parametrosOro.duracionSegundosCss]);

  const cargarHistorialTurnos = useCallback(async (): Promise<void> => {
    const locales = RepositorioStorage.obtenerHistorialTurnos();
    try {
      if (servicioSupabase.tieneCredenciales() && navigator.onLine) {
        const remotos = await servicioSupabase.obtenerHistorialCortes();
        if (remotos && remotos.length > 0) {
          const mapa = new Map<string, TurnoCerrado>();
          for (const t of locales) mapa.set(t.id, t);
          for (const t of remotos) {
            if (!mapa.has(t.id)) {
              mapa.set(t.id, t);
            }
          }
          const combinados = Array.from(mapa.values()).sort(
            (a, b) => new Date(b.fechaApertura).getTime() - new Date(a.fechaApertura).getTime()
          );
          setHistorialTurnos(combinados);
          RepositorioStorage.guardarHistorialTurnos(combinados);
          return;
        }
      }
      setHistorialTurnos(locales);
    } catch (err: unknown) {
      console.warn('[RestauranteContext.cargarHistorialTurnos] Error al cargar historial remoto:', err);
      setHistorialTurnos(locales);
    }
  }, []);

  const alternarTema = useCallback((): void => {
    setTema((prev) => {
      const nuevo = prev === 'oscuro' ? 'claro' : 'oscuro';
      RepositorioStorage.guardarTema(nuevo);
      return nuevo;
    });
  }, []);

  // Sincronización de clase de tema en el elemento raíz del HTML
  useEffect(() => {
    const root = document.documentElement;
    if (tema === 'claro') {
      root.classList.add('tema-claro');
      root.classList.remove('tema-oscuro', 'dark');
    } else {
      root.classList.add('tema-oscuro', 'dark');
      root.classList.remove('tema-claro');
    }
  }, [tema]);

  // Sincronización completa con el servidor remoto (PostgreSQL en Supabase)
  const sincronizarConServidorRemoto = useCallback(async (): Promise<void> => {
    if (!servicioSupabase.tieneCredenciales()) return;
    try {
      const estadoRemoto = await servicioSupabase.obtenerEstadoRemoto();
      if (!estadoRemoto) return;

      const cuentasRemotas = estadoRemoto.cuentasActivas ?? {};
      const cuentasActivasIds = new Set(Object.keys(cuentasRemotas));

      let saneadas: Mesa[] = [];
      if (estadoRemoto.mesas && estadoRemoto.mesas.length > 0) {
        saneadas = deduplicarYSanearMesas(estadoRemoto.mesas);
      } else {
        saneadas = mesas;
      }

      // Validación de consistencia bidireccional:
      // Si una mesa aparece ocupada pero no existe cuenta activa válida para ella, se libera de inmediato
      const mesasCorregidas = saneadas.map((m) => {
        if (m.estado !== 'libre') {
          const tieneCuentaValida = Boolean(m.cuentaActivaId && cuentasActivasIds.has(m.cuentaActivaId));
          if (!tieneCuentaValida) {
            console.log(`[RestauranteContext] Saneando mesa huérfana sin cuenta activa: ${m.nombre} (ID: ${m.id})`);
            servicioSupabase.liberarMesaRemota(m.id, m.numero).catch(console.error);
            return {
              ...m,
              estado: 'libre' as EstadoMesa,
              cuentaActivaId: null,
              horaApertura: null,
              totalParcial: 0,
              meseroAsignado: undefined,
            };
          }
        }
        return m;
      });

      const mesasFinales = deduplicarYSanearMesas(mesasCorregidas);
      setMesas(mesasFinales);
      RepositorioStorage.guardarMesas(mesasFinales);

      // Depurar cuentas activas (solo conservar aquellas con mesa ocupada o por cobrar, o activas localmente)
      const mesasOcupadasIds = new Set(
        mesasFinales.filter((m) => m.estado !== 'libre' && m.cuentaActivaId).map((m) => m.cuentaActivaId)
      );

      const cuentasDepuradas: Record<string, Cuenta> = {};
      for (const [id, cta] of Object.entries(cuentasRemotas)) {
        if (mesasOcupadasIds.has(id)) {
          cuentasDepuradas[id] = cta;
        } else if (cuentasActivas[id]) {
          // Si la cuenta existe en la memoria local activa de este dispositivo, la conservamos
          cuentasDepuradas[id] = cuentasActivas[id];
        } else {
          console.log(`[RestauranteContext] Cancelando cuenta huérfana en Supabase: ${id} de ${cta.nombreMesa}`);
          servicioSupabase.cancelarCuentaRemota(id).catch(console.error);
        }
      }

      setCuentasActivas(cuentasDepuradas);
      RepositorioStorage.guardarCuentasActivas(cuentasDepuradas);

      const fechaAperturaTurno = estadoRemoto.corteActual?.fechaApertura ?? corteActual.fechaApertura;
      if (estadoRemoto.pedidosCocina) {
        setPedidosCocina((prev) => {
          const mapa = new Map<string, PedidoCocina>();
          // Conservar únicamente pedidos pertenecientes al turno activo
          const esDelTurnoActual = (p: PedidoCocina): boolean => {
            if (!fechaAperturaTurno) return true;
            return new Date(p.horaEnvio).getTime() >= new Date(fechaAperturaTurno).getTime() - 60000;
          };
          for (const p of prev) {
            if (esDelTurnoActual(p)) mapa.set(p.id, p);
          }
          for (const p of estadoRemoto.pedidosCocina) {
            if (esDelTurnoActual(p)) {
              const ultimaModLocal = ultimasModificacionesCocinaRef.current.get(p.id);
              // Si el pedido fue editado localmente hace menos de 8 segundos, conservar la versión local
              if (ultimaModLocal && Date.now() - ultimaModLocal < 8000) {
                continue;
              }
              mapa.set(p.id, p);
            }
          }
          const combinados = Array.from(mapa.values()).sort(
            (a, b) => new Date(b.horaEnvio).getTime() - new Date(a.horaEnvio).getTime()
          );
          RepositorioStorage.guardarPedidosCocina(combinados);
          return combinados;
        });
      }

      if (estadoRemoto.cuentasCerradas && estadoRemoto.cuentasCerradas.length > 0) {
        setCuentasCerradas((prev) => {
          const mapa = new Map<string, Cuenta>();
          for (const c of prev) mapa.set(c.id, c);
          for (const c of estadoRemoto.cuentasCerradas) mapa.set(c.id, c);
          const combinadas = Array.from(mapa.values()).sort(
            (a, b) =>
              new Date(b.horaCierre ?? b.horaApertura).getTime() -
              new Date(a.horaCierre ?? a.horaApertura).getTime()
          );
          RepositorioStorage.guardarCuentasCerradas(combinadas);
          return combinadas;
        });
      }

      if (estadoRemoto.corteActual) {
        setCorteActual((prev) => {
          const propinas = estadoRemoto.corteActual?.totalPropinas ?? prev.totalPropinas ?? 0;
          const corteSync = {
            ...estadoRemoto.corteActual!,
            totalPropinas: propinas,
          };
          RepositorioStorage.guardarCorteActual(corteSync);
          return corteSync;
        });
      }
      console.log('[RestauranteContext] Sincronización completa con Supabase exitosa.');
    } catch (err: unknown) {
      console.warn('[RestauranteContext] Falló sincronización remota:', err);
    }
  }, []);

  // Detección de conectividad del navegador y re-sincronización al volver
  useEffect(() => {
    const handleOnline = (): void => {
      setEstaEnLinea(true);
      sincronizarConServidorRemoto().catch(console.error);
    };
    const handleOffline = (): void => setEstaEnLinea(false);
    const handleVisibilidad = (): void => {
      if (document.visibilityState === 'visible') {
        sincronizarConServidorRemoto().catch(console.error);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilidad);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilidad);
    };
  }, [sincronizarConServidorRemoto]);

  // Persistencia local
  useEffect(() => {
    RepositorioStorage.guardarMesas(mesas);
  }, [mesas]);

  useEffect(() => {
    RepositorioStorage.guardarCuentasActivas(cuentasActivas);
  }, [cuentasActivas]);

  useEffect(() => {
    RepositorioStorage.guardarPedidosCocina(pedidosCocina);
  }, [pedidosCocina]);

  // Suscripción al bus de sincronización en tiempo real
  useEffect(() => {
    const desuscribir = servicioSincronizacion.suscribir((mensaje: MensajeSincronizacion) => {
      const { tipo, payload } = mensaje;

      switch (tipo) {
        case 'SYNC_ESTADO_COMPLETO': {
          const datos = payload as {
            mesas?: Mesa[];
            cuentasActivas?: Record<string, Cuenta>;
            cuentasCerradas?: Cuenta[];
            pedidosCocina?: PedidoCocina[];
            corteActual?: CorteCaja;
            clientesConectadosCount?: number;
          };

          if (datos.mesas && Array.isArray(datos.mesas) && datos.mesas.length > 0) {
            const saneadas = deduplicarYSanearMesas(datos.mesas);
            setMesas(saneadas);
            RepositorioStorage.guardarMesas(saneadas);
          } else {
            // Si el servidor aún no tiene mesas, enviamos las mesas y cuentas locales actuales
            const mesasLocales = RepositorioStorage.obtenerMesas();
            const cuentasLocales = RepositorioStorage.obtenerCuentasActivas();
            servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
              mesas: mesasLocales,
              cuentasActivas: cuentasLocales,
            });
          }
          if (datos.cuentasActivas) {
            setCuentasActivas(datos.cuentasActivas);
            RepositorioStorage.guardarCuentasActivas(datos.cuentasActivas);
          }
          if (datos.cuentasCerradas) {
            setCuentasCerradas(datos.cuentasCerradas);
            RepositorioStorage.guardarCuentasCerradas(datos.cuentasCerradas);
          }
          if (datos.pedidosCocina) {
            setPedidosCocina((prev) => {
              const mapa = new Map<string, PedidoCocina>();
              for (const p of prev) mapa.set(p.id, p);
              for (const p of datos.pedidosCocina!) mapa.set(p.id, p);
              const combinados = Array.from(mapa.values()).sort(
                (a, b) => new Date(b.horaEnvio).getTime() - new Date(a.horaEnvio).getTime()
              );
              RepositorioStorage.guardarPedidosCocina(combinados);
              return combinados;
            });
          }
          if (datos.corteActual) {
            setCorteActual(datos.corteActual);
          }
          if (datos.clientesConectadosCount) {
            setDispositivosConectados(datos.clientesConectadosCount);
          }
          break;
        }

        case 'ESTADO_CONEXION_ACTUALIZADO': {
          const datos = payload as { clientesConectadosCount?: number };
          if (typeof datos.clientesConectadosCount === 'number') {
            setDispositivosConectados(datos.clientesConectadosCount);
          }
          break;
        }

        case 'DISPOSITIVOS_ACTUALIZADOS': {
          const datos = payload as { clientesConectadosCount?: number };
          if (datos && typeof datos.clientesConectadosCount === 'number') {
            setDispositivosConectados(datos.clientesConectadosCount);
          }
          break;
        }

        case 'MESA_ACTUALIZADA': {
          const datos = payload as { mesas?: Mesa[]; cuentasActivas?: Record<string, Cuenta> };
          if (datos.mesas) {
            const saneadas = deduplicarYSanearMesas(datos.mesas);
            setMesas(saneadas);
            RepositorioStorage.guardarMesas(saneadas);
          }
          if (datos.cuentasActivas) {
            setCuentasActivas(datos.cuentasActivas);
            RepositorioStorage.guardarCuentasActivas(datos.cuentasActivas);
          }
          break;
        }

        case 'MESA_ELIMINADA': {
          const datos = payload as { mesaId?: string };
          if (datos.mesaId) {
            setMesas((prev) => {
              const filtradas = prev.filter((m) => m.id !== datos.mesaId);
              RepositorioStorage.guardarMesas(filtradas);
              return filtradas;
            });
            setMesaSeleccionadaId((actual) => (actual === datos.mesaId ? null : actual));
          }
          break;
        }

        case 'NUEVA_COMANDA_COCINA': {
          const datos = payload as {
            pedido?: PedidoCocina;
            mesas?: Mesa[];
            cuentasActivas?: Record<string, Cuenta>;
          };
          if (datos.pedido) {
            const pedidoEntrante = datos.pedido as PedidoCocina;
            setPedidosCocina((prev) => {
              if (prev.some((p) => p.id === pedidoEntrante.id)) {
                return prev;
              }
              reproducirCampanaCocina();
              return [pedidoEntrante, ...prev];
            });
          }
          if (datos.mesas) {
            const saneadas = deduplicarYSanearMesas(datos.mesas);
            setMesas(saneadas);
            RepositorioStorage.guardarMesas(saneadas);
          }
          if (datos.cuentasActivas) setCuentasActivas(datos.cuentasActivas);
          break;
        }

        case 'PEDIDO_COCINA_ACTUALIZADO': {
          const datos = payload as { pedido?: PedidoCocina };
          if (datos.pedido) {
            const pedidoRecibido = datos.pedido;
            setPedidosCocina((prev) => {
              const ultimaModLocal = ultimasModificacionesCocinaRef.current.get(pedidoRecibido.id);
              // Ignorar ecos si fue modificado localmente hace menos de 8 segundos
              if (ultimaModLocal && Date.now() - ultimaModLocal < 8000) {
                return prev;
              }
              return prev.map((p) => (p.id === pedidoRecibido.id ? pedidoRecibido : p));
            });
          }
          break;
        }

        case 'CUENTA_COBRADA': {
          const datos = payload as {
            mesas?: Mesa[];
            cuentasActivas?: Record<string, Cuenta>;
            corteActual?: CorteCaja;
            cuentaCerrada?: Cuenta;
          };
          if (datos.mesas) {
            const saneadas = deduplicarYSanearMesas(datos.mesas);
            setMesas(saneadas);
            RepositorioStorage.guardarMesas(saneadas);
          }
          if (datos.cuentasActivas) setCuentasActivas(datos.cuentasActivas);
          if (datos.corteActual) setCorteActual(datos.corteActual);
          if (datos.cuentaCerrada) {
            const ctaCerrada = datos.cuentaCerrada as Cuenta;
            setCuentasCerradas((prev) => {
              if (prev.some((item) => item.id === ctaCerrada.id)) return prev;
              const nuevas = [ctaCerrada, ...prev];
              RepositorioStorage.guardarCuentasCerradas(nuevas);
              return nuevas;
            });
            RepositorioStorage.registrarCuentaCerrada(ctaCerrada);
          }
          break;
        }

        case 'TURNO_REINICIADO': {
          const datos = payload as {
            corteActual?: CorteCaja;
            turnoCerrado?: TurnoCerrado;
            mesas?: Mesa[];
            cuentasActivas?: Record<string, Cuenta>;
          };
          if (datos.corteActual) setCorteActual(datos.corteActual);
          if (datos.turnoCerrado) {
            setHistorialTurnos((prev) => {
              if (prev.some((t) => t.id === datos.turnoCerrado?.id)) return prev;
              const nuevo = [datos.turnoCerrado!, ...prev];
              RepositorioStorage.guardarHistorialTurnos(nuevo);
              return nuevo;
            });
          }
          if (datos.mesas) {
            const saneadas = deduplicarYSanearMesas(datos.mesas);
            setMesas(saneadas);
            RepositorioStorage.guardarMesas(saneadas);
          } else {
            setMesas((prev) => {
              const liberadas = prev.map((m) => ({
                ...m,
                estado: 'libre' as EstadoMesa,
                cuentaActivaId: null,
                horaApertura: null,
                totalParcial: 0,
                meseroAsignado: undefined,
              }));
              const saneadas = deduplicarYSanearMesas(liberadas);
              RepositorioStorage.guardarMesas(saneadas);
              return saneadas;
            });
          }
          setCuentasActivas({});
          RepositorioStorage.guardarCuentasActivas({});
          setMesaSeleccionadaId(null);
          setTicketImpresion(null);
          setCuentasCerradas([]);
          setPedidosCocina([]);
          RepositorioStorage.guardarPedidosCocina([]);
          break;
        }

        case 'CATALOGO_PRODUCTOS_ACTUALIZADO': {
          const nuevos = payload as Producto[];
          if (Array.isArray(nuevos) && nuevos.length > 0) {
            setProductos(nuevos);
            RepositorioStorage.guardarProductos(nuevos);
          }
          break;
        }

        default:
          break;
      }
    });

    // 1.5 Cargar catálogo global remoto de Supabase Storage si está disponible
    servicioSupabase.obtenerCatalogoProductosRemoto().then((catalogoRemoto) => {
      if (Array.isArray(catalogoRemoto) && catalogoRemoto.length > 0) {
        setProductos(catalogoRemoto);
        RepositorioStorage.guardarProductos(catalogoRemoto);
      }
    }).catch(console.warn);

    return () => {
      desuscribir();
    };
  }, []);

  // Suscripción y carga de Supabase en la nube con re-sincronización activa al reconectar
  useEffect(() => {
    let montado = true;

    // 1. Cargar estado remoto inicial
    sincronizarConServidorRemoto().catch(console.error);

    // 2. Suscribirse a cambios en tiempo real vía Supabase Realtime
    const desuscribirSupabase = servicioSupabase.suscribir((tipo, payload) => {
      if (!montado) return;

      if (tipo === 'ESTADO_CONEXION_ACTUALIZADO') {
        const datos = payload as { conectado: boolean };
        setEstaEnLinea(datos.conectado);
        if (datos.conectado) {
          // Al reconectar, recuperar inmediatamente cualquier cambio ocurrido durante la desconexión
          sincronizarConServidorRemoto().catch(console.error);
        }
      } else if (tipo === 'DISPOSITIVOS_ACTUALIZADOS') {
        const datos = payload as { clientesConectadosCount?: number };
        if (typeof datos?.clientesConectadosCount === 'number') {
          setDispositivosConectados(datos.clientesConectadosCount);
        }
      } else if (tipo === 'CATALOGO_PRODUCTOS_REMOTO_ACTUALIZADO') {
        servicioSupabase.obtenerCatalogoProductosRemoto().then((catalogoRemoto) => {
          if (Array.isArray(catalogoRemoto) && catalogoRemoto.length > 0) {
            setProductos(catalogoRemoto);
            RepositorioStorage.guardarProductos(catalogoRemoto);
          }
        }).catch(console.warn);
      } else if (tipo === 'MESA_REMOTA_ACTUALIZADA' && payload) {
        interface FilaMesaRaw {
          id: string;
          numero: number;
          nombre: string;
          capacidad: number;
          estado: string;
          area: string;
          total_parcial: number;
          cuenta_activa_id: string | null;
          hora_apertura: string | null;
          mesero_asignado: string | null;
          notas: string | null;
        }
        const m = payload as FilaMesaRaw;
        const mesaAdaptada: Mesa = {
          id: m.id,
          numero: m.numero,
          nombre: m.nombre,
          capacidad: m.capacidad,
          estado: m.estado as Mesa['estado'],
          area: m.area as Mesa['area'],
          totalParcial: Number(m.total_parcial ?? 0),
          cuentaActivaId: m.cuenta_activa_id,
          horaApertura: m.hora_apertura,
          meseroAsignado: m.mesero_asignado ?? undefined,
        };

        setMesas((prev) => {
          const index = prev.findIndex(
            (item) =>
              item.id === mesaAdaptada.id ||
              (item.area === mesaAdaptada.area && item.numero === mesaAdaptada.numero)
          );
          let actualizadas: Mesa[];
          if (index >= 0) {
            actualizadas = [...prev];
            actualizadas[index] = mesaAdaptada;
          } else {
            actualizadas = [...prev, mesaAdaptada];
          }
          const saneadas = deduplicarYSanearMesas(actualizadas);
          RepositorioStorage.guardarMesas(saneadas);
          return saneadas;
        });

        // Si la mesa pasó a estar libre, remover cualquier cuenta activa asociada
        if (mesaAdaptada.estado === 'libre') {
          setCuentasActivas((prev) => {
            let huboCambio = false;
            const copia = { ...prev };
            for (const [id, cta] of Object.entries(copia)) {
              if (
                cta.mesaId === mesaAdaptada.id ||
                (cta.numeroMesa === mesaAdaptada.numero && cta.nombreMesa === mesaAdaptada.nombre)
              ) {
                delete copia[id];
                huboCambio = true;
              }
            }
            if (huboCambio) {
              RepositorioStorage.guardarCuentasActivas(copia);
              return copia;
            }
            return prev;
          });
        }
      } else if (tipo === 'CUENTA_REMOTA_ACTUALIZADA' && payload) {
        interface FilaCuentaRaw {
          id: string;
          mesa_id: string;
          numero_mesa: number;
          nombre_mesa: string;
          items: unknown;
          subtotal: number;
          descuento: number;
          propina: number;
          total: number;
          estado: string;
          hora_apertura: string;
          hora_cierre: string | null;
          mesero: string;
          metodo_pago: string | null;
          division_cuenta: unknown;
          desglose_mixto: unknown;
        }
        const c = payload as FilaCuentaRaw;
        const cuentaAdaptada: Cuenta = {
          id: c.id,
          mesaId: c.mesa_id,
          numeroMesa: c.numero_mesa,
          nombreMesa: c.nombre_mesa,
          items: Array.isArray(c.items) ? (c.items as Cuenta['items']) : [],
          subtotal: Number(c.subtotal ?? 0),
          descuento: Number(c.descuento ?? 0),
          propina: Number(c.propina ?? 0),
          total: Number(c.total ?? 0),
          estado: c.estado as Cuenta['estado'],
          horaApertura: c.hora_apertura,
          horaCierre: c.hora_cierre,
          mesero: c.mesero,
          metodoPago: c.metodo_pago ? (c.metodo_pago as Cuenta['metodoPago']) : undefined,
          divisionCuenta: c.division_cuenta ? (c.division_cuenta as Cuenta['divisionCuenta']) : undefined,
          desgloseMixto: c.desglose_mixto ? (c.desglose_mixto as Cuenta['desgloseMixto']) : undefined,
        };

        if (cuentaAdaptada.estado === 'cerrada' || c.estado === 'cancelada') {
          // Quitar de cuentas activas
          setCuentasActivas((prev) => {
            if (prev[cuentaAdaptada.id]) {
              const copia = { ...prev };
              delete copia[cuentaAdaptada.id];
              RepositorioStorage.guardarCuentasActivas(copia);
              return copia;
            }
            return prev;
          });

          if (cuentaAdaptada.estado === 'cerrada') {
            setCuentasCerradas((prev) => {
              if (prev.some((item) => item.id === cuentaAdaptada.id)) return prev;
              const nuevas = [cuentaAdaptada, ...prev];
              RepositorioStorage.guardarCuentasCerradas(nuevas);
              return nuevas;
            });
            RepositorioStorage.registrarCuentaCerrada(cuentaAdaptada);
          }

          // Si la cuenta se cobró/cerró, asegurar que su mesa se libere de inmediato
          setMesas((prev) => {
            const index = prev.findIndex((m) => m.id === cuentaAdaptada.mesaId);
            if (index >= 0 && prev[index].estado !== 'libre') {
              const actualizadas = [...prev];
              actualizadas[index] = {
                ...actualizadas[index],
                estado: 'libre',
                cuentaActivaId: null,
                totalParcial: 0,
                horaApertura: null,
                meseroAsignado: undefined,
              };
              const saneadas = deduplicarYSanearMesas(actualizadas);
              RepositorioStorage.guardarMesas(saneadas);
              return saneadas;
            }
            return prev;
          });
        } else {
          // Cuenta abierta
          setCuentasActivas((prev) => {
            const copia = { ...prev, [cuentaAdaptada.id]: cuentaAdaptada };
            RepositorioStorage.guardarCuentasActivas(copia);
            return copia;
          });
        }
      } else if (tipo === 'PEDIDO_COCINA_REMOTO_ACTUALIZADO' && payload) {
        interface FilaCocinaRaw {
          id: string;
          comanda_id: string;
          mesa_id: string;
          nombre_mesa: string;
          mesero: string;
          hora_envio: string;
          items: unknown;
          estado: string;
        }
        const p = payload as FilaCocinaRaw;
        const pedidoAdaptado: PedidoCocina = {
          id: p.id,
          comandaId: p.comanda_id,
          mesaId: p.mesa_id,
          nombreMesa: p.nombre_mesa,
          mesero: p.mesero,
          horaEnvio: p.hora_envio,
          items: Array.isArray(p.items) ? (p.items as PedidoCocina['items']) : [],
          estado: p.estado as PedidoCocina['estado'],
        };

        setPedidosCocina((prev) => {
          const ultimaModLocal = ultimasModificacionesCocinaRef.current.get(pedidoAdaptado.id);
          // Proteger contra ecos rezagados si este dispositivo modificó el pedido recientemente
          if (ultimaModLocal && Date.now() - ultimaModLocal < 8000) {
            return prev;
          }
          const existe = prev.some((it) => it.id === pedidoAdaptado.id);
          if (existe) {
            return prev.map((it) => (it.id === pedidoAdaptado.id ? pedidoAdaptado : it));
          }
          reproducirCampanaCocina();
          return [pedidoAdaptado, ...prev];
        });
      }
    });

    return () => {
      montado = false;
      desuscribirSupabase();
    };
  }, []);

  const esPasoComanderoTutorial =
    pasoTutorialDemo === 2 || pasoTutorialDemo === 3 || pasoTutorialDemo === 5;

  const mesaSeleccionada = useMemo<Mesa | null>(() => {
    if (esPasoComanderoTutorial) {
      return {
        id: MESA_DEMO_TUTORIAL_ID,
        numero: 4,
        nombre: 'Mesa 4 · Salón (Ejemplo)',
        area: 'mesa',
        capacidad: 4,
        estado: pasoTutorialDemo === 5 ? 'por_cobrar' : 'ocupada',
        cuentaActivaId: CUENTA_DEMO_TUTORIAL_ID,
        horaApertura: cuentaDemoTutorial.horaApertura,
        totalParcial: cuentaDemoTutorial.subtotal,
        meseroAsignado: cuentaDemoTutorial.mesero,
      };
    }
    if (!mesaSeleccionadaId) return null;
    return mesas.find((m) => m.id === mesaSeleccionadaId) ?? null;
  }, [
    esPasoComanderoTutorial,
    pasoTutorialDemo,
    cuentaDemoTutorial.horaApertura,
    cuentaDemoTutorial.subtotal,
    cuentaDemoTutorial.mesero,
    mesas,
    mesaSeleccionadaId,
  ]);

  const cuentaActiva = useMemo<Cuenta | null>(() => {
    if (esPasoComanderoTutorial || mesaSeleccionada?.id === MESA_DEMO_TUTORIAL_ID) {
      return cuentaDemoTutorial;
    }
    if (!mesaSeleccionada || !mesaSeleccionada.cuentaActivaId) return null;
    return cuentasActivas[mesaSeleccionada.cuentaActivaId] ?? null;
  }, [esPasoComanderoTutorial, mesaSeleccionada, cuentaDemoTutorial, cuentasActivas]);

  const pedidosCocinaExpuestos = useMemo<PedidoCocina[]>(() => {
    if (pasoTutorialDemo === 4) {
      const activosReales = pedidosCocina.filter((p) => p.estado !== 'entregado');
      if (activosReales.length === 0) {
        return [pedidoCocinaDemo, ...pedidosCocina];
      }
    }
    return pedidosCocina;
  }, [pasoTutorialDemo, pedidosCocina, pedidoCocinaDemo]);

  const seleccionarMesa = useCallback((mesa: Mesa | null): void => {
    if (mesa?.id === MESA_DEMO_TUTORIAL_ID) return;
    setMesaSeleccionadaId(mesa ? mesa.id : null);
  }, []);

  /**
   * Abre una mesa libre y le genera una cuenta activa.
   */
  const abrirMesa = useCallback(
    (mesaId: string, mesero?: string): void => {
      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa) return;

      const nuevaCuentaId = `cuenta-${Date.now()}-${mesa.numero}`;
      const horaActual = new Date().toISOString();

      const nuevaCuenta: Cuenta = {
        id: nuevaCuentaId,
        mesaId: mesa.id,
        numeroMesa: mesa.numero,
        nombreMesa: mesa.nombre,
        items: [],
        subtotal: 0,
        descuento: 0,
        propina: 0,
        total: 0,
        estado: 'abierta',
        horaApertura: horaActual,
        horaCierre: null,
        mesero: mesero ?? meseroActual,
      };

      const nuevasCuentas = { ...cuentasActivas, [nuevaCuentaId]: nuevaCuenta };
      const nuevasMesas = mesas.map((m) =>
        m.id === mesaId
          ? {
              ...m,
              estado: 'ocupada' as EstadoMesa,
              cuentaActivaId: nuevaCuentaId,
              horaApertura: horaActual,
              totalParcial: 0,
              meseroAsignado: mesero ?? meseroActual,
            }
          : m
      );

      setCuentasActivas(nuevasCuentas);
      setMesas(nuevasMesas);

      // Sincronizar en vivo a todos los dispositivos
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: nuevasMesas,
        cuentasActivas: nuevasCuentas,
      });

      // Persistir y sincronizar en Supabase (o cola offline)
      servicioSupabase.guardarMesas(nuevasMesas).catch(console.error);
      servicioSupabase.guardarCuentas(nuevasCuentas).catch(console.error);

      // Registrar auditoría operativa en telemetría
      servicioTelemetria.registrarInfo(`Mesa abierta: ${mesa.nombre}`, {
        mesaId: mesa.id,
        numeroMesa: mesa.numero,
        mesero: mesero ?? meseroActual,
      });
    },
    [mesas, cuentasActivas, meseroActual]
  );

  const cambiarEstadoMesa = useCallback(
    (mesaId: string, nuevoEstado: EstadoMesa): void => {
      const nuevasMesas = mesas.map((m) => (m.id === mesaId ? { ...m, estado: nuevoEstado } : m));
      setMesas(nuevasMesas);
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: nuevasMesas,
        cuentasActivas,
      });
      servicioSupabase.guardarMesas(nuevasMesas).catch(console.error);
    },
    [mesas, cuentasActivas]
  );

  /**
   * Agrega un nuevo producto al catálogo de la taquería.
   */
  const agregarProducto = useCallback(
    async (datos: FormularioProductoDTO): Promise<Producto> => {
      const nuevoId =
        datos.id && datos.id.trim()
          ? datos.id.trim()
          : `prod-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Subir foto a Supabase Storage para que sea accesible en celulares y tablets
      let fotoFinalUrl = datos.imagenUrl;
      if (fotoFinalUrl && fotoFinalUrl.startsWith('data:')) {
        try {
          fotoFinalUrl = await servicioSupabase.subirFotoPlatillo(nuevoId, fotoFinalUrl);
        } catch (errFoto) {
          console.warn('[RestauranteContext] Falló subida de foto a Supabase Storage:', errFoto);
        }
      }

      const nuevo: Producto = {
        id: nuevoId,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion.trim(),
        precio: Math.max(0, Number(datos.precio) || 0),
        categoria: datos.categoria,
        modificadoresSugeridos:
          datos.modificadoresSugeridos && datos.modificadoresSugeridos.length > 0
            ? [...datos.modificadoresSugeridos]
            : undefined,
        imagenUrl: fotoFinalUrl,
        requierePreparacion: datos.requierePreparacion,
      };

      setProductos((prev) => {
        const actualizados = [nuevo, ...prev];
        RepositorioStorage.guardarProductos(actualizados);
        servicioSincronizacion.emitir('CATALOGO_PRODUCTOS_ACTUALIZADO', actualizados);
        servicioSupabase.guardarCatalogoProductosRemoto(actualizados).catch(console.warn);
        return actualizados;
      });

      // Auditoría en telemetría para monitoreo en vivo en la terminal
      servicioTelemetria.registrarInfo(`[CATÁLOGO] Platillo agregado: ${nuevo.nombre}`, {
        tipoEvento: 'producto_creado',
        productoId: nuevo.id,
        nombre: nuevo.nombre,
        precio: nuevo.precio,
        categoria: nuevo.categoria,
        tieneFoto: Boolean(nuevo.imagenUrl),
        requiereCocina: nuevo.requierePreparacion,
        operador: meseroActual,
      });

      return nuevo;
    },
    [meseroActual]
  );

  /**
   * Modifica los datos de un producto existente.
   */
  const editarProducto = useCallback(
    async (id: string, datos: FormularioProductoDTO): Promise<void> => {
      // Si la foto es un DataURL nuevo en base64, subirla a Supabase Storage
      let fotoFinalUrl = datos.imagenUrl;
      if (fotoFinalUrl && fotoFinalUrl.startsWith('data:')) {
        try {
          fotoFinalUrl = await servicioSupabase.subirFotoPlatillo(id, fotoFinalUrl);
        } catch (errFoto) {
          console.warn('[RestauranteContext] Falló subida de foto editada a Supabase Storage:', errFoto);
        }
      }

      setProductos((prev) => {
        const actualizados = prev.map((p) => {
          if (p.id !== id) return p;
          return {
            ...p,
            nombre: datos.nombre.trim(),
            descripcion: datos.descripcion.trim(),
            precio: Math.max(0, Number(datos.precio) || 0),
            categoria: datos.categoria,
            modificadoresSugeridos: datos.modificadoresSugeridos,
            imagenUrl: fotoFinalUrl !== undefined ? fotoFinalUrl : p.imagenUrl,
            requierePreparacion:
              datos.requierePreparacion !== undefined
                ? datos.requierePreparacion
                : p.requierePreparacion,
          };
        });
        RepositorioStorage.guardarProductos(actualizados);
        servicioSincronizacion.emitir('CATALOGO_PRODUCTOS_ACTUALIZADO', actualizados);
        servicioSupabase.guardarCatalogoProductosRemoto(actualizados).catch(console.warn);
        return actualizados;
      });

      // Auditoría en telemetría para la terminal
      servicioTelemetria.registrarInfo(`[CATÁLOGO] Platillo editado: ${datos.nombre.trim()}`, {
        tipoEvento: 'producto_editado',
        productoId: id,
        nombre: datos.nombre.trim(),
        precio: datos.precio,
        categoria: datos.categoria,
        tieneFoto: Boolean(datos.imagenUrl),
        operador: meseroActual,
      });
    },
    [meseroActual]
  );

  /**
   * Elimina un producto del catálogo del restaurante.
   */
  const eliminarProducto = useCallback(
    async (id: string): Promise<void> => {
      let nombreEliminado = '';
      setProductos((prev) => {
        const objetivo = prev.find((p) => p.id === id);
        if (objetivo) {
          nombreEliminado = objetivo.nombre;
        }
        const actualizados = prev.filter((p) => p.id !== id);
        RepositorioStorage.guardarProductos(actualizados);
        servicioSincronizacion.emitir('CATALOGO_PRODUCTOS_ACTUALIZADO', actualizados);
        servicioSupabase.guardarCatalogoProductosRemoto(actualizados).catch(console.warn);
        return actualizados;
      });

      // Auditoría en telemetría para la terminal
      servicioTelemetria.registrarInfo(
        `[CATÁLOGO] Platillo retirado del menú: ${nombreEliminado || id}`,
        {
          tipoEvento: 'producto_eliminado',
          productoId: id,
          nombre: nombreEliminado,
          operador: meseroActual,
        }
      );
    },
    [meseroActual]
  );

  /**
   * Restablece el menú al catálogo predeterminado de fábrica.
   */
  const restablecerProductos = useCallback((): void => {
    const restablecidos = RepositorioStorage.restablecerProductosPredeterminados();
    setProductos(restablecidos);
    servicioSincronizacion.emitir('CATALOGO_PRODUCTOS_ACTUALIZADO', restablecidos);
  }, []);

  const agregarProductoAComanda = useCallback(
    (
      mesaId: string,
      producto: Producto,
      cantidad: number,
      notas: string,
      modificadores: string[]
    ): void => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) {
        const nuevoItemDemo: ItemComanda = {
          id: `item-demo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productoId: producto.id,
          nombre: producto.nombre,
          precioUnitario: producto.precio,
          categoria: producto.categoria,
          requierePreparacion: producto.requierePreparacion,
          cantidad: Math.max(1, cantidad),
          cantidadEnviadaCocina: 0,
          notas: notas.trim(),
          modificadoresSeleccionados: [...modificadores],
          fechaAgregado: new Date().toISOString(),
        };
        setCuentaDemoTutorial((prev) => {
          const nuevosItems = [...prev.items, nuevoItemDemo];
          const nuevoSubtotal = nuevosItems.reduce(
            (acc, it) => acc + it.precioUnitario * it.cantidad,
            0
          );
          return {
            ...prev,
            items: nuevosItems,
            subtotal: nuevoSubtotal,
            total: nuevoSubtotal + prev.propina - prev.descuento,
          };
        });
        return;
      }

      const targetMesa = mesas.find((m) => m.id === mesaId);
      if (!targetMesa) return;

      let cuentaId = targetMesa.cuentaActivaId;
      let cuentasCopia = { ...cuentasActivas };
      let mesasCopia = [...mesas];

      if (!cuentaId) {
        cuentaId = `cuenta-${Date.now()}-${targetMesa.numero}`;
        const horaActual = new Date().toISOString();
        const nuevaCuenta: Cuenta = {
          id: cuentaId,
          mesaId: targetMesa.id,
          numeroMesa: targetMesa.numero,
          nombreMesa: targetMesa.nombre,
          items: [],
          subtotal: 0,
          descuento: 0,
          propina: 0,
          total: 0,
          estado: 'abierta',
          horaApertura: horaActual,
          horaCierre: null,
          mesero: meseroActual,
        };

        cuentasCopia[cuentaId] = nuevaCuenta;
        mesasCopia = mesasCopia.map((m) =>
          m.id === mesaId
            ? {
                ...m,
                estado: 'ocupada' as EstadoMesa,
                cuentaActivaId: cuentaId,
                horaApertura: horaActual,
                meseroAsignado: meseroActual,
              }
            : m
        );
      }

      const nuevoItem: ItemComanda = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productoId: producto.id,
        nombre: producto.nombre,
        precioUnitario: producto.precio,
        categoria: producto.categoria,
        requierePreparacion: producto.requierePreparacion,
        cantidad: Math.max(1, cantidad),
        cantidadEnviadaCocina: 0,
        notas: notas.trim(),
        modificadoresSeleccionados: [...modificadores],
        fechaAgregado: new Date().toISOString(),
      };

      const cuentaExistente = cuentasCopia[cuentaId];
      if (cuentaExistente) {
        const nuevosItems = [...cuentaExistente.items, nuevoItem];
        const nuevoSubtotal = nuevosItems.reduce(
          (acc, it) => acc + it.precioUnitario * it.cantidad,
          0
        );

        cuentasCopia[cuentaId] = {
          ...cuentaExistente,
          items: nuevosItems,
          subtotal: nuevoSubtotal,
          total: nuevoSubtotal + cuentaExistente.propina - cuentaExistente.descuento,
        };

        mesasCopia = mesasCopia.map((m) =>
          m.id === mesaId
            ? {
                ...m,
                estado: 'ocupada' as EstadoMesa,
                totalParcial: nuevoSubtotal,
              }
            : m
        );
      }

      setCuentasActivas(cuentasCopia);
      setMesas(mesasCopia);

      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: mesasCopia,
        cuentasActivas: cuentasCopia,
      });

      servicioSupabase.guardarCuentas(cuentasCopia).catch(console.error);
      servicioSupabase.guardarMesas(mesasCopia).catch(console.error);
    },
    [mesas, cuentasActivas, meseroActual]
  );

  const modificarCantidadItem = useCallback(
    (mesaId: string, itemId: string, delta: number): void => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) {
        setCuentaDemoTutorial((prev) => {
          const nuevosItems = prev.items
            .map((it) => {
              if (it.id === itemId) {
                const nuevaCantidad = it.cantidad + delta;
                return nuevaCantidad > 0
                  ? {
                      ...it,
                      cantidad: nuevaCantidad,
                      cantidadEnviadaCocina: Math.min(nuevaCantidad, it.cantidadEnviadaCocina ?? 0),
                    }
                  : null;
              }
              return it;
            })
            .filter((it): it is ItemComanda => it !== null);
          const nuevoSubtotal = nuevosItems.reduce(
            (acc, it) => acc + it.precioUnitario * it.cantidad,
            0
          );
          return {
            ...prev,
            items: nuevosItems,
            subtotal: nuevoSubtotal,
            total: nuevoSubtotal + prev.propina - prev.descuento,
          };
        });
        return;
      }

      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa || !mesa.cuentaActivaId) return;

      const cuentaId = mesa.cuentaActivaId;
      const cuenta = cuentasActivas[cuentaId];
      if (!cuenta) return;

      const nuevosItems = cuenta.items
        .map((it) => {
          if (it.id === itemId) {
            const nuevaCantidad = it.cantidad + delta;
            return nuevaCantidad > 0
              ? {
                  ...it,
                  cantidad: nuevaCantidad,
                  cantidadEnviadaCocina: Math.min(nuevaCantidad, it.cantidadEnviadaCocina ?? 0),
                }
              : null;
          }
          return it;
        })
        .filter((it): it is ItemComanda => it !== null);

      const nuevoSubtotal = nuevosItems.reduce(
        (acc, it) => acc + it.precioUnitario * it.cantidad,
        0
      );

      const cuentasCopia = {
        ...cuentasActivas,
        [cuentaId]: {
          ...cuenta,
          items: nuevosItems,
          subtotal: nuevoSubtotal,
          total: nuevoSubtotal + cuenta.propina - cuenta.descuento,
        },
      };

      const mesasCopia = mesas.map((m) =>
        m.id === mesaId ? { ...m, totalParcial: nuevoSubtotal } : m
      );

      setCuentasActivas(cuentasCopia);
      setMesas(mesasCopia);

      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: mesasCopia,
        cuentasActivas: cuentasCopia,
      });

      servicioSupabase.guardarCuentas(cuentasCopia).catch(console.error);
      servicioSupabase.guardarMesas(mesasCopia).catch(console.error);
    },
    [mesas, cuentasActivas]
  );

  const eliminarItemComanda = useCallback(
    (mesaId: string, itemId: string): void => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) {
        setCuentaDemoTutorial((prev) => {
          const nuevosItems = prev.items.filter((it) => it.id !== itemId);
          const nuevoSubtotal = nuevosItems.reduce(
            (acc, it) => acc + it.precioUnitario * it.cantidad,
            0
          );
          return {
            ...prev,
            items: nuevosItems,
            subtotal: nuevoSubtotal,
            total: nuevoSubtotal + prev.propina - prev.descuento,
          };
        });
        return;
      }

      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa || !mesa.cuentaActivaId) return;

      const cuentaId = mesa.cuentaActivaId;
      const cuenta = cuentasActivas[cuentaId];
      if (!cuenta) return;

      const nuevosItems = cuenta.items.filter((it) => it.id !== itemId);
      const nuevoSubtotal = nuevosItems.reduce(
        (acc, it) => acc + it.precioUnitario * it.cantidad,
        0
      );

      const cuentasCopia = {
        ...cuentasActivas,
        [cuentaId]: {
          ...cuenta,
          items: nuevosItems,
          subtotal: nuevoSubtotal,
          total: nuevoSubtotal + cuenta.propina - cuenta.descuento,
        },
      };

      const mesasCopia = mesas.map((m) =>
        m.id === mesaId ? { ...m, totalParcial: nuevoSubtotal } : m
      );

      setCuentasActivas(cuentasCopia);
      setMesas(mesasCopia);

      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: mesasCopia,
        cuentasActivas: cuentasCopia,
      });

      servicioSupabase.guardarCuentas(cuentasCopia).catch(console.error);
      servicioSupabase.guardarMesas(mesasCopia).catch(console.error);
    },
    [mesas, cuentasActivas]
  );

  const solicitarCuenta = useCallback(
    (mesaId: string): void => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) return;
      let mesaModificada: Mesa | null = null;
      const nuevasMesas = mesas.map((m) => {
        if (m.id === mesaId) {
          mesaModificada = { ...m, estado: 'por_cobrar' as EstadoMesa };
          return mesaModificada;
        }
        return m;
      });
      setMesas(nuevasMesas);
      RepositorioStorage.guardarMesas(nuevasMesas);

      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: nuevasMesas,
        cuentasActivas,
      });

      if (mesaModificada) {
        servicioSupabase.guardarMesa(mesaModificada).catch(console.error);
      }
      servicioSupabase.guardarMesas(nuevasMesas).catch(console.error);
    },
    [mesas, cuentasActivas]
  );

  /**
   * Envía la comanda a la pantalla de cocina (KDS).
   * Por defecto envía ÚNICAMENTE los ítems o cantidades nuevas aún no enviadas.
   * Si forzarReenvioCompleto es true, envía todos los ítems de la cuenta.
   */
  const enviarComandaACocina = useCallback(
    (
      mesaId: string,
      forzarReenvioCompleto = false
    ): { enviadosCount: number; exito: boolean; mensaje: string } => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) {
        setCuentaDemoTutorial((prev) => ({
          ...prev,
          items: prev.items.map((it) => ({ ...it, cantidadEnviadaCocina: it.cantidad })),
        }));
        reproducirCampanaCocina();
        return {
          enviadosCount: 2,
          exito: true,
          mensaje: 'Comanda de ejemplo enviada a la pantalla de cocina.',
        };
      }

      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa || !mesa.cuentaActivaId) {
        return { enviadosCount: 0, exito: false, mensaje: 'No hay mesa o cuenta activa.' };
      }

      const cuenta = cuentasActivas[mesa.cuentaActivaId];
      if (!cuenta || cuenta.items.length === 0) {
        return { enviadosCount: 0, exito: false, mensaje: 'La comanda no tiene platillos agregados.' };
      }

      // Filtrar sólo ítems que requieran preparación en cocina y tengan cantidades pendientes
      const itemsAEnviar = cuenta.items
        .map((it) => {
          if (!esItemParaCocina(it)) {
            return null;
          }
          const enviada = it.cantidadEnviadaCocina ?? 0;
          const pendiente = forzarReenvioCompleto ? it.cantidad : Math.max(0, it.cantidad - enviada);
          return pendiente > 0
            ? {
                id: `kds-${it.id}-${Date.now()}`,
                nombre: it.nombre,
                cantidad: pendiente,
                notas: it.notas,
                modificadores: it.modificadoresSeleccionados,
                completado: false,
              }
            : null;
        })
        .filter((it): it is NonNullable<typeof it> => it !== null);

      if (itemsAEnviar.length === 0) {
        // Verificar si la cuenta contiene bebidas que entrega el mesero
        const tieneBebidasMesero = cuenta.items.some((it) => !esItemParaCocina(it));
        if (tieneBebidasMesero) {
          // Marcar bebidas como atendidas para que no figuren pendientes
          const itemsActualizados = cuenta.items.map((it) => ({
            ...it,
            cantidadEnviadaCocina: it.cantidad,
          }));
          const cuentasActualizadas = {
            ...cuentasActivas,
            [cuenta.id]: {
              ...cuenta,
              items: itemsActualizados,
            },
          };
          setCuentasActivas(cuentasActualizadas);
          servicioSupabase.guardarCuentas(cuentasActualizadas).catch(console.error);
          return {
            enviadosCount: 0,
            exito: true,
            mensaje: 'Las bebidas las entrega el mesero directamente (no requieren cocina).',
          };
        }

        return {
          enviadosCount: 0,
          exito: false,
          mensaje: 'Todos los platillos de esta comanda ya fueron enviados a cocina.',
        };
      }

      // Calcular ronda de envío para distinguir si es orden inicial o adición
      const pedidosPreviosMesa = pedidosCocina.filter((p) => p.mesaId === mesa.id).length;
      const numeroRonda = pedidosPreviosMesa + 1;

      const nuevoPedido: PedidoCocina = {
        id: `ped-${Date.now()}-${mesa.numero}`,
        comandaId: cuenta.id,
        mesaId: mesa.id,
        nombreMesa: numeroRonda > 1 ? `${mesa.nombre} (Ronda ${numeroRonda})` : mesa.nombre,
        mesero: cuenta.mesero,
        horaEnvio: new Date().toISOString(),
        items: itemsAEnviar,
        estado: 'pendiente',
        numeroRonda,
      };

      // Actualizar la cuenta marcando los ítems de cocina y las bebidas como atendidos
      const itemsActualizados = cuenta.items.map((it) => ({
        ...it,
        cantidadEnviadaCocina: it.cantidad,
      }));

      const cuentasActualizadas = {
        ...cuentasActivas,
        [cuenta.id]: {
          ...cuenta,
          items: itemsActualizados,
        },
      };

      setCuentasActivas(cuentasActualizadas);
      setPedidosCocina((prev) => [nuevoPedido, ...prev]);
      reproducirCampanaCocina();

      // Emitir a todas las tablets de cocina en tiempo real
      servicioSincronizacion.emitir('NUEVA_COMANDA_COCINA', {
        pedido: nuevoPedido,
        mesas,
        cuentasActivas: cuentasActualizadas,
      });

      // Persistir en Supabase
      servicioSupabase.guardarPedidoCocina(nuevoPedido).catch(console.error);
      servicioSupabase.guardarCuentas(cuentasActualizadas).catch(console.error);

      // Registrar auditoría operativa en telemetría
      servicioTelemetria.registrarInfo(`Comanda enviada a cocina: ${nuevoPedido.nombreMesa}`, {
        pedidoId: nuevoPedido.id,
        mesaId: mesa.id,
        itemsCount: itemsAEnviar.length,
        numeroRonda,
      });

      const totalPiezas = itemsAEnviar.reduce((acc, it) => acc + it.cantidad, 0);
      return {
        enviadosCount: totalPiezas,
        exito: true,
        mensaje: `Se enviaron ${totalPiezas} platillo(s) nuevo(s) a cocina (Ronda ${numeroRonda}).`,
      };
    },
    [mesas, cuentasActivas, pedidosCocina]
  );

  /**
   * Cambia el estado de un pedido en la pantalla de cocina.
   */
  const cambiarEstadoPedidoCocina = useCallback(
    (pedidoId: string, nuevoEstado: EstadoPedidoCocina): void => {
      if (pedidoId === PEDIDO_COCINA_DEMO_ID) {
        setPedidoCocinaDemo((prev) => ({ ...prev, estado: nuevoEstado }));
        return;
      }

      let pedidoActualizado: PedidoCocina | null = null;
      setPedidosCocina((prev) => {
        const actualizados = prev.map((p) => {
          if (p.id === pedidoId) {
            pedidoActualizado = { ...p, estado: nuevoEstado };
            return pedidoActualizado;
          }
          return p;
        });
        RepositorioStorage.guardarPedidosCocina(actualizados);
        return actualizados;
      });

      if (pedidoActualizado) {
        ultimasModificacionesCocinaRef.current.set(pedidoId, Date.now());
        servicioSincronizacion.emitir('PEDIDO_COCINA_ACTUALIZADO', {
          pedido: pedidoActualizado,
        });

        const timerPrevio = timersGuardadoCocinaRef.current.get(pedidoId);
        if (timerPrevio) clearTimeout(timerPrevio);

        // Si se marca como entregado, persistir de inmediato en Supabase sin temporizador
        if (nuevoEstado === 'entregado') {
          timersGuardadoCocinaRef.current.delete(pedidoId);
          servicioSupabase.guardarPedidoCocina(pedidoActualizado).catch(console.error);
        } else {
          const nuevoTimer = setTimeout(() => {
            timersGuardadoCocinaRef.current.delete(pedidoId);
            servicioSupabase.guardarPedidoCocina(pedidoActualizado!).catch(console.error);
          }, 120);
          timersGuardadoCocinaRef.current.set(pedidoId, nuevoTimer);
        }
      }
    },
    []
  );

  /**
   * Marca o desmarca un ítem individual como preparado en cocina.
   */
  const alternarItemCompletadoCocina = useCallback(
    (pedidoId: string, itemId: string): void => {
      if (pedidoId === PEDIDO_COCINA_DEMO_ID) {
        setPedidoCocinaDemo((prev) => {
          const nuevosItems = prev.items.map((it) =>
            it.id === itemId ? { ...it, completado: !it.completado } : it
          );
          const todosCompletos = nuevosItems.every((it) => it.completado);
          return {
            ...prev,
            items: nuevosItems,
            estado: todosCompletos
              ? 'listo'
              : prev.estado === 'pendiente'
              ? 'en_preparacion'
              : prev.estado,
          };
        });
        return;
      }

      let pedidoActualizado: PedidoCocina | null = null;
      setPedidosCocina((prev) => {
        const actualizados = prev.map((p) => {
          if (p.id === pedidoId) {
            const nuevosItems = p.items.map((it) =>
              it.id === itemId ? { ...it, completado: !it.completado } : it
            );
            const todosCompletos = nuevosItems.every((it) => it.completado);
            pedidoActualizado = {
              ...p,
              items: nuevosItems,
              estado: todosCompletos ? 'listo' : p.estado === 'pendiente' ? 'en_preparacion' : p.estado,
            };
            return pedidoActualizado;
          }
          return p;
        });
        RepositorioStorage.guardarPedidosCocina(actualizados);
        return actualizados;
      });

      if (pedidoActualizado) {
        ultimasModificacionesCocinaRef.current.set(pedidoId, Date.now());
        servicioSincronizacion.emitir('PEDIDO_COCINA_ACTUALIZADO', {
          pedido: pedidoActualizado,
        });

        const timerPrevio = timersGuardadoCocinaRef.current.get(pedidoId);
        if (timerPrevio) clearTimeout(timerPrevio);

        const nuevoTimer = setTimeout(() => {
          timersGuardadoCocinaRef.current.delete(pedidoId);
          servicioSupabase.guardarPedidoCocina(pedidoActualizado!).catch(console.error);
        }, 120);
        timersGuardadoCocinaRef.current.set(pedidoId, nuevoTimer);
      }
    },
    []
  );

  const cerrarYCobrarCuenta = useCallback(
    (
      mesaId: string,
      metodoPago: MetodoPago,
      propina: number,
      montoRecibido?: number,
      desgloseMixto?: DesglosePagoMixto,
      divisionCuenta?: DivisionCuentaInfo
    ): { exito: boolean; cambio: number; cuentaCerrada?: Cuenta } => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) {
        const totalFinalDemo =
          cuentaDemoTutorial.subtotal + propina - cuentaDemoTutorial.descuento;
        const recibidoDemo = montoRecibido ?? totalFinalDemo;
        const cambioDemo = recibidoDemo > totalFinalDemo ? recibidoDemo - totalFinalDemo : 0;
        const cuentaCerradaDemo: Cuenta = {
          ...cuentaDemoTutorial,
          propina,
          total: totalFinalDemo,
          estado: 'cerrada',
          horaCierre: new Date().toISOString(),
          metodoPago,
          montoRecibido: recibidoDemo,
          cambioEntregado: cambioDemo,
          desgloseMixto,
          divisionCuenta,
        };
        return { exito: true, cambio: cambioDemo, cuentaCerrada: cuentaCerradaDemo };
      }

      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa || !mesa.cuentaActivaId) {
        return { exito: false, cambio: 0 };
      }

      const cuenta = cuentasActivas[mesa.cuentaActivaId];
      if (!cuenta) {
        return { exito: false, cambio: 0 };
      }

      const totalFinal = cuenta.subtotal + propina - cuenta.descuento;
      const recibido = montoRecibido ?? totalFinal;
      const cambio = recibido > totalFinal ? recibido - totalFinal : 0;
      const horaCierre = new Date().toISOString();

      const cuentaCerrada: Cuenta = {
        ...cuenta,
        propina,
        total: totalFinal,
        estado: 'cerrada',
        horaCierre,
        metodoPago,
        montoRecibido: recibido,
        cambioEntregado: cambio,
        desgloseMixto,
        divisionCuenta,
      };

      RepositorioStorage.registrarCuentaCerrada(cuentaCerrada);
      setCuentasCerradas((prev) => [cuentaCerrada, ...prev]);

      const nuevoTotalVentas = corteActual.totalVentas + totalFinal;
      const nuevoTotalPropinas = (corteActual.totalPropinas ?? 0) + propina;
      let nuevoEfectivo = corteActual.totalEfectivo;
      let nuevoTarjeta = corteActual.totalTarjeta;
      let nuevoTransf = corteActual.totalTransferencia;

      if (metodoPago === 'mixto' && desgloseMixto) {
        // Desglose exacto de los 2 métodos de pago
        if (desgloseMixto.metodo1 === 'efectivo') nuevoEfectivo += desgloseMixto.monto1;
        else if (desgloseMixto.metodo1 === 'tarjeta') nuevoTarjeta += desgloseMixto.monto1;
        else if (desgloseMixto.metodo1 === 'transferencia') nuevoTransf += desgloseMixto.monto1;

        if (desgloseMixto.metodo2 === 'efectivo') nuevoEfectivo += desgloseMixto.monto2;
        else if (desgloseMixto.metodo2 === 'tarjeta') nuevoTarjeta += desgloseMixto.monto2;
        else if (desgloseMixto.metodo2 === 'transferencia') nuevoTransf += desgloseMixto.monto2;
      } else {
        if (metodoPago === 'efectivo') nuevoEfectivo += totalFinal;
        else if (metodoPago === 'tarjeta') nuevoTarjeta += totalFinal;
        else if (metodoPago === 'transferencia') nuevoTransf += totalFinal;
      }

      const count = corteActual.cuentasCobradasCount + 1;
      const promedio = count > 0 ? nuevoTotalVentas / count : 0;

      const corteActualizado: CorteCaja = {
        ...corteActual,
        totalVentas: nuevoTotalVentas,
        totalEfectivo: nuevoEfectivo,
        totalTarjeta: nuevoTarjeta,
        totalTransferencia: nuevoTransf,
        totalPropinas: nuevoTotalPropinas,
        cuentasCobradasCount: count,
        ticketPromedio: Math.round(promedio * 100) / 100,
      };
      RepositorioStorage.guardarCorteActual(corteActualizado);
      setCorteActual(corteActualizado);

      // Marcar los pedidos de cocina de la mesa como entregados para retirarlos de la vista de preparación
      // sin eliminarlos de la memoria ni del historial de comandas del turno
      setPedidosCocina((prev) => {
        const actualizados = prev.map((p) =>
          (p.mesaId === mesa.id || p.mesaId === mesaId) && p.estado !== 'entregado'
            ? { ...p, estado: 'entregado' as EstadoPedidoCocina }
            : p
        );
        RepositorioStorage.guardarPedidosCocina(actualizados);
        return actualizados;
      });

      const cuentasCopia = { ...cuentasActivas };
      // Purgar tanto la cuenta cobrada como cualquier cuenta huérfana de esa misma mesa
      for (const [id, cta] of Object.entries(cuentasCopia)) {
        if (
          id === cuenta.id ||
          cta.mesaId === mesaId ||
          (cta.numeroMesa === mesa.numero && cta.nombreMesa === mesa.nombre)
        ) {
          delete cuentasCopia[id];
        }
      }
      setCuentasActivas(cuentasCopia);

      const mesasCopia = mesas.map((m) =>
        m.id === mesaId
          ? {
              ...m,
              estado: 'libre' as EstadoMesa,
              cuentaActivaId: null,
              horaApertura: null,
              totalParcial: 0,
              meseroAsignado: undefined,
            }
          : m
      );
      setMesas(mesasCopia);

      // Sincronizar cobro a todas las tablets de meseros y caja
      servicioSincronizacion.emitir('CUENTA_COBRADA', {
        mesas: mesasCopia,
        cuentasActivas: cuentasCopia,
        corteActual: corteActualizado,
        cuentaCerrada,
      });

      servicioSupabase.guardarCuentaIndividual(cuentaCerrada).catch(console.error);
      servicioSupabase.cancelarCuentasDeMesaRemota(mesa.id, mesa.numero).catch(console.error);
      servicioSupabase.guardarCuentas(cuentasCopia).catch(console.error);
      servicioSupabase.guardarMesas(mesasCopia).catch(console.error);
      servicioSupabase.guardarCorte(corteActualizado).catch(console.error);

      // Registrar auditoría operativa en telemetría
      servicioTelemetria.registrarInfo(`Cuenta cobrada: ${cuenta.nombreMesa} ($${totalFinal.toFixed(2)})`, {
        cuentaId: cuenta.id,
        mesaId: mesa.id,
        total: totalFinal,
        metodoPago,
        propina,
        cambio,
      });

      return { exito: true, cambio, cuentaCerrada };
    },
    [mesas, cuentasActivas, corteActual, cuentaDemoTutorial]
  );

  const liberarMesaManual = useCallback(
    (mesaId: string): void => {
      if (mesaId === MESA_DEMO_TUTORIAL_ID) {
        setCuentaDemoTutorial(crearCuentaDemoInicial(meseroActual));
        return;
      }
      const mesa = mesas.find(
        (m) =>
          m.id === mesaId ||
          (m.area === 'mesa' && `mesa-${m.numero}` === mesaId) ||
          (m.area === 'domicilio' && `domicilio-${m.numero}` === mesaId)
      );
      if (!mesa) return;

      const idCuentaACancelar = mesa.cuentaActivaId;
      const cuentasCopia = { ...cuentasActivas };

      // Purgar todas las cuentas de esta mesa (incluyendo huérfanas residuales)
      for (const [id, cta] of Object.entries(cuentasCopia)) {
        if (
          id === idCuentaACancelar ||
          cta.mesaId === mesa.id ||
          cta.mesaId === mesaId ||
          (cta.numeroMesa === mesa.numero && cta.nombreMesa === mesa.nombre)
        ) {
          delete cuentasCopia[id];
        }
      }

      // Al liberar una mesa manualmente, marcamos sus pedidos pendientes como entregados
      // para retirarlos de la pantalla de preparación, pero sin eliminarlos del historial de comandas
      setPedidosCocina((prev) => {
        const actualizados = prev.map((p) =>
          (p.mesaId === mesa.id || p.mesaId === mesaId) && p.estado !== 'entregado'
            ? { ...p, estado: 'entregado' as EstadoPedidoCocina }
            : p
        );
        RepositorioStorage.guardarPedidosCocina(actualizados);
        return actualizados;
      });

      const mesasCopia = mesas.map((m) =>
        m.id === mesa.id || (m.area === mesa.area && m.numero === mesa.numero)
          ? {
              ...m,
              estado: 'libre' as EstadoMesa,
              cuentaActivaId: null,
              horaApertura: null,
              totalParcial: 0,
              meseroAsignado: undefined,
            }
          : m
      );

      const saneadas = deduplicarYSanearMesas(mesasCopia);

      setCuentasActivas(cuentasCopia);
      RepositorioStorage.guardarCuentasActivas(cuentasCopia);

      setMesas(saneadas);
      RepositorioStorage.guardarMesas(saneadas);

      if (mesaSeleccionadaId === mesaId || mesaSeleccionadaId === mesa.id) {
        setMesaSeleccionadaId(null);
        setTicketImpresion(null);
      }

      // Emitir sincronización a las demás terminales
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: saneadas,
        cuentasActivas: cuentasCopia,
      });

      // Limpiar y liberar de forma atómica en Supabase
      servicioSupabase.liberarMesaRemota(mesa.id, mesa.numero).catch(console.error);
      if (idCuentaACancelar) {
        servicioSupabase.cancelarCuentaRemota(idCuentaACancelar).catch(console.error);
      }
      servicioSupabase.guardarMesas(saneadas).catch(console.error);
    },
    [mesas, cuentasActivas, mesaSeleccionadaId, meseroActual]
  );

  const agregarMesa = useCallback(
    (capacidad = 4): Mesa => {
      const mesasComedor = mesas.filter((m) => m.area === 'mesa');
      const maxNumero =
        mesasComedor.length > 0 ? Math.max(...mesasComedor.map((m) => m.numero)) : 0;
      const nuevoNumero = maxNumero + 1;
      const nuevaMesa: Mesa = {
        id: `mesa-${nuevoNumero}-${Date.now()}`,
        numero: nuevoNumero,
        nombre: `Mesa ${nuevoNumero}`,
        area: 'mesa',
        capacidad,
        estado: 'libre',
        cuentaActivaId: null,
        horaApertura: null,
        totalParcial: 0,
      };

      const nuevasMesas = [...mesas, nuevaMesa];
      setMesas(nuevasMesas);

      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: nuevasMesas,
        cuentasActivas,
      });

      servicioSupabase.guardarMesas(nuevasMesas).catch(console.error);

      return nuevaMesa;
    },
    [mesas, cuentasActivas]
  );

  const eliminarMesa = useCallback(
    (mesaId?: string): { exito: boolean; mensaje: string } => {
      const mesasComedor = mesas.filter((m) => m.area === 'mesa');
      if (mesasComedor.length === 0) {
        return { exito: false, mensaje: 'No hay mesas de comedor registradas para eliminar.' };
      }

      // Si no se indica mesaId, se toma la última mesa registrada
      const mesaAEliminar = mesaId
        ? mesasComedor.find((m) => m.id === mesaId)
        : mesasComedor[mesasComedor.length - 1];

      if (!mesaAEliminar) {
        return { exito: false, mensaje: 'No se encontró la mesa a eliminar.' };
      }

      if (mesaAEliminar.estado !== 'libre' || mesaAEliminar.cuentaActivaId) {
        return {
          exito: false,
          mensaje: `No se puede eliminar "${mesaAEliminar.nombre}" porque se encuentra ${mesaAEliminar.estado.toUpperCase()}. Cobre o libere la mesa primero.`,
        };
      }

      const nuevasMesas = mesas.filter((m) => m.id !== mesaAEliminar.id);
      setMesas(nuevasMesas);

      if (mesaSeleccionadaId === mesaAEliminar.id) {
        setMesaSeleccionadaId(null);
      }

      servicioSincronizacion.emitir('MESA_ELIMINADA', {
        mesaId: mesaAEliminar.id,
      });
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: nuevasMesas,
        cuentasActivas,
      });

      servicioSupabase.eliminarMesaRemota(mesaAEliminar.id).catch(console.error);

      return {
        exito: true,
        mensaje: `Se eliminó "${mesaAEliminar.nombre}" exitosamente.`,
      };
    },
    [mesas, cuentasActivas, mesaSeleccionadaId]
  );

  const agregarDomicilio = useCallback((): Mesa => {
    const pedidosDomicilio = mesas.filter((m) => m.area === 'domicilio');
    const maxNumero =
      pedidosDomicilio.length > 0 ? Math.max(...pedidosDomicilio.map((m) => m.numero)) : 200;
    const nuevoNumero = maxNumero + 1;
    const correlativo = pedidosDomicilio.length + 1;

    const nuevoPedido: Mesa = {
      id: `domicilio-${nuevoNumero}-${Date.now()}`,
      numero: nuevoNumero,
      nombre: `Domicilio ${correlativo}`,
      area: 'domicilio',
      capacidad: 1,
      estado: 'libre',
      cuentaActivaId: null,
      horaApertura: null,
      totalParcial: 0,
    };

    const nuevasMesas = [...mesas, nuevoPedido];
    setMesas(nuevasMesas);
    RepositorioStorage.guardarMesas(nuevasMesas);

    servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
      mesas: nuevasMesas,
      cuentasActivas,
    });

    servicioSupabase.guardarMesas(nuevasMesas).catch(console.error);

    return nuevoPedido;
  }, [mesas, cuentasActivas]);

  const eliminarDomicilio = useCallback(
    (mesaId?: string): { exito: boolean; mensaje: string } => {
      const pedidosDomicilio = mesas.filter((m) => m.area === 'domicilio');
      if (pedidosDomicilio.length === 0) {
        return { exito: false, mensaje: 'No hay pedidos a domicilio registrados para eliminar.' };
      }

      const pedidoAEliminar = mesaId
        ? pedidosDomicilio.find((m) => m.id === mesaId)
        : pedidosDomicilio[pedidosDomicilio.length - 1];

      if (!pedidoAEliminar) {
        return { exito: false, mensaje: 'No se encontró el pedido a domicilio a eliminar.' };
      }

      if (pedidoAEliminar.estado !== 'libre' || pedidoAEliminar.cuentaActivaId) {
        return {
          exito: false,
          mensaje: `No se puede eliminar "${pedidoAEliminar.nombre}" porque tiene una comanda activa. Cobre o libere el pedido primero.`,
        };
      }

      const nuevasMesas = mesas.filter((m) => m.id !== pedidoAEliminar.id);
      setMesas(nuevasMesas);
      RepositorioStorage.guardarMesas(nuevasMesas);

      if (mesaSeleccionadaId === pedidoAEliminar.id) {
        setMesaSeleccionadaId(null);
      }

      servicioSincronizacion.emitir('MESA_ELIMINADA', {
        mesaId: pedidoAEliminar.id,
      });
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: nuevasMesas,
        cuentasActivas,
      });

      servicioSupabase.eliminarMesaRemota(pedidoAEliminar.id).catch(console.error);

      return {
        exito: true,
        mensaje: `Se eliminó "${pedidoAEliminar.nombre}" exitosamente.`,
      };
    },
    [mesas, cuentasActivas, mesaSeleccionadaId]
  );

  const cambiarNombreMesa = useCallback(
    (mesaId: string, nuevoNombre: string): { exito: boolean; mensaje: string } => {
      const nombreLimpio = nuevoNombre.trim();
      if (!nombreLimpio) {
        return { exito: false, mensaje: 'El nombre de la mesa no puede estar vacío.' };
      }

      const mesaExistente = mesas.find((m) => m.id === mesaId);
      if (!mesaExistente) {
        return { exito: false, mensaje: 'No se encontró la mesa especificada.' };
      }

      if (mesaExistente.nombre.trim() === nombreLimpio) {
        return { exito: true, mensaje: 'El nombre no presenta cambios.' };
      }

      // Validar que no exista otra mesa con el mismo nombre para evitar confusiones operativas
      const nombreDuplicado = mesas.some(
        (m) => m.id !== mesaId && m.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase()
      );
      if (nombreDuplicado) {
        return {
          exito: false,
          mensaje: `Ya existe otra mesa o pedido con el nombre "${nombreLimpio}". Elige uno diferente.`,
        };
      }

      // 1. Actualizar mesas
      const nuevasMesas = mesas.map((m) =>
        m.id === mesaId ? { ...m, nombre: nombreLimpio } : m
      );
      const saneadas = deduplicarYSanearMesas(nuevasMesas);
      setMesas(saneadas);
      RepositorioStorage.guardarMesas(saneadas);

      // 2. Si la mesa tiene comanda activa, actualizar el nombre en la cuenta
      let nuevasCuentas = cuentasActivas;
      if (mesaExistente.cuentaActivaId && cuentasActivas[mesaExistente.cuentaActivaId]) {
        const cuentaActual = cuentasActivas[mesaExistente.cuentaActivaId];
        nuevasCuentas = {
          ...cuentasActivas,
          [mesaExistente.cuentaActivaId]: {
            ...cuentaActual,
            nombreMesa: nombreLimpio,
          },
        };
        setCuentasActivas(nuevasCuentas);
        RepositorioStorage.guardarCuentasActivas(nuevasCuentas);
        servicioSupabase.guardarCuentas(nuevasCuentas).catch((err: unknown) => {
          console.error('[RestauranteContext] Error al actualizar cuenta remota tras renombrar:', err);
        });
      }

      // 3. Si hay pedidos de cocina de esta mesa, actualizar nombreMesa
      setPedidosCocina((prev) => {
        const actualizados = prev.map((p) =>
          p.mesaId === mesaId ? { ...p, nombreMesa: nombreLimpio } : p
        );
        RepositorioStorage.guardarPedidosCocina(actualizados);
        actualizados
          .filter((p) => p.mesaId === mesaId && p.estado !== 'entregado')
          .forEach((p) => {
            servicioSupabase.guardarPedidoCocina(p).catch((err: unknown) => {
              console.error('[RestauranteContext] Error al actualizar pedido cocina remoto tras renombrar:', err);
            });
          });
        return actualizados;
      });

      // 4. Emitir sincronización en tiempo real
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: saneadas,
        cuentasActivas: nuevasCuentas,
      });

      // 5. Guardar en Supabase
      servicioSupabase.guardarMesas(saneadas).catch((err: unknown) => {
        console.error('[RestauranteContext] Error al guardar mesas remotas tras renombrar:', err);
      });

      return {
        exito: true,
        mensaje: `Nombre actualizado a "${nombreLimpio}" exitosamente.`,
      };
    },
    [mesas, cuentasActivas]
  );

  const moverMesa = useCallback(
    (mesaOrigenId: string, mesaDestinoId: string): { exito: boolean; mensaje: string } => {
      if (mesaOrigenId === mesaDestinoId) {
        return { exito: false, mensaje: 'La mesa origen y destino no pueden ser la misma.' };
      }

      const mesaOrigen = mesas.find((m) => m.id === mesaOrigenId);
      if (!mesaOrigen) {
        return { exito: false, mensaje: 'No se encontró la mesa de origen.' };
      }

      if (mesaOrigen.estado === 'libre' || !mesaOrigen.cuentaActivaId) {
        return { exito: false, mensaje: `"${mesaOrigen.nombre}" se encuentra libre y no tiene comanda para mover.` };
      }

      const mesaDestino = mesas.find((m) => m.id === mesaDestinoId);
      if (!mesaDestino) {
        return { exito: false, mensaje: 'No se encontró la mesa de destino.' };
      }

      if (mesaDestino.estado !== 'libre' || mesaDestino.cuentaActivaId) {
        return {
          exito: false,
          mensaje: `La mesa "${mesaDestino.nombre}" no está libre (está ${mesaDestino.estado}). Selecciona una mesa libre.`,
        };
      }

      const idCuenta = mesaOrigen.cuentaActivaId;
      const cuentaActual = cuentasActivas[idCuenta];
      if (!cuentaActual) {
        return { exito: false, mensaje: 'No se localizó la comanda activa de la mesa de origen.' };
      }

      // 1. Actualizar la cuenta para asociarla a la nueva mesa
      const cuentaActualizada: Cuenta = {
        ...cuentaActual,
        mesaId: mesaDestino.id,
        numeroMesa: mesaDestino.numero,
        nombreMesa: mesaDestino.nombre,
      };

      const nuevasCuentas: Record<string, Cuenta> = {
        ...cuentasActivas,
        [idCuenta]: cuentaActualizada,
      };
      setCuentasActivas(nuevasCuentas);
      RepositorioStorage.guardarCuentasActivas(nuevasCuentas);

      // 2. Actualizar estado de las mesas
      const nuevasMesas = mesas.map((m) => {
        if (m.id === mesaOrigen.id) {
          return {
            ...m,
            estado: 'libre' as EstadoMesa,
            cuentaActivaId: null,
            horaApertura: null,
            totalParcial: 0,
            meseroAsignado: undefined,
          };
        }
        if (m.id === mesaDestino.id) {
          return {
            ...m,
            estado: mesaOrigen.estado,
            cuentaActivaId: idCuenta,
            horaApertura: mesaOrigen.horaApertura,
            totalParcial: mesaOrigen.totalParcial,
            meseroAsignado: mesaOrigen.meseroAsignado,
          };
        }
        return m;
      });

      const saneadas = deduplicarYSanearMesas(nuevasMesas);
      setMesas(saneadas);
      RepositorioStorage.guardarMesas(saneadas);

      // 3. Actualizar pedidos de cocina para que reflejen la nueva mesa
      const pedidosModificados: PedidoCocina[] = [];
      setPedidosCocina((prev) => {
        const actualizados = prev.map((p) => {
          if (p.mesaId === mesaOrigen.id || p.comandaId === idCuenta) {
            const modificado: PedidoCocina = {
              ...p,
              mesaId: mesaDestino.id,
              nombreMesa: mesaDestino.nombre,
            };
            pedidosModificados.push(modificado);
            return modificado;
          }
          return p;
        });
        RepositorioStorage.guardarPedidosCocina(actualizados);
        return actualizados;
      });

      // 4. Si la mesa de origen estaba seleccionada, cambiar la selección a la mesa de destino
      if (mesaSeleccionadaId === mesaOrigen.id) {
        setMesaSeleccionadaId(mesaDestino.id);
      }

      // 5. Emitir sincronización en tiempo real
      servicioSincronizacion.emitir('MESA_ACTUALIZADA', {
        mesas: saneadas,
        cuentasActivas: nuevasCuentas,
      });

      // 6. Sincronizar en Supabase
      servicioSupabase.liberarMesaRemota(mesaOrigen.id, mesaOrigen.numero).catch((err: unknown) => {
        console.error('[RestauranteContext] Error al liberar mesa remota origen tras mover:', err);
      });
      servicioSupabase.guardarMesas(saneadas).catch((err: unknown) => {
        console.error('[RestauranteContext] Error al guardar mesas remotas tras mover:', err);
      });
      servicioSupabase.guardarCuentas(nuevasCuentas).catch((err: unknown) => {
        console.error('[RestauranteContext] Error al guardar cuentas remotas tras mover:', err);
      });
      for (const ped of pedidosModificados) {
        servicioSupabase.guardarPedidoCocina(ped).catch((err: unknown) => {
          console.error('[RestauranteContext] Error al actualizar pedido cocina remoto tras mover:', err);
        });
      }

      return {
        exito: true,
        mensaje: `Comanda movida exitosamente de "${mesaOrigen.nombre}" a "${mesaDestino.nombre}".`,
      };
    },
    [mesas, cuentasActivas, mesaSeleccionadaId]
  );

  const imprimirTicket = useCallback(
    (tipo: 'cocina' | 'cliente', cuentaEspecifica?: Cuenta): void => {
      const cuentaAImprimir = cuentaEspecifica ?? cuentaActiva;
      if (!cuentaAImprimir) return;
      setTicketImpresion({ cuenta: cuentaAImprimir, tipo });
    },
    [cuentaActiva]
  );

  const cerrarTicketImpresion = useCallback((): void => {
    setTicketImpresion(null);
  }, []);

  const reiniciarTurnoActual = useCallback(
    (pinIngresado: string): boolean => {
      if (pinIngresado !== corteActual.pinSeguridad) {
        return false;
      }
      // 1. Archivar el turno cerrado y generar nuevo corte limpio
      const { nuevoCorte, turnoCerrado } = RepositorioStorage.archivarTurnoYCerrar(
        corteActual,
        cuentasCerradas,
        pinIngresado,
        pedidosCocina
      );

      setCorteActual(nuevoCorte);
      setHistorialTurnos((prev) => [turnoCerrado, ...prev.filter((t) => t.id !== turnoCerrado.id)]);
      setCuentasCerradas([]);
      setPedidosCocina([]);
      RepositorioStorage.guardarPedidosCocina([]);

      // 2. Reiniciar integralmente todas las ventas: liberar mesas a 'libre' y vaciar cuentas activas
      const mesasLiberadas = mesas.map((m) => ({
        ...m,
        estado: 'libre' as EstadoMesa,
        cuentaActivaId: null,
        horaApertura: null,
        totalParcial: 0,
        meseroAsignado: undefined,
      }));
      const mesasSaneadas = deduplicarYSanearMesas(mesasLiberadas);
      setMesas(mesasSaneadas);
      RepositorioStorage.guardarMesas(mesasSaneadas);

      const cuentasVacias: Record<string, Cuenta> = {};
      setCuentasActivas(cuentasVacias);
      RepositorioStorage.guardarCuentasActivas(cuentasVacias);
      setMesaSeleccionadaId(null);

      // 3. Emitir evento TURNO_REINICIADO a todas las terminales
      servicioSincronizacion.emitir('TURNO_REINICIADO', {
        corteActual: nuevoCorte,
        turnoCerrado,
        mesas: mesasSaneadas,
        cuentasActivas: cuentasVacias,
      });

      // 4. Persistir estado limpio en Supabase
      servicioSupabase.guardarCorte(turnoCerrado).catch(console.error);
      servicioSupabase.guardarCorte(nuevoCorte).catch(console.error);
      servicioSupabase.guardarMesas(mesasSaneadas).catch(console.error);
      servicioSupabase.cancelarTodasLasCuentasAbiertasRemotas().catch(console.error);
      servicioSupabase.cancelarTodosLosPedidosCocinaPendientesRemotos().catch(console.error);
      setTicketImpresion(null);

      return true;
    },
    [corteActual, cuentasCerradas, mesas, pedidosCocina]
  );

  const value = useMemo<RestauranteContextType>(
    () => ({
      mesas,
      mesaSeleccionada,
      cuentaActiva,
      corteActual,
      cuentasCerradas,
      historialTurnos,
      pedidosCocina: pedidosCocinaExpuestos,
      productos,
      vistaActual,
      estaEnLinea,
      dispositivosConectados,
      ticketImpresion,
      meseroActual,
      tema,
      nivelOroLiquido,
      parametrosOro,
      setNivelOroLiquido,
      alternarTema,
      setVistaActual,
      setMeseroActual,
      seleccionarMesa,
      abrirMesa,
      cambiarEstadoMesa,
      agregarProductoAComanda,
      agregarProducto,
      editarProducto,
      eliminarProducto,
      restablecerProductos,
      modificarCantidadItem,
      eliminarItemComanda,
      solicitarCuenta,
      cerrarYCobrarCuenta,
      liberarMesaManual,
      cambiarNombreMesa,
      moverMesa,
      agregarMesa,
      eliminarMesa,
      agregarDomicilio,
      eliminarDomicilio,
      imprimirTicket,
      cerrarTicketImpresion,
      reiniciarTurnoActual,
      cargarHistorialTurnos,
      enviarComandaACocina,
      cambiarEstadoPedidoCocina,
      alternarItemCompletadoCocina,
      pasoTutorialDemo,
      setPasoTutorialDemo,
      notificacionesCocina,
      descartarNotificacionCocina,
    }),
    [
      mesas,
      mesaSeleccionada,
      cuentaActiva,
      corteActual,
      cuentasCerradas,
      historialTurnos,
      pedidosCocinaExpuestos,
      productos,
      vistaActual,
      estaEnLinea,
      dispositivosConectados,
      ticketImpresion,
      meseroActual,
      tema,
      nivelOroLiquido,
      parametrosOro,
      setNivelOroLiquido,
      alternarTema,
      seleccionarMesa,
      abrirMesa,
      cambiarEstadoMesa,
      agregarProductoAComanda,
      agregarProducto,
      editarProducto,
      eliminarProducto,
      restablecerProductos,
      modificarCantidadItem,
      eliminarItemComanda,
      solicitarCuenta,
      cerrarYCobrarCuenta,
      liberarMesaManual,
      cambiarNombreMesa,
      moverMesa,
      agregarMesa,
      eliminarMesa,
      agregarDomicilio,
      eliminarDomicilio,
      imprimirTicket,
      cerrarTicketImpresion,
      reiniciarTurnoActual,
      cargarHistorialTurnos,
      enviarComandaACocina,
      cambiarEstadoPedidoCocina,
      alternarItemCompletadoCocina,
      pasoTutorialDemo,
      setPasoTutorialDemo,
      notificacionesCocina,
      descartarNotificacionCocina,
    ]
  );

  return <RestauranteContext.Provider value={value}>{children}</RestauranteContext.Provider>;
};

export const useRestaurante = (): RestauranteContextType => {
  const context = useContext(RestauranteContext);
  if (!context) {
    throw new Error('useRestaurante debe ser utilizado dentro de un RestauranteProvider');
  }
  return context;
};
