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
  Globe,
  Smartphone,
  Monitor,
  Layers,
  Eye,
  Pencil,
  UtensilsCrossed,
} from 'lucide-react';
import { servicioSupabaseLogs } from './servicioSupabaseLogs';
import { servicioActualizacionesTerminal } from './servicioActualizacionesTerminal';
import type {
  RegistroLog,
  NivelLog,
  FiltroLogs,
  EstadisticasLogs,
  DetallePresencia,
  InfoDispositivoUnificado,
} from './types';

function deducirPlataforma(ua?: string): string {
  if (!ua) return 'Web / Navegador';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone/i.test(ua)) return 'iPhone (iOS)';
  if (/ipad/i.test(ua)) return 'iPad (iOS)';
  if (/ipod/i.test(ua)) return 'iPod (iOS)';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Navegador Web';
}

const CLAVE_ALIAS_STORAGE = 'taqueria_terminal_alias_dispositivos_v1';

function resolverNombreAmigable(params: {
  clave: string;
  direccionIp?: string | null;
  idsDispositivo?: string[];
  nombreReportado?: string;
  userAgent?: string;
  plataforma?: string;
  aliasMap: Record<string, string>;
}): string {
  const { clave, direccionIp, idsDispositivo = [], nombreReportado, userAgent = '', plataforma = '', aliasMap } = params;

  // 1. Alias personalizado explícito guardado por el administrador en la terminal
  if (aliasMap[clave]) return aliasMap[clave];
  if (direccionIp && aliasMap[`ip:${direccionIp}`]) return aliasMap[`ip:${direccionIp}`];
  for (const id of idsDispositivo) {
    if (aliasMap[`id:${id}`]) return aliasMap[`id:${id}`];
    if (aliasMap[id]) return aliasMap[id];
  }

  // 2. Nombre explícito reportado por el dispositivo (ej. "iPhone de Juan", "Tablet Caja")
  if (nombreReportado && nombreReportado.trim() && nombreReportado !== 'Terminal POS') {
    return nombreReportado.trim();
  }

  // 3. Deducción por plataforma/hardware
  const ua = userAgent.toLowerCase();
  const plat = plataforma.toLowerCase();

  const esIphone = ua.includes('iphone') || plat.includes('iphone');
  const esIpad = ua.includes('ipad') || plat.includes('ipad');
  const esAndroid = ua.includes('android') || plat.includes('android');

  if (esIphone) return 'iPhone';
  if (esIpad) return 'iPad';
  if (esAndroid) return 'Terminal Android';
  if (ua.includes('windows') || plat.includes('windows') || plat.includes('win32')) return 'PC Windows';
  if (ua.includes('mac') || plat.includes('mac')) return 'Mac';

  // 4. Si el nombre reportado era "Terminal POS", usarlo antes de la IP cruda
  if (nombreReportado && nombreReportado.trim()) {
    return nombreReportado.trim();
  }

  // 5. Fallback con IP o ID
  if (direccionIp) return `Dispositivo (${direccionIp})`;
  if (idsDispositivo.length > 0) return idsDispositivo[0];
  return 'Terminal';
}

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
  const [presenciasEnLinea, setPresenciasEnLinea] = useState<DetallePresencia[]>([]);
  const [modalDispositivosAbierto, setModalDispositivosAbierto] = useState<boolean>(false);
  const [comprobandoOta, setComprobandoOta] = useState<boolean>(false);
  const [mensajeOta, setMensajeOta] = useState<string | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>(() =>
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Alias personalizados de Dispositivos (definidos por el administrador en la terminal)
  const [aliasDispositivos, setAliasDispositivos] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(CLAVE_ALIAS_STORAGE);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [dispositivoParaEditar, setDispositivoParaEditar] = useState<InfoDispositivoUnificado | null>(null);
  const [aliasInput, setAliasInput] = useState<string>('');

  const guardarAlias = (clave: string, nuevoAlias: string): void => {
    const limpio = nuevoAlias.trim();
    setAliasDispositivos((prev) => {
      const actualizados = { ...prev };
      if (limpio) {
        actualizados[clave] = limpio;
      } else {
        delete actualizados[clave];
      }
      try {
        localStorage.setItem(CLAVE_ALIAS_STORAGE, JSON.stringify(actualizados));
      } catch (e: unknown) {
        console.error('[App] Error al guardar alias:', e);
      }
      return actualizados;
    });
    setDispositivoParaEditar(null);
  };

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

    // 1. Suscripción a presencia en tiempo real con metadatos de IP (dispositivos del restaurante conectados)
    const desuscribirPresencia = servicioSupabaseLogs.suscribirPresencia((presencias) => {
      setPresenciasEnLinea(presencias);
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

  // Dispositivos unificados con deduplicación estricta por IP / Dirección
  const dispositivosUnificados: InfoDispositivoUnificado[] = useMemo(() => {
    const mapa = new Map<string, InfoDispositivoUnificado>();

    // 1. Procesar presencias en tiempo real
    for (const p of presenciasEnLinea) {
      const tieneIp = Boolean(p.ip && p.ip !== 'desconocido' && p.ip !== '127.0.0.1' && p.ip !== '::1');
      const clave = tieneIp ? `ip:${p.ip}` : `id:${p.dispositivoId}`;
      const dispId = p.dispositivoId;

      const existente = mapa.get(clave);
      if (existente) {
        existente.sesionesActivas++;
        existente.enLinea = true;
        if (dispId && !existente.idsDispositivo.includes(dispId)) {
          existente.idsDispositivo.push(dispId);
        }
        if (p.nombreDispositivo && !existente.nombreReportado) {
          existente.nombreReportado = p.nombreDispositivo;
        }
        if (p.plataforma && existente.plataforma === 'Web / Navegador') {
          existente.plataforma = deducirPlataforma(p.userAgent) || p.plataforma;
        }
        if (p.userAgent && !existente.userAgent) {
          existente.userAgent = p.userAgent;
        }
      } else {
        const plat = p.plataforma || deducirPlataforma(p.userAgent);
        mapa.set(clave, {
          clave,
          direccionIp: tieneIp ? (p.ip as string) : null,
          idsDispositivo: dispId ? [dispId] : [],
          nombrePrincipal: '',
          nombreReportado: p.nombreDispositivo,
          plataforma: plat,
          userAgent: p.userAgent,
          enLinea: true,
          sesionesActivas: 1,
          ultimaActividad: p.conectadoEn || new Date().toISOString(),
          totalLogs: 0,
          totalCrashes: 0,
          totalErrores: 0,
        });
      }
    }

    // 2. Procesar historial de logs de Supabase
    for (const l of logs) {
      const ipLog = l.detalles?.ip;
      const tieneIp = Boolean(ipLog && ipLog !== 'desconocido' && ipLog !== '127.0.0.1' && ipLog !== '::1');
      const clave = tieneIp ? `ip:${ipLog}` : `id:${l.dispositivo_id}`;
      const dispId = l.dispositivo_id;

      let item = mapa.get(clave);
      if (!item && !tieneIp) {
        // Buscar si este ID de dispositivo ya pertenece a un grupo por IP
        for (const cand of mapa.values()) {
          if (cand.idsDispositivo.includes(dispId)) {
            item = cand;
            break;
          }
        }
      }

      if (!item) {
        const platDeducida =
          (l.detalles?.plataforma as string) || deducirPlataforma(l.detalles?.userAgent as string);
        item = {
          clave,
          direccionIp: tieneIp ? (ipLog as string) : null,
          idsDispositivo: dispId ? [dispId] : [],
          nombrePrincipal: '',
          nombreReportado: l.detalles?.nombreDispositivo as string | undefined,
          plataforma: platDeducida,
          userAgent: l.detalles?.userAgent as string | undefined,
          enLinea: false,
          sesionesActivas: 0,
          ultimaActividad: l.creado_en,
          totalLogs: 0,
          totalCrashes: 0,
          totalErrores: 0,
        };
        mapa.set(clave, item);
      } else {
        if (!item.nombreReportado && l.detalles?.nombreDispositivo) {
          item.nombreReportado = l.detalles.nombreDispositivo as string;
        }
      }

      item.totalLogs++;
      if (l.nivel === 'CRASH') item.totalCrashes++;
      if (l.nivel === 'ERROR') item.totalErrores++;

      if (dispId && !item.idsDispositivo.includes(dispId)) {
        item.idsDispositivo.push(dispId);
      }

      if (new Date(l.creado_en).getTime() > new Date(item.ultimaActividad).getTime()) {
        item.ultimaActividad = l.creado_en;
      }
    }

    // 3. Resolver nombres legibles y alias para todos los dispositivos
    for (const item of mapa.values()) {
      item.aliasPersonalizado =
        aliasDispositivos[item.clave] ||
        (item.direccionIp ? aliasDispositivos[`ip:${item.direccionIp}`] : undefined);
      item.nombrePrincipal = resolverNombreAmigable({
        clave: item.clave,
        direccionIp: item.direccionIp,
        idsDispositivo: item.idsDispositivo,
        nombreReportado: item.nombreReportado,
        userAgent: item.userAgent,
        plataforma: item.plataforma,
        aliasMap: aliasDispositivos,
      });
    }

    // Ordenar: primero los dispositivos que están en línea, luego por actividad más reciente
    return Array.from(mapa.values()).sort((a, b) => {
      if (a.enLinea && !b.enLinea) return -1;
      if (!a.enLinea && b.enLinea) return 1;
      return new Date(b.ultimaActividad).getTime() - new Date(a.ultimaActividad).getTime();
    });
  }, [presenciasEnLinea, logs, aliasDispositivos]);

  // Terminales / Dispositivos únicos en línea (deduplicados por IP)
  const dispositivosEnLineaUnicos = useMemo(() => {
    return dispositivosUnificados.filter((d) => d.enLinea);
  }, [dispositivosUnificados]);

  const obtenerNombreDispositivoParaLog = useCallback(
    (log: RegistroLog): string => {
      const aliasPorId = aliasDispositivos[`id:${log.dispositivo_id}`] || aliasDispositivos[log.dispositivo_id];
      if (aliasPorId) return aliasPorId;

      const ip = log.detalles?.ip;
      if (ip && ip !== 'desconocido') {
        const aliasPorIp = aliasDispositivos[`ip:${ip}`];
        if (aliasPorIp) return aliasPorIp;
      }

      if (log.detalles?.nombreDispositivo && log.detalles.nombreDispositivo !== 'Terminal POS') {
        return log.detalles.nombreDispositivo as string;
      }

      const encontrado = dispositivosUnificados.find(
        (d) =>
          d.idsDispositivo.includes(log.dispositivo_id) ||
          (ip && ip !== 'desconocido' && d.direccionIp === ip)
      );
      if (encontrado && encontrado.nombrePrincipal) {
        return encontrado.nombrePrincipal;
      }

      const ua = (log.detalles?.userAgent as string) || '';
      if (/iphone/i.test(ua)) return 'iPhone';
      if (/ipad/i.test(ua)) return 'iPad';
      if (/android/i.test(ua)) return 'Terminal Android';

      return log.dispositivo_id;
    },
    [aliasDispositivos, dispositivosUnificados]
  );

  // Filtrado reactivo de logs con soporte para filtro por IP o ID
  const logsFiltrados = useMemo(() => {
    const ahoraMs = Date.now();
    return logs.filter((log) => {
      // Filtro por nivel
      if (filtro.nivel !== 'TODOS' && log.nivel !== filtro.nivel) {
        return false;
      }

      // Filtro específico para cambios de menú y catálogo
      if (filtro.soloCatalogo && !log.mensaje.includes('[CATÁLOGO]')) {
        return false;
      }

      // Filtro por dispositivo / IP
      if (filtro.dispositivoId !== 'TODOS') {
        if (filtro.dispositivoId.startsWith('ip:')) {
          const ipBuscada = filtro.dispositivoId.replace('ip:', '');
          const coincideIp = log.detalles?.ip === ipBuscada;
          const dispObj = dispositivosUnificados.find((d) => d.clave === filtro.dispositivoId);
          const coincideIdAsociado = dispObj ? dispObj.idsDispositivo.includes(log.dispositivo_id) : false;
          if (!coincideIp && !coincideIdAsociado) return false;
        } else if (filtro.dispositivoId.startsWith('id:')) {
          const idBuscado = filtro.dispositivoId.replace('id:', '');
          if (log.dispositivo_id !== idBuscado) return false;
        } else {
          if (log.dispositivo_id !== filtro.dispositivoId) return false;
        }
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
        const coincideIp = log.detalles?.ip ? String(log.detalles.ip).toLowerCase().includes(q) : false;
        const coincideOrigen = log.origen.toLowerCase().includes(q);
        const coincideStack = log.detalles?.stack
          ? String(log.detalles.stack).toLowerCase().includes(q)
          : false;

        if (!coincideMensaje && !coincideDisp && !coincideIp && !coincideOrigen && !coincideStack) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filtro, dispositivosUnificados]);

  // Estadísticas computadas con total de dispositivos únicos deduplicados
  const estadisticas: EstadisticasLogs = useMemo(() => {
    let crashes = 0;
    let errores = 0;
    let advertencias = 0;
    let informativos = 0;

    for (const l of logs) {
      if (l.nivel === 'CRASH') crashes++;
      else if (l.nivel === 'ERROR') errores++;
      else if (l.nivel === 'WARN') advertencias++;
      else if (l.nivel === 'INFO') informativos++;
    }

    return {
      total: logs.length,
      crashes,
      errores,
      advertencias,
      informativos,
      dispositivosUnicos: dispositivosUnificados.length,
    };
  }, [logs, dispositivosUnificados]);

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

          {/* Dispositivos Activos con Acceso al Panel de Dispositivos Completados */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setModalDispositivosAbierto(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setModalDispositivosAbierto(true);
              }
            }}
            className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800 hover:border-emerald-500/50 flex items-center justify-between col-span-2 lg:col-span-1 cursor-pointer transition-all group shadow-md"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-stone-400 font-medium">Dispositivos Únicos (IP)</p>
                <span className="text-[10px] text-emerald-400 group-hover:underline flex items-center gap-0.5 font-bold">
                  Ver lista <Eye className="w-3 h-3 inline" />
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-black text-emerald-400">
                  {dispositivosEnLineaUnicos.length > 0
                    ? dispositivosEnLineaUnicos.length
                    : estadisticas.dispositivosUnicos}
                </p>
                {dispositivosEnLineaUnicos.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    En vivo ({dispositivosEnLineaUnicos.length})
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">
                {estadisticas.dispositivosUnicos} registrados en total · Deduplicados por IP
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all">
              <Tablet className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Barra de Dispositivos Conectados en Tiempo Real (Deduplicados por IP) */}
        {dispositivosEnLineaUnicos.length > 0 && (
          <div className="p-3 rounded-2xl bg-stone-900/90 border border-emerald-900/40 flex flex-wrap items-center gap-2 text-xs shadow-lg">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Terminales en línea ({dispositivosEnLineaUnicos.length}):
            </span>
            {dispositivosEnLineaUnicos.map((disp) => {
              const esActivo = filtro.dispositivoId === disp.clave;
              const esMovil = /android|iphone|ipad|ipod/i.test(disp.plataforma || '');
              return (
                <button
                  key={disp.clave}
                  type="button"
                  onClick={() => setFiltro({ ...filtro, dispositivoId: esActivo ? 'TODOS' : disp.clave })}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                    esActivo
                      ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold shadow-md'
                      : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-emerald-700'
                  }`}
                  title={`${disp.nombrePrincipal} (${disp.direccionIp || 'Sin IP'}) - ${disp.plataforma}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {esMovil ? <Smartphone className="w-3 h-3 text-amber-400 shrink-0" /> : <Monitor className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span className="font-bold">{disp.nombrePrincipal}</span>
                  {disp.direccionIp && (
                    <span className="text-[10px] font-mono text-stone-400">({disp.direccionIp})</span>
                  )}
                  {disp.sesionesActivas > 1 && (
                    <span className="text-[9px] px-1 py-0.2 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded font-sans">
                      {disp.sesionesActivas} ses.
                    </span>
                  )}
                </button>
              );
            })}
            {filtro.dispositivoId !== 'TODOS' && (
              <button
                type="button"
                onClick={() => setFiltro({ ...filtro, dispositivoId: 'TODOS' })}
                className="text-[11px] text-amber-400 underline hover:text-amber-300 cursor-pointer"
              >
                Ver todos
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalDispositivosAbierto(true)}
              className="px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all ml-auto"
            >
              <Eye className="w-3 h-3" />
              <span>Ver dispositivos completados ({dispositivosUnificados.length})</span>
            </button>
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
                  className="bg-transparent text-xs text-stone-300 outline-none cursor-pointer max-w-[210px] truncate"
                >
                  <option value="TODOS" className="bg-stone-900">
                    Todos los dispositivos ({dispositivosUnificados.length})
                  </option>
                  {dispositivosUnificados.map((disp) => (
                    <option key={disp.clave} value={disp.clave} className="bg-stone-900">
                      {disp.enLinea ? '🟢 ' : '⚪ '}
                      {disp.nombrePrincipal} {disp.direccionIp ? `(IP: ${disp.direccionIp})` : ''}
                      {disp.sesionesActivas > 1 ? ` (${disp.sesionesActivas} ses.)` : ''} - [{disp.plataforma}]
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
            {/* Pastillas de Niveles y Filtro de Catálogo */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['TODOS', 'CRASH', 'ERROR', 'WARN', 'INFO'] as const).map((lvl) => {
                const activo = filtro.nivel === lvl && !filtro.soloCatalogo;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFiltro({ ...filtro, nivel: lvl, soloCatalogo: false })}
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

              {/* Filtro Rápido Especial para Cambios en Menú y Catálogo */}
              <button
                type="button"
                onClick={() => setFiltro({ ...filtro, soloCatalogo: !filtro.soloCatalogo })}
                className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
                  filtro.soloCatalogo
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 border-amber-400 shadow-md shadow-amber-950'
                    : 'bg-stone-950 text-amber-400/90 hover:bg-stone-800 border-amber-500/30'
                }`}
                title="Filtrar únicamente altas, bajas, ediciones y fotos de platillos"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>🍽️ Menú / Catálogo</span>
              </button>
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
              const esCatalogo =
                item.mensaje.includes('[CATÁLOGO]') ||
                Boolean(item.detalles?.tipoEvento?.toString().startsWith('producto_'));

              return (
                <div
                  key={item.id}
                  onClick={() => setLogSeleccionado(item)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    esCrash
                      ? 'bg-rose-950/25 hover:bg-rose-950/40 border-rose-800/80 shadow-xs'
                      : esError
                      ? 'bg-amber-950/20 hover:bg-amber-950/30 border-amber-700/60'
                      : esCatalogo
                      ? 'bg-stone-900/90 hover:bg-stone-850 border-amber-500/50 shadow-xs'
                      : esWarn
                      ? 'bg-stone-900/80 hover:bg-stone-900 border-amber-500/30'
                      : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800/80'
                  }`}
                >
                  {/* Contenido Izquierdo */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Badge Especial de Catálogo o Badge de Nivel */}
                    {esCatalogo ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 flex items-center gap-1 shadow-xs">
                        <UtensilsCrossed className="w-3 h-3 stroke-[2.5]" />
                        <span>MENÚ</span>
                      </span>
                    ) : (
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
                    )}

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
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mt-1 text-[11px] text-stone-400">
                        <span className="flex items-center gap-1 font-bold text-amber-300 bg-stone-950/80 border border-amber-900/40 px-2 py-0.5 rounded-md">
                          <Smartphone className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{obtenerNombreDispositivoParaLog(item)}</span>
                        </span>
                        {item.detalles?.ip && item.detalles.ip !== 'desconocido' && (
                          <span className="flex items-center gap-1 font-mono text-[10px] text-stone-400">
                            <Globe className="w-2.5 h-2.5 text-stone-500" />
                            {String(item.detalles.ip)}
                          </span>
                        )}
                        <span>•</span>
                        <span className="font-mono text-[10px] text-stone-500">
                          {item.dispositivo_id}
                        </span>
                        <span>•</span>
                        <span className="text-stone-400">{item.origen}</span>
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

              {/* Ficha Especial: Datos Estructurados de Catálogo y Menú */}
              {(logSeleccionado.mensaje.includes('[CATÁLOGO]') ||
                Boolean(logSeleccionado.detalles?.tipoEvento?.toString().startsWith('producto_'))) && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>Auditoría de Platillo / Menú</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {Boolean(logSeleccionado.detalles?.nombre) && (
                      <div className="p-2 rounded-lg bg-stone-950/80 border border-amber-900/30">
                        <span className="text-[10px] text-stone-400 block">Nombre</span>
                        <span className="font-bold text-stone-100">{String(logSeleccionado.detalles.nombre)}</span>
                      </div>
                    )}
                    {logSeleccionado.detalles?.precio !== undefined && (
                      <div className="p-2 rounded-lg bg-stone-950/80 border border-amber-900/30">
                        <span className="text-[10px] text-stone-400 block">Precio</span>
                        <span className="font-bold text-amber-400">${String(logSeleccionado.detalles.precio)} MXN</span>
                      </div>
                    )}
                    {Boolean(logSeleccionado.detalles?.categoria) && (
                      <div className="p-2 rounded-lg bg-stone-950/80 border border-amber-900/30">
                        <span className="text-[10px] text-stone-400 block">Categoría</span>
                        <span className="font-bold text-stone-200 capitalize">{String(logSeleccionado.detalles.categoria)}</span>
                      </div>
                    )}
                    {logSeleccionado.detalles?.tieneFoto !== undefined && (
                      <div className="p-2 rounded-lg bg-stone-950/80 border border-amber-900/30">
                        <span className="text-[10px] text-stone-400 block">Fotografía</span>
                        <span className={`font-bold ${logSeleccionado.detalles.tieneFoto ? 'text-emerald-400' : 'text-stone-400'}`}>
                          {logSeleccionado.detalles.tieneFoto ? '✓ Con Imagen' : 'Sin Imagen'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ficha de Información de Origen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <p className="text-[10px] text-stone-400 uppercase">Dispositivo / Terminal</p>
                  <p className="font-bold text-amber-300 mt-0.5 truncate flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{obtenerNombreDispositivoParaLog(logSeleccionado)}</span>
                  </p>
                  <p className="text-[10px] font-mono text-stone-500 mt-0.5 truncate">
                    ID: {logSeleccionado.dispositivo_id}
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

      {/* Modal de Dispositivos Completados con Deduplicación por IP */}
      {modalDispositivosAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>Dispositivos Completados y Conexiones</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono">
                      {dispositivosUnificados.length} únicos por IP
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Terminales auditadas en vivo e historial de actividad en La Estación Grill
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalDispositivosAbierto(false)}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner de Deduplicación por IP */}
            <div className="px-4 sm:px-5 py-2.5 bg-emerald-950/30 border-b border-emerald-900/40 text-xs text-emerald-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Deduplicación por IP activa:</strong> Si varias pestañas o sesiones comparten la misma dirección IP, se contabilizan como 1 solo dispositivo único.
              </span>
            </div>

            {/* Cuerpo del Modal: Lista de Dispositivos */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {dispositivosUnificados.length === 0 ? (
                <div className="p-8 text-center text-stone-500 space-y-2">
                  <Tablet className="w-8 h-8 mx-auto text-stone-600" />
                  <p className="text-xs">No se han registrado dispositivos ni eventos aún.</p>
                </div>
              ) : (
                dispositivosUnificados.map((disp, idx) => {
                  const esMovil = /android|iphone|ipad|ipod/i.test(disp.plataforma || '');
                  return (
                    <div
                      key={disp.clave || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        disp.enLinea
                          ? 'bg-stone-950/90 border-emerald-900/60 shadow-md'
                          : 'bg-stone-950/50 border-stone-800/80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Identidad del Dispositivo */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              disp.enLinea
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-stone-800/60 text-stone-400 border border-stone-800'
                            }`}
                          >
                            {esMovil ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                          </div>

                          <div>
                            {/* Nombre Principal del Dispositivo con Botón de Editar */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-extrabold text-sm sm:text-base text-amber-300 flex items-center gap-1.5">
                                {disp.nombrePrincipal}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDispositivoParaEditar(disp);
                                  setAliasInput(disp.aliasPersonalizado || disp.nombrePrincipal);
                                }}
                                className="p-1 rounded-md text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
                                title="Renombrar o asignar alias a este dispositivo"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Estado En Vivo */}
                              {disp.enLinea ? (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/90 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                  EN LÍNEA AHORA
                                </span>
                              ) : (
                                <span className="text-[10px] text-stone-400 bg-stone-900 border border-stone-800 px-2 py-0.5 rounded-full font-medium">
                                  Desconectado
                                </span>
                              )}

                              {/* Dirección IP Principal */}
                              {disp.direccionIp && (
                                <span className="font-mono text-xs font-semibold text-stone-300 flex items-center gap-1 bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800">
                                  <Globe className="w-3 h-3 text-stone-400 inline" />
                                  {disp.direccionIp}
                                </span>
                              )}

                              {/* Alerta de Misma IP / Múltiples Sesiones */}
                              {disp.sesionesActivas > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-600/70 text-amber-300 font-bold flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-amber-400" />
                                  Misma IP: {disp.sesionesActivas} sesiones activas simultáneas
                                </span>
                              )}
                            </div>

                            {/* Metadatos de Plataforma y Hardware */}
                            <div className="mt-1.5 text-xs text-stone-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>
                                <strong className="text-stone-300">Plataforma:</strong> {disp.plataforma}
                              </span>
                              <span>·</span>
                              <span>
                                <strong className="text-stone-300">Última actividad:</strong>{' '}
                                {formatearFecha(disp.ultimaActividad)}
                              </span>
                            </div>

                            {/* IDs de Sesión Asociados */}
                            {disp.idsDispositivo.length > 0 && (
                              <div className="mt-1 text-[11px] font-mono text-stone-500 truncate max-w-xl">
                                <span className="text-stone-400 font-sans">ID(s) de sesión: </span>
                                {disp.idsDispositivo.join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botón de Acción y Métricas Rápidas */}
                        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-900">
                          {/* Conteo de logs */}
                          <div className="flex items-center gap-2 text-[11px] text-stone-400">
                            <span className="text-stone-300 font-bold">{disp.totalLogs}</span> logs
                            {disp.totalCrashes > 0 && (
                              <span className="text-rose-400 font-bold flex items-center gap-0.5">
                                <Bug className="w-3 h-3 inline" /> {disp.totalCrashes}
                              </span>
                            )}
                            {disp.totalErrores > 0 && (
                              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3 inline" /> {disp.totalErrores}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setFiltro({ ...filtro, dispositivoId: disp.clave });
                              setModalDispositivosAbierto(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 border border-stone-800 hover:border-emerald-700/80 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Filtrar eventos</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-stone-800 bg-stone-950/90 flex items-center justify-between">
              <p className="text-xs text-stone-400">
                Total de terminales físicas / redes únicas:{' '}
                <strong className="text-white">{dispositivosUnificados.length}</strong> ({dispositivosEnLineaUnicos.length} activas)
              </p>
              <button
                type="button"
                onClick={() => setModalDispositivosAbierto(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Renombrar Dispositivo / Asignar Alias */}
      {dispositivoParaEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setDispositivoParaEditar(null)}
        >
          <div
            className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl p-5 text-white flex flex-col gap-4 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Asignar Nombre a Dispositivo</h3>
                  <p className="text-xs text-stone-400">
                    {dispositivoParaEditar.direccionIp
                      ? `IP: ${dispositivoParaEditar.direccionIp}`
                      : dispositivoParaEditar.clave}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispositivoParaEditar(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                guardarAlias(dispositivoParaEditar.clave, aliasInput);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Nombre Personalizado
                </label>
                <input
                  type="text"
                  autoFocus
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Ej. iPhone de Juan, Tablet Barra..."
                  maxLength={35}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-stone-600 focus:outline-hidden focus:border-amber-500 font-medium"
                />
                <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                  Este nombre se mostrará en los logs, en el filtro y en la barra de dispositivos conectados de esta terminal.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => guardarAlias(dispositivoParaEditar.clave, '')}
                  className="px-3 py-2 text-xs font-semibold text-stone-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Restablecer
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDispositivoParaEditar(null)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    Guardar Nombre
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
