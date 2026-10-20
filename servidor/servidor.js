import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbTaqueria } from './baseDatosSql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUERTO = process.env.PORT || 3001;

function obtenerIpsLocales() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ interfaz: nombre, ip: iface.address });
      }
    }
  }
  return ips;
}

// Servidor HTTP para verificación de salud, consulta de IP y sincronización REST
const servidorHttp = http.createServer((req, res) => {
  // Encabezados CORS universales para permitir conexiones desde Android WebView y navegadores
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/api/ping' || url.pathname === '/ping') {
    const ipCliente = req.socket.remoteAddress?.replace(/^.*:/, '') || '127.0.0.1';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        estado: 'ok',
        servidor: 'LA ESTACIÓN GRILL SQL Server',
        motor: 'SQLite (better-sqlite3)',
        timestamp: new Date().toISOString(),
        tuIp: ipCliente,
      })
    );
    return;
  }

  if (url.pathname === '/api/dispositivos') {
    const mapaIps = new Map();
    for (const cliente of wss.clients) {
      if (cliente.readyState === WebSocket.OPEN) {
        const ip = cliente.ipCliente || '127.0.0.1';
        const actual = mapaIps.get(ip) || { ip, sesiones: 0, conectadoEn: cliente.conectadoEn || new Date().toISOString() };
        actual.sesiones++;
        mapaIps.set(ip, actual);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        totalDispositivosUnicos: mapaIps.size,
        totalSesiones: wss.clients.size,
        dispositivos: Array.from(mapaIps.values()),
      })
    );
    return;
  }

  if (url.pathname === '/api/ips') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ips: obtenerIpsLocales(), puerto: PUERTO }));
    return;
  }

  if (url.pathname === '/api/estado') {
    try {
      const estado = dbTaqueria.obtenerEstadoCompleto();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(estado));
    } catch (error) {
      console.error('[HTTP /api/estado] Error al obtener estado de SQL:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error interno de base de datos' }));
    }
    return;
  }

  // Endpoint para comprobar versión OTA en caliente
  if (url.pathname === '/api/version' || url.pathname === '/version.json') {
    try {
      const rutaVersion = path.join(__dirname, '..', 'frontend', 'public', 'version.json');
      if (fs.existsSync(rutaVersion)) {
        const contenido = fs.readFileSync(rutaVersion, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(contenido);
        return;
      }
    } catch (error) {
      console.error('[HTTP /api/version] Error:', error);
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'version.json no encontrado' }));
    return;
  }

  // Endpoint para servir paquete web comprimido para actualización en caliente OTA
  if (url.pathname === '/api/web-bundle.zip') {
    try {
      const rutaZip = path.join(__dirname, 'web-bundle.zip');
      if (fs.existsSync(rutaZip)) {
        const stat = fs.statSync(rutaZip);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="web-bundle.zip"',
        });
        const readStream = fs.createReadStream(rutaZip);
        readStream.pipe(res);
        return;
      }
    } catch (error) {
      console.error('[HTTP /api/web-bundle.zip] Error al servir bundle zip:', error);
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bundle OTA web-bundle.zip no disponible en servidor' }));
    return;
  }

  // Respuesta por defecto
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🔥 Servidor Central SQL de LA ESTACIÓN GRILL activo y escuchando.');
});

// Servidor WebSocket montado sobre la misma conexión HTTP
const wss = new WebSocketServer({ server: servidorHttp });

function retransmitir(mensajeObj, remitenteWs = null) {
  const serializado = JSON.stringify(mensajeObj);
  let enviados = 0;
  for (const cliente of wss.clients) {
    if (cliente.readyState === WebSocket.OPEN && cliente !== remitenteWs) {
      cliente.send(serializado);
      enviados++;
    }
  }
  return enviados;
}

function obtenerTotalDispositivosUnicos() {
  const ipsUnicas = new Set();
  for (const cliente of wss.clients) {
    if (cliente.readyState === WebSocket.OPEN) {
      const ip = cliente.ipCliente || '127.0.0.1';
      ipsUnicas.add(ip);
    }
  }
  return Math.max(1, ipsUnicas.size);
}

