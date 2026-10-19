import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de la base de datos
const RUTA_DATOS_DIR = path.join(__dirname, 'datos');
if (!fs.existsSync(RUTA_DATOS_DIR)) {
  fs.mkdirSync(RUTA_DATOS_DIR, { recursive: true });
}

const RUTA_DB = path.join(RUTA_DATOS_DIR, 'taqueria.db');

export class BaseDatosTaqueria {
  constructor() {
    this.db = new Database(RUTA_DB);
    // Modo WAL (Write-Ahead Logging) para máxima concurrencia y velocidad
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.inicializarTablas();
    console.log(`[SQL DB] Base de datos SQLite inicializada en: ${RUTA_DB}`);
  }

  inicializarTablas() {
    // 1. Tabla de Mesas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mesas (
        id TEXT PRIMARY KEY,
        numero INTEGER,
        nombre TEXT NOT NULL,
        capacidad INTEGER NOT NULL,
        area TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'libre',
        mesero_asignado TEXT,
        cuenta_id TEXT,
        hora_apertura TEXT,
        actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabla de Cuentas (Activas y Cerradas)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cuentas (
        id TEXT PRIMARY KEY,
        mesa_id TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'abierta',
        mesero TEXT,
        hora_apertura TEXT NOT NULL,
        hora_cierre TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        propina REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        metodo_pago TEXT,
        monto_recibido REAL NOT NULL DEFAULT 0,
        cambio REAL NOT NULL DEFAULT 0,
        desglose_mixto_json TEXT,
        division_cuenta_json TEXT,
        items_json TEXT NOT NULL DEFAULT '[]',
        actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Tabla de Pedidos de Cocina (KDS)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pedidos_cocina (
        id TEXT PRIMARY KEY,
        cuenta_id TEXT,
        mesa_id TEXT NOT NULL,
        mesa_nombre TEXT NOT NULL,
        mesero TEXT,
        hora_envio TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        items_json TEXT NOT NULL DEFAULT '[]',
        notas_generales TEXT,
        actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Tabla de Cortes de Caja
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cortes_caja (
        id TEXT PRIMARY KEY,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT,
        total_ventas REAL NOT NULL DEFAULT 0,
        total_efectivo REAL NOT NULL DEFAULT 0,
        total_tarjeta REAL NOT NULL DEFAULT 0,
        total_transferencia REAL NOT NULL DEFAULT 0,
        total_propinas REAL NOT NULL DEFAULT 0,
        numero_cuentas INTEGER NOT NULL DEFAULT 0,
        abierto INTEGER NOT NULL DEFAULT 1,
        detalles_json TEXT NOT NULL DEFAULT '{}',
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Tabla de Configuración y Metadatos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);

    // Poblar mesas iniciales si la tabla está vacía
    const countMesas = this.db.prepare('SELECT COUNT(*) as total FROM mesas').get().total;
    if (countMesas === 0) {
      console.log('[SQL DB] Poblando mesas iniciales en la base de datos SQLite...');
      const stmt = this.db.prepare(`
        INSERT INTO mesas (id, numero, nombre, capacidad, area, estado)
        VALUES (@id, @numero, @nombre, @capacidad, @area, 'libre')
      `);
      const iniciales = [
        { id: 'mesa-1', numero: 1, nombre: 'Mesa 1', capacidad: 4, area: 'mesa' },
        { id: 'mesa-2', numero: 2, nombre: 'Mesa 2', capacidad: 4, area: 'mesa' },
        { id: 'mesa-3', numero: 3, nombre: 'Mesa 3', capacidad: 4, area: 'mesa' },
        { id: 'mesa-4', numero: 4, nombre: 'Mesa 4', capacidad: 6, area: 'mesa' },
        { id: 'mesa-5', numero: 5, nombre: 'Mesa 5', capacidad: 6, area: 'mesa' },
        { id: 'mesa-6', numero: 6, nombre: 'Mesa 6', capacidad: 4, area: 'mesa' },
        { id: 'mesa-7', numero: 7, nombre: 'Mesa 7', capacidad: 4, area: 'mesa' },
        { id: 'mesa-8', numero: 8, nombre: 'Mesa 8', capacidad: 8, area: 'mesa' },
        { id: 'mesa-9', numero: 9, nombre: 'Mesa 9', capacidad: 4, area: 'mesa' },
        { id: 'mesa-10', numero: 10, nombre: 'Mesa 10', capacidad: 4, area: 'mesa' },
        { id: 'mesa-11', numero: 11, nombre: 'Mesa 11', capacidad: 6, area: 'mesa' },
        { id: 'mesa-12', numero: 12, nombre: 'Mesa 12', capacidad: 8, area: 'mesa' },
        { id: 'domicilio-1', numero: 201, nombre: 'Domicilio 1', capacidad: 1, area: 'domicilio' },
        { id: 'domicilio-2', numero: 202, nombre: 'Domicilio 2', capacidad: 1, area: 'domicilio' },
      ];
      const poblarTrx = this.db.transaction(() => {
        for (const m of iniciales) {
          stmt.run(m);
        }
      });
      poblarTrx();
      console.log('[SQL DB] 14 espacios iniciales registrados en taqueria.db.');
    }
  }

  // Obtener estado completo estructurado para sincronización
  obtenerEstadoCompleto() {
    // Mesas
    const filasMesas = this.db.prepare(`SELECT * FROM mesas ORDER BY numero ASC`).all();
    const mesas = filasMesas.map((f) => ({
      id: f.id,
      numero: f.numero,
      nombre: f.nombre,
      capacidad: f.capacidad,
      area: f.area,
      estado: f.estado,
      meseroAsignado: f.mesero_asignado || undefined,
      cuentaId: f.cuenta_id || undefined,
      horaApertura: f.hora_apertura || undefined,
    }));

    // Cuentas activas
    const filasCuentasActivas = this.db.prepare(`SELECT * FROM cuentas WHERE estado = 'abierta'`).all();
    const cuentasActivas = {};
    for (const f of filasCuentasActivas) {
      cuentasActivas[f.mesa_id] = this.formatearCuenta(f);
    }

    // Cuentas cerradas (últimas 200)
    const filasCuentasCerradas = this.db
      .prepare(`SELECT * FROM cuentas WHERE estado = 'cerrada' ORDER BY actualizado_en DESC LIMIT 200`)
      .all();
    const cuentasCerradas = filasCuentasCerradas.map((f) => this.formatearCuenta(f));

    // Pedidos de cocina (activos y recientes)
    const filasCocina = this.db
      .prepare(`SELECT * FROM pedidos_cocina ORDER BY hora_envio DESC LIMIT 100`)
      .all();
    const pedidosCocina = filasCocina.map((f) => ({
      id: f.id,
      cuentaId: f.cuenta_id || undefined,
      mesaId: f.mesa_id,
      mesaNombre: f.mesa_nombre,
      mesero: f.mesero || 'Mesero',
      horaEnvio: f.hora_envio,
      estado: f.estado,
      items: JSON.parse(f.items_json || '[]'),
      notasGenerales: f.notas_generales || undefined,
    }));

    // Corte actual abierto
    const filaCorte = this.db.prepare(`SELECT * FROM cortes_caja WHERE abierto = 1 LIMIT 1`).get();
    let corteActual = null;
    if (filaCorte) {
      corteActual = {
        id: filaCorte.id,
        fechaInicio: filaCorte.fecha_inicio,
        fechaFin: filaCorte.fecha_fin || undefined,
        totalVentas: filaCorte.total_ventas,
        totalEfectivo: filaCorte.total_efectivo,
        totalTarjeta: filaCorte.total_tarjeta,
        totalTransferencia: filaCorte.total_transferencia,
        totalPropinas: filaCorte.total_propinas,
        numeroCuentas: filaCorte.numero_cuentas,
        abierto: Boolean(filaCorte.abierto),
        detallesPorMetodo: JSON.parse(filaCorte.detalles_json || '{}'),
      };
    }

    return {
      mesas: mesas.length > 0 ? mesas : null,
      cuentasActivas,
      cuentasCerradas,
      pedidosCocina,
      corteActual,
    };
  }

  formatearCuenta(fila) {
    let desgloseMixto = undefined;
    if (fila.desglose_mixto_json) {
      try {
        desgloseMixto = JSON.parse(fila.desglose_mixto_json);
      } catch {}
    }

    let divisionCuenta = undefined;
    if (fila.division_cuenta_json) {
      try {
        divisionCuenta = JSON.parse(fila.division_cuenta_json);
      } catch {}
    }

    return {
      id: fila.id,
      mesaId: fila.mesa_id,
      estado: fila.estado,
      mesero: fila.mesero || 'Mesero',
      horaApertura: fila.hora_apertura,
      horaCierre: fila.hora_cierre || undefined,
      subtotal: fila.subtotal,
      propina: fila.propina,
      total: fila.total,
      metodoPago: fila.metodo_pago || undefined,
      montoRecibido: fila.monto_recibido,
      cambio: fila.cambio,
      desgloseMixto,
      divisionCuenta,
      items: JSON.parse(fila.items_json || '[]'),
    };
  }

  // Guardar estado completo en transacción atómica
  guardarEstadoCompleto(estado) {
    const trx = this.db.transaction(() => {
      // 1. Guardar Mesas
      if (estado.mesas && Array.isArray(estado.mesas)) {
        const stmtMesa = this.db.prepare(`
          INSERT INTO mesas (id, numero, nombre, capacidad, area, estado, mesero_asignado, cuenta_id, hora_apertura, actualizado_en)
          VALUES (@id, @numero, @nombre, @capacidad, @area, @estado, @meseroAsignado, @cuentaId, @horaApertura, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            numero = excluded.numero,
            nombre = excluded.nombre,
            capacidad = excluded.capacidad,
            area = excluded.area,
            estado = excluded.estado,
            mesero_asignado = excluded.mesero_asignado,
            cuenta_id = excluded.cuenta_id,
            hora_apertura = excluded.hora_apertura,
            actualizado_en = CURRENT_TIMESTAMP;
        `);

        for (const m of estado.mesas) {
          stmtMesa.run({
            id: m.id,
            numero: m.numero || 0,
            nombre: m.nombre,
            capacidad: m.capacidad || 4,
            area: m.area || 'mesa',
            estado: m.estado || 'libre',
            meseroAsignado: m.meseroAsignado || null,
            cuentaId: m.cuentaId || null,
            horaApertura: m.horaApertura || null,
          });
        }
      }

      // 2. Guardar Cuentas Activas
      if (estado.cuentasActivas && typeof estado.cuentasActivas === 'object') {
        for (const [mesaId, c] of Object.entries(estado.cuentasActivas)) {
          if (c && c.id) {
            this.guardarCuenta(c);
          }
        }
      }

      // 3. Guardar Cuentas Cerradas
      if (estado.cuentasCerradas && Array.isArray(estado.cuentasCerradas)) {
        for (const c of estado.cuentasCerradas) {
          if (c && c.id) {
            this.guardarCuenta(c);
          }
        }
      }

      // 4. Guardar Pedidos de Cocina
      if (estado.pedidosCocina && Array.isArray(estado.pedidosCocina)) {
        for (const p of estado.pedidosCocina) {
          if (p && p.id) {
            this.guardarPedidoCocina(p);
          }
        }
      }

      // 5. Guardar Corte de Caja
      if (estado.corteActual && estado.corteActual.id) {
        this.guardarCorte(estado.corteActual);
      }
    });

    trx();
  }

  // Guardar una mesa individual
  guardarMesa(m) {
    const stmt = this.db.prepare(`
      INSERT INTO mesas (id, numero, nombre, capacidad, area, estado, mesero_asignado, cuenta_id, hora_apertura, actualizado_en)
      VALUES (@id, @numero, @nombre, @capacidad, @area, @estado, @meseroAsignado, @cuentaId, @horaApertura, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        numero = excluded.numero,
        nombre = excluded.nombre,
        capacidad = excluded.capacidad,
        area = excluded.area,
        estado = excluded.estado,
        mesero_asignado = excluded.mesero_asignado,
        cuenta_id = excluded.cuenta_id,
        hora_apertura = excluded.hora_apertura,
        actualizado_en = CURRENT_TIMESTAMP;
    `);

    stmt.run({
      id: m.id,
      numero: m.numero || 0,
      nombre: m.nombre,
      capacidad: m.capacidad || 4,
      area: m.area || 'mesa',
      estado: m.estado || 'libre',
      meseroAsignado: m.meseroAsignado || null,
      cuentaId: m.estado === 'libre' ? null : (m.cuentaId || m.cuentaActivaId || null),
      horaApertura: m.estado === 'libre' ? null : (m.horaApertura || null),
    });

    if (m.estado === 'libre') {
      try {
        this.db.prepare(`UPDATE cuentas SET estado = 'cancelada', actualizado_en = CURRENT_TIMESTAMP WHERE mesa_id = ? AND estado = 'abierta'`).run(m.id);
        this.db.prepare(`UPDATE pedidos_cocina SET estado = 'entregado', actualizado_en = CURRENT_TIMESTAMP WHERE mesa_id = ? AND estado != 'entregado'`).run(m.id);
      } catch (e) {
        console.warn('[SQL DB] Error al purgar cuentas de mesa libre:', e);
      }
    }
  }

  eliminarMesa(id) {
    this.db.prepare(`DELETE FROM mesas WHERE id = ?`).run(id);
  }

  // Guardar o actualizar cuenta
  guardarCuenta(c) {
    const stmt = this.db.prepare(`
      INSERT INTO cuentas (
        id, mesa_id, estado, mesero, hora_apertura, hora_cierre,
        subtotal, propina, total, metodo_pago, monto_recibido, cambio,
        desglose_mixto_json, division_cuenta_json, items_json, actualizado_en
      ) VALUES (
        @id, @mesaId, @estado, @mesero, @horaApertura, @horaCierre,
        @subtotal, @propina, @total, @metodoPago, @montoRecibido, @cambio,
        @desgloseMixtoJson, @divisionCuentaJson, @itemsJson, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        mesa_id = excluded.mesa_id,
        estado = excluded.estado,
        mesero = excluded.mesero,
        hora_apertura = excluded.hora_apertura,
        hora_cierre = excluded.hora_cierre,
        subtotal = excluded.subtotal,
        propina = excluded.propina,
        total = excluded.total,
        metodo_pago = excluded.metodo_pago,
        monto_recibido = excluded.monto_recibido,
        cambio = excluded.cambio,
        desglose_mixto_json = excluded.desglose_mixto_json,
        division_cuenta_json = excluded.division_cuenta_json,
        items_json = excluded.items_json,
        actualizado_en = CURRENT_TIMESTAMP;
    `);

    stmt.run({
      id: c.id,
      mesaId: c.mesaId,
      estado: c.estado || 'abierta',
      mesero: c.mesero || 'Mesero',
      horaApertura: c.horaApertura || new Date().toISOString(),
      horaCierre: c.horaCierre || null,
      subtotal: c.subtotal || 0,
      propina: c.propina || 0,
      total: c.total || 0,
      metodoPago: c.metodoPago || null,
      montoRecibido: c.montoRecibido || 0,
      cambio: c.cambio || 0,
      desgloseMixtoJson: c.desgloseMixto ? JSON.stringify(c.desgloseMixto) : null,
      divisionCuentaJson: c.divisionCuenta ? JSON.stringify(c.divisionCuenta) : null,
      itemsJson: JSON.stringify(c.items || []),
    });
  }

  // Guardar pedido de cocina
  guardarPedidoCocina(p) {
    const stmt = this.db.prepare(`
      INSERT INTO pedidos_cocina (
        id, cuenta_id, mesa_id, mesa_nombre, mesero, hora_envio, estado, items_json, notas_generales, actualizado_en
      ) VALUES (
        @id, @cuentaId, @mesaId, @mesaNombre, @mesero, @horaEnvio, @estado, @itemsJson, @notasGenerales, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        estado = excluded.estado,
        items_json = excluded.items_json,
        notas_generales = excluded.notas_generales,
        actualizado_en = CURRENT_TIMESTAMP;
    `);

    stmt.run({
      id: p.id,
      cuentaId: p.cuentaId || null,
      mesaId: p.mesaId,
      mesaNombre: p.mesaNombre,
      mesero: p.mesero || 'Mesero',
      horaEnvio: p.horaEnvio || new Date().toISOString(),
      estado: p.estado || 'pendiente',
      itemsJson: JSON.stringify(p.items || []),
      notasGenerales: p.notasGenerales || null,
    });
  }

  actualizarEstadoPedidoCocina(id, estado) {
    this.db.prepare(`UPDATE pedidos_cocina SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`).run(
      estado,
      id
    );
  }

  // Guardar corte de caja
  guardarCorte(corte) {
    const stmt = this.db.prepare(`
      INSERT INTO cortes_caja (
        id, fecha_inicio, fecha_fin, total_ventas, total_efectivo, total_tarjeta,
        total_transferencia, total_propinas, numero_cuentas, abierto, detalles_json, creado_en
      ) VALUES (
        @id, @fechaInicio, @fechaFin, @totalVentas, @totalEfectivo, @totalTarjeta,
        @totalTransferencia, @totalPropinas, @numeroCuentas, @abierto, @detallesJson, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        fecha_fin = excluded.fecha_fin,
        total_ventas = excluded.total_ventas,
        total_efectivo = excluded.total_efectivo,
        total_tarjeta = excluded.total_tarjeta,
        total_transferencia = excluded.total_transferencia,
        total_propinas = excluded.total_propinas,
        numero_cuentas = excluded.numero_cuentas,
        abierto = excluded.abierto,
        detalles_json = excluded.detalles_json;
    `);

    stmt.run({
      id: corte.id,
      fechaInicio: corte.fechaInicio ?? corte.fechaApertura,
      fechaFin: corte.fechaFin ?? corte.fechaCierre ?? null,
      totalVentas: corte.totalVentas || 0,
      totalEfectivo: corte.totalEfectivo || 0,
      totalTarjeta: corte.totalTarjeta || 0,
      totalTransferencia: corte.totalTransferencia || 0,
      totalPropinas: corte.totalPropinas || 0,
      numeroCuentas: corte.numeroCuentas || corte.cuentasCobradasCount || 0,
      abierto: corte.abierto ?? corte.estaAbierto ? 1 : 0,
      detallesJson: JSON.stringify(corte.detallesPorMetodo || {}),
    });
  }

  // Reinicio atómico completo de turno en SQLite: archiva corte, limpia cuentas y libera mesas
  reiniciarTurnoCompleto(corteCerrado, nuevoCorte, mesas) {
    const trx = this.db.transaction(() => {
      if (corteCerrado && corteCerrado.id) {
        this.guardarCorte(corteCerrado);
      }
      if (nuevoCorte && nuevoCorte.id) {
        this.guardarCorte(nuevoCorte);
      }
      // Cancelar todas las cuentas abiertas residuales
      this.db.prepare(`UPDATE cuentas SET estado = 'cancelada', actualizado_en = CURRENT_TIMESTAMP WHERE estado = 'abierta'`).run();
      // Marcar comandas en cocina como entregadas
      this.db.prepare(`UPDATE pedidos_cocina SET estado = 'entregado', actualizado_en = CURRENT_TIMESTAMP WHERE estado != 'entregado'`).run();
      // Liberar mesas
      if (Array.isArray(mesas) && mesas.length > 0) {
        for (const m of mesas) {
          this.guardarMesa(m);
        }
      } else {
        this.db.prepare(`UPDATE mesas SET estado = 'libre', cuenta_id = NULL, hora_apertura = NULL, mesero_asignado = NULL, actualizado_en = CURRENT_TIMESTAMP`).run();
      }
    });
    trx();
  }
}

export const dbTaqueria = new BaseDatosTaqueria();
