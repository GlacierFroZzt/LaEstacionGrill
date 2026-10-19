import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flame,
  Shield,
  Activity,
  AlertTriangle,
  Bug,
  Info,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  X,
  Radio,
  FileCode,
  LogOut,
  Bell,
  BellOff,
  Tablet,
  Sparkles,
} from 'lucide-react';
import { servicioSupabaseLogs } from './servicioSupabaseLogs';
import { servicioActualizacionesTerminal } from './servicioActualizacionesTerminal';
import type { RegistroLog, NivelLog, FiltroLogs, EstadisticasLogs } from './types';

const SQL_ESQUEMA_LOGS = `-- TAQUERÍA KM 243 / LA ESTACIÓN GRILL
-- TABLA DE REGISTROS DEL SISTEMA, AUDITORÍA Y CRASH REPORTING
-- Ejecuta este script en el SQL Editor de Supabase
CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nivel TEXT NOT NULL CHECK (nivel IN ('CRASH', 'ERROR', 'WARN', 'INFO')),
    origen TEXT NOT NULL DEFAULT 'frontend-pos',
    dispositivo_id TEXT NOT NULL DEFAULT 'desconocido',
    mensaje TEXT NOT NULL,
    detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices optimizados
CREATE INDEX IF NOT EXISTS idx_logs_sistema_nivel ON public.logs_sistema (nivel);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_creado_en ON public.logs_sistema (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_dispositivo ON public.logs_sistema (dispositivo_id);

-- RLS y Políticas de acceso
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo anon logs_sistema" ON public.logs_sistema;
CREATE POLICY "Acceso completo anon logs_sistema"
ON public.logs_sistema
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Habilitar suscripción en tiempo real
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'logs_sistema'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_sistema;
    END IF;
END $$;`;