wss.on('connection', (ws, req) => {
  const ipCliente = req.socket.remoteAddress?.replace(/^.*:/, '') || '127.0.0.1';
  ws.ipCliente = ipCliente;
  ws.conectadoEn = new Date().toISOString();
  const totalUnicos = obtenerTotalDispositivosUnicos();
  console.log(`[+] Dispositivo conectado desde ${ipCliente}. Únicos por IP: ${totalUnicos} (Sockets totales: ${wss.clients.size})`);

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // 1. Obtener estado fresco directamente de la base de datos SQL
  try {
    const estadoSql = dbTaqueria.obtenerEstadoCompleto();
    const respuestaInicial = {
      id: `sync-init-${Date.now()}`,
      tipo: 'SYNC_ESTADO_COMPLETO',
      timestamp: new Date().toISOString(),
      remitenteId: 'servidor-sql',
      payload: {
        ...estadoSql,
        clientesConectadosCount: totalUnicos,
      },
    };
    ws.send(JSON.stringify(respuestaInicial));
  } catch (err) {
    console.error('[WebSocket] Error al enviar estado inicial de SQL:', err);
  }

  // 2. Notificar a todos sobre la cantidad actualizada de terminales activas deduplicadas por IP
  retransmitir({
    id: `disp-${Date.now()}`,
    tipo: 'DISPOSITIVOS_ACTUALIZADOS',
    timestamp: new Date().toISOString(),
    remitenteId: 'servidor-sql',
    payload: { clientesConectadosCount: totalUnicos },
  });

  // 3. Procesar mensajes entrantes de tablets o celulares
  ws.on('message', (data) => {
    try {
      const mensaje = JSON.parse(data.toString());
      const { tipo, payload, remitenteId } = mensaje;

      switch (tipo) {
        case 'SOLICITAR_ESTADO_ACTUAL': {
          const estadoActual = dbTaqueria.obtenerEstadoCompleto();
          ws.send(
            JSON.stringify({
              id: `sync-res-${Date.now()}`,
              tipo: 'SYNC_ESTADO_COMPLETO',
              timestamp: new Date().toISOString(),
              remitenteId: 'servidor-sql',
              payload: {
                ...estadoActual,
                clientesConectadosCount: wss.clients.size,
              },
            })
          );
          break;
        }

        case 'SYNC_ESTADO_COMPLETO': {
          if (payload) {
            dbTaqueria.guardarEstadoCompleto(payload);
            retransmitir(mensaje, ws);
          }
          break;
        }

        case 'MESA_ACTUALIZADA': {
          if (Array.isArray(payload?.mesas)) {
            for (const m of payload.mesas) {
              dbTaqueria.guardarMesa(m);
            }
          } else if (payload?.mesa) {
            dbTaqueria.guardarMesa(payload.mesa);
          }

          if (payload?.cuentasActivas && typeof payload.cuentasActivas === 'object') {
            for (const cuenta of Object.values(payload.cuentasActivas)) {
              if (cuenta && cuenta.id) {
                dbTaqueria.guardarCuenta(cuenta);
              }
            }
          }
          retransmitir(mensaje, ws);
          break;
        }

        case 'MESA_ELIMINADA': {
          if (payload?.mesaId) {
            dbTaqueria.eliminarMesa(payload.mesaId);
          }
          retransmitir(mensaje, ws);
          break;
        }

        case 'NUEVA_COMANDA_COCINA':
        case 'PEDIDO_COCINA_NUEVO': {
          if (payload?.pedido) {
            dbTaqueria.guardarPedidoCocina(payload.pedido);
          }
          if (Array.isArray(payload?.mesas)) {
            for (const m of payload.mesas) {
              dbTaqueria.guardarMesa(m);
            }
          }
          if (payload?.cuentasActivas && typeof payload.cuentasActivas === 'object') {
            for (const cuenta of Object.values(payload.cuentasActivas)) {
              if (cuenta && cuenta.id) {
                dbTaqueria.guardarCuenta(cuenta);
              }
            }
          }
          retransmitir(mensaje, ws);
          break;
        }

        case 'PEDIDO_COCINA_ACTUALIZADO':
        case 'PEDIDO_COCINA_ESTADO': {
          if (payload?.pedido) {
            dbTaqueria.guardarPedidoCocina(payload.pedido);
          } else if (payload?.pedidoId && payload?.nuevoEstado) {
            dbTaqueria.actualizarEstadoPedidoCocina(payload.pedidoId, payload.nuevoEstado);
          }
          retransmitir(mensaje, ws);
          break;
        }

        case 'CUENTA_ACTUALIZADA':
        case 'CUENTA_CERRADA':
        case 'CUENTA_COBRADA': {
          if (payload?.cuenta) {
            dbTaqueria.guardarCuenta(payload.cuenta);
          }
          if (payload?.cuentaCerrada) {
            dbTaqueria.guardarCuenta(payload.cuentaCerrada);
          }
          if (Array.isArray(payload?.mesas)) {
            for (const m of payload.mesas) {
              dbTaqueria.guardarMesa(m);
            }
          }
          if (payload?.cuentasActivas && typeof payload.cuentasActivas === 'object') {
            for (const cuenta of Object.values(payload.cuentasActivas)) {
              if (cuenta && cuenta.id) {
                dbTaqueria.guardarCuenta(cuenta);
              }
            }
          }
          if (payload?.corteActual) {
            dbTaqueria.guardarCorte(payload.corteActual);
          }
          retransmitir(mensaje, ws);
          break;
        }

        case 'TURNO_REINICIADO': {
          dbTaqueria.reiniciarTurnoCompleto(
            payload?.turnoCerrado,
            payload?.corteActual || payload?.corte,
            payload?.mesas
          );
          retransmitir(mensaje, ws);
          break;
        }

        case 'CORTE_ACTUALIZADO':
        case 'CORTE_CERRADO': {
          if (payload?.corte) {
            dbTaqueria.guardarCorte(payload.corte);
          }
          if (payload?.turnoCerrado) {
            dbTaqueria.guardarCorte(payload.turnoCerrado);
          }
          if (payload?.corteActual) {
            dbTaqueria.guardarCorte(payload.corteActual);
          }
          retransmitir(mensaje, ws);
          break;
        }

        default:
          retransmitir(mensaje, ws);
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Error al procesar mensaje:', error);
    }
  });

  ws.on('close', () => {
    const totalUnicos = obtenerTotalDispositivosUnicos();
    console.log(`[-] Dispositivo desconectado (${ws.ipCliente || 'desconocido'}). Únicos restantes por IP: ${totalUnicos} (Sockets: ${wss.clients.size})`);
    retransmitir({
      id: `disp-${Date.now()}`,
      tipo: 'DISPOSITIVOS_ACTUALIZADOS',
      timestamp: new Date().toISOString(),
      remitenteId: 'servidor-sql',
      payload: { clientesConectadosCount: totalUnicos },
    });
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Error en socket cliente:`, err);
  });
});

// Heartbeat cada 25 segundos para mantener vivas las conexiones móviles
const pingIntervalo = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);

wss.on('close', () => {
  clearInterval(pingIntervalo);
});

// Iniciar escucha en todas las interfaces de red (0.0.0.0)
servidorHttp.listen(PUERTO, '0.0.0.0', () => {
  const ips = obtenerIpsLocales();
  console.log(`\n==================================================================`);
  console.log(`🔥 TAQUERÍA KM 243 - SERVIDOR DE BASE DE DATOS SQL Y SINCRONIZACIÓN`);
  console.log(`📡 Puerto de servicio: ${PUERTO}`);
  console.log(`🗄️  Motor: SQLite Relacional (taqueria.db) con WAL Mode`);
  console.log(`------------------------------------------------------------------`);
  console.log(`📲 Direcciones IP locales para conectar celulares y tablets:`);
  for (const item of ips) {
    console.log(`   ➜ [${item.interfaz}]: http://${item.ip}:${PUERTO} | ws://${item.ip}:${PUERTO}`);
  }
  console.log(`==================================================================\n`);
});