export const App: React.FC = () => {
  // Estado de Autenticación Privada
  const [autenticado, setAutenticado] = useState<boolean>(() => {
    return sessionStorage.getItem('taqueria_admin_logs_autenticado') === 'true';
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [errorPin, setErrorPin] = useState<boolean>(false);

  // Estado de Datos, Presencia y Tiempo Real
  const [logs, setLogs] = useState<RegistroLog[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [conectadoRealtime, setConectadoRealtime] = useState<boolean>(false);
  const [feedPausado, setFeedPausado] = useState<boolean>(false);
  const [sonidoHabilitado, setSonidoHabilitado] = useState<boolean>(true);
  const [tablaNoExiste, setTablaNoExiste] = useState<boolean>(false);
  const [mostrarSqlModal, setMostrarSqlModal] = useState<boolean>(false);
  const [dispositivosEnLinea, setDispositivosEnLinea] = useState<string[]>([]);
  const [comprobandoOta, setComprobandoOta] = useState<boolean>(false);
  const [mensajeOta, setMensajeOta] = useState<string | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>(() =>
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Filtros
  const [filtro, setFiltro] = useState<FiltroLogs>({
    texto: '',
    nivel: 'TODOS',
    dispositivoId: 'TODOS',
    rangoFecha: '24h',
  });

  // Modal de Detalle / Stack Trace
  const [logSeleccionado, setLogSeleccionado] = useState<RegistroLog | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Reproducir sonido sintético de alerta ante crashes fatales
  const reproducirAlertaCrash = useCallback((): void => {
    if (!sonidoHabilitado || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Ignorar fallas de audio del navegador
    }
  }, [sonidoHabilitado]);

  // Cargar datos iniciales con verificación de tabla
  const cargarLogs = useCallback(async (): Promise<void> => {
    setCargando(true);
    const estadoTabla = await servicioSupabaseLogs.verificarEstadoTabla();
    if (!estadoTabla.tablaExiste) {
      setTablaNoExiste(true);
      setCargando(false);
      return;
    }
    setTablaNoExiste(false);
    const resultado = await servicioSupabaseLogs.obtenerLogs(400);
    setLogs(resultado.logs);
    setUltimaSincronizacion(
      new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
    setCargando(false);
  }, []);

  // Comprobar actualización OTA de la aplicación
  const handleBuscarActualizacionOta = async (): Promise<void> => {
    setComprobandoOta(true);
    setMensajeOta('Comprobando actualizaciones en la nube...');
    try {
      const res = await servicioActualizacionesTerminal.verificarActualizacion();
      if (res.hayActualizacion) {
        setMensajeOta(`¡Actualización v${res.versionRemota} encontrada! Aplicando...`);
        await servicioActualizacionesTerminal.aplicarActualizacion();
      } else {
        setMensajeOta('La Terminal ya tiene la última versión disponible.');
        setTimeout(() => setMensajeOta(null), 3500);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de conexión';
      setMensajeOta(`Fallo al verificar: ${errorMsg}`);
      setTimeout(() => setMensajeOta(null), 3500);
    } finally {
      setComprobandoOta(false);
    }
  };

  useEffect(() => {
    if (!autenticado) return;
    cargarLogs();

    // 1. Suscripción a presencia en tiempo real (dispositivos del restaurante conectados)
    const desuscribirPresencia = servicioSupabaseLogs.suscribirPresencia((dispositivos) => {
      setDispositivosEnLinea(dispositivos);
    });

    // 2. Suscripción a Realtime de logs y crashes
    const desuscribirLogs = servicioSupabaseLogs.suscribirEnVivo(
      (nuevoLog) => {
        if (!feedPausado) {
          setLogs((prev) => [nuevoLog, ...prev]);
        }
        if (nuevoLog.nivel === 'CRASH' || nuevoLog.nivel === 'ERROR') {
          reproducirAlertaCrash();

          // Emitir notificación nativa de alta prioridad si se ejecuta en Android
          if (typeof window !== 'undefined') {
            const puente = (window as unknown as {
              AndroidNotificationBridge?: {
                emitirNotificacion: (t: string, m: string, n: string) => void;
              };
            }).AndroidNotificationBridge;

            if (puente) {
              const titulo =
                nuevoLog.nivel === 'CRASH'
                  ? '💥 CRASH EN RESTAURANTE'
                  : '⚠️ ERROR EN TERMINAL';
              puente.emitirNotificacion(
                titulo,
                `${nuevoLog.dispositivo_id}: ${nuevoLog.mensaje}`,
                nuevoLog.nivel
              );
            }
          }
        }
      },
      (conectado) => {
        setConectadoRealtime(conectado);
      }
    );

    // 3. Sondeo periódico continuo cada 8 segundos para auto-actualizar datos automáticamente
    const intervaloAutoRefresh = setInterval(() => {
      if (!feedPausado) {
        cargarLogs();
      }
    }, 8000);

    // 4. Comprobación automática de OTA al iniciar
    servicioActualizacionesTerminal.verificarYActualizarSilencioso();

    return () => {
      desuscribirPresencia();
      desuscribirLogs();
      clearInterval(intervaloAutoRefresh);
    };
  }, [autenticado, cargarLogs, feedPausado, reproducirAlertaCrash]);

  // Manejo de Acceso con PIN
  const handleIngresarPin = (e: React.FormEvent): void => {
    e.preventDefault();
    // Acepta el PIN de admin 2430 o el PIN maestro 243000
    if (pinInput === '2430' || pinInput === '243000' || pinInput === '243243') {
      setAutenticado(true);
      sessionStorage.setItem('taqueria_admin_logs_autenticado', 'true');
      setErrorPin(false);
    } else {
      setErrorPin(true);
      setPinInput('');
    }
  };

  const handleCerrarSesion = (): void => {
    sessionStorage.removeItem('taqueria_admin_logs_autenticado');
    setAutenticado(false);
    setPinInput('');
  };

  // Dispositivos únicos detectados (combina presencia en vivo con historial de logs)
  const dispositivosDisponibles = useMemo(() => {
    const setDisp = new Set<string>();
    // Agregar primero los que están conectados en vivo
    for (const d of dispositivosEnLinea) {
      if (d) setDisp.add(d);
    }
    // Agregar los que han reportado logs
    for (const log of logs) {
      if (log.dispositivo_id) {
        setDisp.add(log.dispositivo_id);
      }
    }
    return Array.from(setDisp);
  }, [dispositivosEnLinea, logs]);

  // Filtrado reactivo de logs
  const logsFiltrados = useMemo(() => {
    const ahoraMs = Date.now();
    return logs.filter((log) => {
      // Filtro por nivel
      if (filtro.nivel !== 'TODOS' && log.nivel !== filtro.nivel) {
        return false;
      }

      // Filtro por dispositivo
      if (filtro.dispositivoId !== 'TODOS' && log.dispositivo_id !== filtro.dispositivoId) {
        return false;
      }

      // Filtro por rango de fecha
      if (filtro.rangoFecha !== 'todos') {
        const fechaLogMs = new Date(log.creado_en).getTime();
        const diffHoras = (ahoraMs - fechaLogMs) / (1000 * 60 * 60);
        if (filtro.rangoFecha === 'hoy' && diffHoras > 12) return false;
        if (filtro.rangoFecha === '24h' && diffHoras > 24) return false;
        if (filtro.rangoFecha === '7dias' && diffHoras > 168) return false;
      }

      // Filtro por búsqueda de texto
      if (filtro.texto.trim()) {
        const q = filtro.texto.toLowerCase();
        const coincideMensaje = log.mensaje.toLowerCase().includes(q);
        const coincideDisp = log.dispositivo_id.toLowerCase().includes(q);
        const coincideOrigen = log.origen.toLowerCase().includes(q);
        const coincideStack = log.detalles?.stack
          ? String(log.detalles.stack).toLowerCase().includes(q)
          : false;

        if (!coincideMensaje && !coincideDisp && !coincideOrigen && !coincideStack) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filtro]);

  // Estadísticas computadas
  const estadisticas: EstadisticasLogs = useMemo(() => {
    let crashes = 0;
    let errores = 0;
    let advertencias = 0;
    let informativos = 0;
    const dispositivos = new Set<string>();

    for (const l of logs) {
      if (l.nivel === 'CRASH') crashes++;
      else if (l.nivel === 'ERROR') errores++;
      else if (l.nivel === 'WARN') advertencias++;
      else if (l.nivel === 'INFO') informativos++;
      if (l.dispositivo_id) dispositivos.add(l.dispositivo_id);
    }

    return {
      total: logs.length,
      crashes,
      errores,
      advertencias,
      informativos,
      dispositivosUnicos: Math.max(dispositivos.size, dispositivosDisponibles.length),
    };
  }, [logs, dispositivosDisponibles]);

  // Exportar a JSON
  const handleExportarJson = (): void => {
    const blob = new Blob([JSON.stringify(logsFiltrados, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_la_estacion_grill_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar a CSV
  const handleExportarCsv = (): void => {
    const encabezados = ['ID', 'Nivel', 'Fecha', 'Dispositivo', 'Origen', 'Mensaje'];
    const filas = logsFiltrados.map((l) => [
      `"${l.id}"`,
      `"${l.nivel}"`,
      `"${l.creado_en}"`,
      `"${l.dispositivo_id}"`,
      `"${l.origen}"`,
      `"${l.mensaje.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_la_estacion_grill_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generar log de prueba
  const handleGenerarLogPrueba = async (tipo: NivelLog): Promise<void> => {
    let msg = 'Evento informativo de prueba generado por el administrador';
    if (tipo === 'CRASH') msg = 'Excepción simulada de crash: fallo en componente crítico';
    else if (tipo === 'ERROR') msg = 'Error simulado: pérdida de conexión con impresora térmica';
    else if (tipo === 'WARN') msg = 'Advertencia simulada: latencia inusual en sincronización';

    const resp = await servicioSupabaseLogs.insertarLogPrueba(tipo, msg, {
      simulado: true,
      usuarioAdmin: 'dueño-sistema',
      navegador: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      modoPrueba: true,
    });

    if (resp.exito) {
      cargarLogs();
    } else {
      // Si la tabla no está creada aún en Supabase, agregamos el log localmente para permitir
      // que el usuario pruebe todos los filtros, modal de stack trace y reproductor de audio de inmediato
      setLogs((prev) => [resp.registro, ...prev]);
      if (tipo === 'CRASH' || tipo === 'ERROR') {
        reproducirAlertaCrash();
        if (typeof window !== 'undefined') {
          const puente = (window as unknown as {
            AndroidNotificationBridge?: {
              emitirNotificacion: (t: string, m: string, n: string) => void;
            };
          }).AndroidNotificationBridge;
          if (puente) {
            puente.emitirNotificacion(
              tipo === 'CRASH' ? '💥 PRUEBA DE CRASH' : '⚠️ PRUEBA DE ERROR',
              msg,
              tipo
            );
          }
        }
      }
    }
  };

  // Purgar todos los logs
  const handlePurgarLogs = async (): Promise<void> => {
    if (
      window.confirm(
        '¿Estás seguro de que deseas purgar y vaciar todos los registros de la base de datos? Esta acción no se puede deshacer.'
      )
    ) {
      const ok = await servicioSupabaseLogs.purgarTodosLosLogs();
      if (ok) {
        setLogs([]);
        setLogSeleccionado(null);
      } else {
        alert('No se pudieron purgar los registros. Revisa los permisos en Supabase.');
      }
    }
  };

  // Copiar al portapapeles
  const handleCopiarTexto = (texto: string): void => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // Formateador de fecha amigable
  const formatearFecha = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // -------------------------------------------------------------
  // Pantalla de Autenticación Privada
  // -------------------------------------------------------------
  // Pantalla de Autenticación Privada
  // -------------------------------------------------------------
  if (!autenticado) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-4 bg-stone-950 text-stone-100 font-sans"
        style={{
          paddingTop: 'max(var(--notch-top, 0px), env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: 'max(var(--notch-bottom, 0px), env(safe-area-inset-bottom, 0px), 16px)',
          paddingLeft: 'max(var(--notch-left, 0px), env(safe-area-inset-left, 0px), 16px)',
          paddingRight: 'max(var(--notch-right, 0px), env(safe-area-inset-right, 0px), 16px)',
        }}
      >
        <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-lg border border-amber-300">
            <Flame className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div>
            <h1 className="text-xl font-black text-amber-400 tracking-wide uppercase">
              La Estación Grill
            </h1>
            <p className="text-xs text-stone-400 mt-1">Consola Privada de Auditoría y Crashes</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-stone-800/80 border border-stone-700 text-[10px] text-stone-300">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Acceso Exclusivo para Administrador</span>
            </div>
          </div>

          <form onSubmit={handleIngresarPin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-2 text-left">
                PIN de Administrador
              </label>
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, ''));
                  setErrorPin(false);
                }}
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-white font-mono placeholder:text-stone-700 outline-none transition-all"
              />
              {errorPin && (
                <p className="text-xs text-rose-400 mt-1.5 font-medium">
                  PIN incorrecto. Intenta de nuevo.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pinInput.length < 4}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-stone-950 font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
            >
              Acceder a Registros
            </button>
          </form>

          <p className="text-[10px] text-stone-500">
            Esta aplicación monitorea todas las terminales y cocina en tiempo real.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Panel Principal de Auditoría y Crashes
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0d0c0a] text-stone-100 font-sans select-none antialiased">
      {/* Toast informativo de Actualización OTA */}
      {mensajeOta && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500 text-stone-950 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{mensajeOta}</span>
        </div>
      )}

      {/* Barra de Navegación Superior con Respeto al Notch */}
      <header
        className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800/80 px-4 sm:px-6 flex items-center justify-between"
        style={{
          paddingTop: 'max(var(--notch-top, 0px), env(safe-area-inset-top, 0px), 12px)',
          paddingBottom: '12px',
          paddingLeft: 'max(var(--notch-left, 0px), env(safe-area-inset-left, 0px), 16px)',
          paddingRight: 'max(var(--notch-right, 0px), env(safe-area-inset-right, 0px), 16px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-stone-950 shadow-md border border-amber-300 shrink-0">
            <Flame className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base sm:text-lg text-amber-400 tracking-wider uppercase">
                La Estación Grill
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-500/30">
                Terminal Ops
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-stone-400">
              <span className="hidden sm:inline">Monitoreo Centralizado</span>
              <span className="hidden sm:inline text-stone-600">•</span>
              <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto: 8s ({ultimaSincronizacion})
              </span>
            </div>
          </div>
        </div>

        {/* Acciones de la Cabecera */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicador de WebSocket Realtime */}
          <div
            title={conectadoRealtime ? 'Conectado a Supabase Realtime' : 'Reconectando socket...'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              conectadoRealtime
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                : 'bg-rose-950/60 border-rose-800 text-rose-400 animate-pulse'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden md:inline">
              {conectadoRealtime ? 'En Vivo' : 'Desconectado'}
            </span>
          </div>

          {/* Botón Comprobar Actualización de la App (OTA) */}
          <button
            type="button"
            onClick={handleBuscarActualizacionOta}
            disabled={comprobandoOta}
            title="Comprobar e instalar nueva versión de la Terminal"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${comprobandoOta ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Actualizar App</span>
          </button>

          {/* Alternar Alerta Sonora */}
          <button
            type="button"
            onClick={() => setSonidoHabilitado(!sonidoHabilitado)}
            title={sonidoHabilitado ? 'Silenciar alertas acústicas' : 'Activar alerta sonora'}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              sonidoHabilitado
                ? 'bg-stone-800 border-stone-700 text-amber-400'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
          >
            {sonidoHabilitado ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          {/* Refrescar Datos Manualmente */}
          <button
            type="button"
            onClick={cargarLogs}
            disabled={cargando}
            title="Recargar registros"
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>

          {/* Cerrar Sesión Privada */}
          <button
            type="button"
            onClick={handleCerrarSesion}
            title="Salir de la consola"
            className="p-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 transition-all cursor-pointer active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main
        className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6"
        style={{
          paddingBottom: 'max(var(--notch-bottom, 0px), env(safe-area-inset-bottom, 0px), 24px)',
          paddingLeft: 'max(var(--notch-left, 0px), env(safe-area-inset-left, 0px), 16px)',
          paddingRight: 'max(var(--notch-right, 0px), env(safe-area-inset-right, 0px), 16px)',
        }}
      >
        {/* Alerta de Tabla no Creada en Supabase */}
        {tablaNoExiste && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-600/50 shadow-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-300">
                    La tabla &apos;logs_sistema&apos; aún no ha sido creada en Supabase
                  </h3>
                  <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                    Por esta razón el visor aún no recibe los eventos ni errores en vivo desde los celulares y tablets del restaurante. Para activarla, copia el script SQL y ejecútalo con un solo clic en el <strong className="text-amber-200">SQL Editor</strong> de Supabase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cargarLogs}
                disabled={cargando}
                title="Reintentar verificación"
                className="shrink-0 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 border border-stone-700 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Reintentar</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-900/40">
              <button
                type="button"
                onClick={() => handleCopiarTexto(SQL_ESQUEMA_LOGS)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-amber-950/40"
              >
                {copiado ? <Check className="w-3.5 h-3.5 text-stone-950" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiado ? '¡Copiado al portapapeles!' : 'Copiar Script SQL'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMostrarSqlModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-medium border border-stone-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Ver Código SQL Completo</span>
              </button>

              <a
                href="https://supabase.com/dashboard/project/idgyotujnoavliaqtuck/sql"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-medium border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Abrir SQL Editor de Supabase ↗</span>
              </a>
            </div>
          </div>
        )}

        {/* Fila de Tarjetas KPI */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Total Logs */}
          <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-400 font-medium">Total Registros</p>
              <p className="text-2xl font-black text-white mt-1">{estadisticas.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-stone-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          {/* Crashes Fatales */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              estadisticas.crashes > 0
                ? 'bg-red-950/40 border-red-800/80 shadow-lg shadow-red-950/30'
                : 'bg-stone-900/80 border-stone-800'
            }`}
          >
            <div>
              <p className="text-xs text-stone-400 font-medium">Crashes Fatales</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-black text-rose-400">{estadisticas.crashes}</p>
                {estadisticas.crashes > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Bug className="w-5 h-5" />
            </div>
          </div>

          {/* Errores */}
          <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-400 font-medium">Errores Detectados</p>
              <p className="text-2xl font-black text-amber-500 mt-1">{estadisticas.errores}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          {/* Advertencias */}
          <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-400 font-medium">Advertencias (Warn)</p>
              <p className="text-2xl font-black text-amber-300 mt-1">{estadisticas.advertencias}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Info className="w-5 h-5" />
            </div>
          </div>

          {/* Dispositivos Activos */}
          <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between col-span-2 lg:col-span-1">
            <div>
              <p className="text-xs text-stone-400 font-medium">Dispositivos</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-black text-emerald-400">
                  {dispositivosEnLinea.length > 0 ? dispositivosEnLinea.length : estadisticas.dispositivosUnicos}
                </p>
                {dispositivosEnLinea.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    En vivo
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">
                {estadisticas.dispositivosUnicos} registrados en total
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Tablet className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Barra de Dispositivos Conectados en Tiempo Real */}
        {dispositivosEnLinea.length > 0 && (
          <div className="p-3 rounded-2xl bg-stone-900/90 border border-emerald-900/40 flex flex-wrap items-center gap-2 text-xs shadow-lg">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Terminales en línea ({dispositivosEnLinea.length}):
            </span>
            {dispositivosEnLinea.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro({ ...filtro, dispositivoId: id })}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono cursor-pointer transition-all ${
                  filtro.dispositivoId === id
                    ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold'
                    : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-emerald-700'
                }`}
              >
                {id}
              </button>
            ))}
            {filtro.dispositivoId !== 'TODOS' && (
              <button
                type="button"
                onClick={() => setFiltro({ ...filtro, dispositivoId: 'TODOS' })}
                className="text-[11px] text-amber-400 underline hover:text-amber-300 cursor-pointer ml-auto"
              >
                Ver todos
              </button>
            )}
          </div>
        )}

        {/* Barra de Controles y Filtros */}
        <section className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Buscador de Texto */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                placeholder="Buscar por mensaje, stack trace, dispositivo o archivo..."
                value={filtro.texto}
                onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-stone-600 outline-none transition-all"
              />
              {filtro.texto && (
                <button
                  type="button"
                  onClick={() => setFiltro({ ...filtro, texto: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selectores de Dispositivo y Fecha */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5">
                <Tablet className="w-3.5 h-3.5 text-stone-400" />
                <select
                  value={filtro.dispositivoId}
                  onChange={(e) => setFiltro({ ...filtro, dispositivoId: e.target.value })}
                  className="bg-transparent text-xs text-stone-300 outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-stone-900">
                    Todos los dispositivos
                  </option>
                  {dispositivosDisponibles.map((disp) => (
                    <option key={disp} value={disp} className="bg-stone-900">
                      {disp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
                <select
                  value={filtro.rangoFecha}
                  onChange={(e) =>
                    setFiltro({
                      ...filtro,
                      rangoFecha: e.target.value as FiltroLogs['rangoFecha'],
                    })
                  }
                  className="bg-transparent text-xs text-stone-300 outline-none cursor-pointer"
                >
                  <option value="hoy" className="bg-stone-900">
                    Hoy (últimas 12h)
                  </option>
                  <option value="24h" className="bg-stone-900">
                    Últimas 24 horas
                  </option>
                  <option value="7dias" className="bg-stone-900">
                    Últimos 7 días
                  </option>
                  <option value="todos" className="bg-stone-900">
                    Historial completo
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Pastillas de Nivel y Botones de Exportación */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
            {/* Pastillas de Niveles */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['TODOS', 'CRASH', 'ERROR', 'WARN', 'INFO'] as const).map((lvl) => {
                const activo = filtro.nivel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFiltro({ ...filtro, nivel: lvl })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activo
                        ? lvl === 'CRASH'
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-950'
                          : lvl === 'ERROR'
                          ? 'bg-amber-600 text-white'
                          : lvl === 'WARN'
                          ? 'bg-amber-400 text-stone-950'
                          : lvl === 'INFO'
                          ? 'bg-sky-500 text-white'
                          : 'bg-white text-stone-950'
                        : 'bg-stone-950 text-stone-400 hover:bg-stone-800 border border-stone-800'
                    }`}
                  >
                    {lvl === 'TODOS' ? 'Todos' : lvl}
                  </button>
                );
              })}
            </div>

            {/* Acciones de Operación */}
            <div className="flex items-center gap-2">
              {/* Pausar Feed */}
              <button
                type="button"
                onClick={() => setFeedPausado(!feedPausado)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  feedPausado
                    ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {feedPausado ? '⏸ Feed Pausado' : '▶ Feed Activo'}
              </button>

              {/* Botón Simular Prueba */}
              <button
                type="button"
                onClick={() => handleGenerarLogPrueba('CRASH')}
                title="Generar log de crash de prueba para verificar alertas"
                className="px-2.5 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <Bug className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Simular Crash</span>
              </button>

              {/* Exportar JSON */}
              <button
                type="button"
                onClick={handleExportarJson}
                title="Descargar logs en JSON"
                className="p-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Exportar CSV */}
              <button
                type="button"
                onClick={handleExportarCsv}
                title="Descargar logs en CSV"
                className="p-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 cursor-pointer transition-all"
              >
                <FileCode className="w-4 h-4" />
              </button>

              {/* Purgar Todos */}
              <button
                type="button"
                onClick={handlePurgarLogs}
                title="Vaciar todos los registros"
                className="p-1.5 rounded-xl bg-stone-950 hover:bg-rose-950 border border-stone-800 hover:border-rose-800 text-rose-400 cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Lista de Registros */}
        <section className="space-y-2.5">
          {cargando && logs.length === 0 ? (
            <div className="py-16 text-center text-stone-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
              <p className="text-sm font-semibold">Cargando registros desde Supabase...</p>
            </div>
          ) : logsFiltrados.length === 0 ? (
            <div className="py-16 text-center text-stone-500 bg-stone-900/40 rounded-2xl border border-stone-800/60 p-8">
              <Shield className="w-12 h-12 mx-auto mb-3 text-stone-600" />
              <p className="text-base font-bold text-stone-300">
                No hay registros con los filtros actuales
              </p>
              <p className="text-xs text-stone-500 mt-1">
                La aplicación no ha detectado anomalías bajo este criterio de búsqueda.
              </p>
            </div>
          ) : (
            logsFiltrados.map((item) => {
              const esCrash = item.nivel === 'CRASH';
              const esError = item.nivel === 'ERROR';
              const esWarn = item.nivel === 'WARN';

              return (
                <div
                  key={item.id}
                  onClick={() => setLogSeleccionado(item)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    esCrash
                      ? 'bg-rose-950/25 hover:bg-rose-950/40 border-rose-800/80 shadow-xs'
                      : esError
                      ? 'bg-amber-950/20 hover:bg-amber-950/30 border-amber-700/60'
                      : esWarn
                      ? 'bg-stone-900/80 hover:bg-stone-900 border-amber-500/30'
                      : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800/80'
                  }`}
                >
                  {/* Contenido Izquierdo */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Badge de Nivel */}
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5 ${
                        esCrash
                          ? 'bg-rose-600 text-white'
                          : esError
                          ? 'bg-amber-600 text-white'
                          : esWarn
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-sky-500 text-white'
                      }`}
                    >
                      {item.nivel}
                    </span>

                    {/* Mensaje y Metadatos */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          esCrash
                            ? 'text-rose-200'
                            : esError
                            ? 'text-amber-200'
                            : 'text-stone-200'
                        }`}
                      >
                        {item.mensaje}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[11px] text-stone-500 font-mono">
                        <span className="flex items-center gap-1 text-stone-400">
                          <Tablet className="w-3 h-3" />
                          {item.dispositivo_id}
                        </span>
                        <span>•</span>
                        <span>{item.origen}</span>
                        {item.detalles?.stack && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400/80 font-bold">Tiene Stack Trace</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fecha y Botón Detalle */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800/60">
                    <span className="text-[11px] text-stone-400 font-mono">
                      {formatearFecha(item.creado_en)}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer transition-all"
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* Modal de Detalle / Stack Trace */}
      {logSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-800 bg-stone-950/80">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                    logSeleccionado.nivel === 'CRASH'
                      ? 'bg-rose-600 text-white'
                      : logSeleccionado.nivel === 'ERROR'
                      ? 'bg-amber-600 text-white'
                      : logSeleccionado.nivel === 'WARN'
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-sky-500 text-white'
                  }`}
                >
                  {logSeleccionado.nivel}
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    Detalle del Registro de Auditoría
                  </h3>
                  <p className="text-[11px] text-stone-400 font-mono">ID: {logSeleccionado.id}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLogSeleccionado(null)}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar text-xs sm:text-sm">
              {/* Mensaje Principal */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Mensaje
                </p>
                <p className="text-stone-100 font-mono font-medium">{logSeleccionado.mensaje}</p>
              </div>

              {/* Ficha de Información de Origen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <p className="text-[10px] text-stone-400 uppercase">Dispositivo</p>
                  <p className="font-mono text-stone-200 mt-0.5 truncate">
                    {logSeleccionado.dispositivo_id}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <p className="text-[10px] text-stone-400 uppercase">Origen</p>
                  <p className="font-mono text-stone-200 mt-0.5 truncate">
                    {logSeleccionado.origen}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-stone-400 uppercase">Hora de Registro</p>
                  <p className="font-mono text-stone-200 mt-0.5">
                    {formatearFecha(logSeleccionado.creado_en)}
                  </p>
                </div>
              </div>

              {/* Stack Trace Formateado */}
              {logSeleccionado.detalles?.stack && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5" />
                      Traza de la Excepción (Stack Trace)
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopiarTexto(String(logSeleccionado.detalles.stack || ''))
                      }
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiado ? 'Copiado' : 'Copiar Stack'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-stone-950 border border-rose-900/60 text-rose-300 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-56 custom-scrollbar">
                    {String(logSeleccionado.detalles.stack)}
                  </pre>
                </div>
              )}

              {/* Metadatos JSON Completos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Metadatos y Contexto del Error (JSON)
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopiarTexto(JSON.stringify(logSeleccionado.detalles, null, 2))
                    }
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar JSON</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48 custom-scrollbar">
                  {JSON.stringify(logSeleccionado.detalles, null, 2)}
                </pre>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-stone-800 bg-stone-950/80 flex justify-end">
              <button
                type="button"
                onClick={() => setLogSeleccionado(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs cursor-pointer transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asistente SQL para Supabase */}
      {mostrarSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Script SQL de Supabase</h3>
                  <p className="text-[11px] text-stone-400">
                    Copia y ejecuta este código en el SQL Editor de tu proyecto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarSqlModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar">
              <ol className="text-xs text-stone-300 space-y-1 list-decimal list-inside bg-stone-950/60 p-3 rounded-xl border border-stone-800/80">
                <li>
                  Haz clic en el botón <strong className="text-amber-400">&quot;Copiar Código SQL&quot;</strong> abajo.
                </li>
                <li>
                  Abre tu proyecto de Supabase en el menú lateral:{' '}
                  <strong className="text-amber-300">SQL Editor</strong>.
                </li>
                <li>Pega el código en el editor y presiona el botón verde <strong>Run</strong>.</li>
                <li>
                  Regresa aquí y presiona <strong>&quot;Reintentar Verificación&quot;</strong>.
                </li>
              </ol>

              <div className="relative">
                <pre className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-amber-200/90 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72 custom-scrollbar">
                  {SQL_ESQUEMA_LOGS}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between gap-3">
              <a
                href="https://supabase.com/dashboard/project/idgyotujnoavliaqtuck/sql"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <span>Abrir Supabase Dashboard ↗</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopiarTexto(SQL_ESQUEMA_LOGS)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md"
                >
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? '¡Copiado!' : 'Copiar Código SQL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarSqlModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
