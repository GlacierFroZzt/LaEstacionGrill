-- ===================================================================
-- TAQUERÍA KM 243 - ESQUEMA DE BASE DE DATOS POSTGRESQL PARA SUPABASE
-- Copia y pega todo este script en el "SQL Editor" de tu proyecto de Supabase
-- y presiona el botón "RUN".
-- ===================================================================

-- 1. Tabla de Mesas y Espacios
CREATE TABLE IF NOT EXISTS public.mesas (
    id TEXT PRIMARY KEY,
    numero INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    capacidad INTEGER NOT NULL DEFAULT 4,
    estado TEXT NOT NULL DEFAULT 'libre',
    area TEXT NOT NULL DEFAULT 'mesa',
    total_parcial NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cuenta_activa_id TEXT,
    hora_apertura TEXT,
    mesero_asignado TEXT,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de Cuentas (Activas y Cerradas)
CREATE TABLE IF NOT EXISTS public.cuentas (
    id TEXT PRIMARY KEY,
    mesa_id TEXT NOT NULL,
    numero_mesa INTEGER NOT NULL,
    nombre_mesa TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    descuento NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    propina NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'abierta',
    hora_apertura TEXT NOT NULL,
    hora_cierre TEXT,
    mesero TEXT NOT NULL,
    metodo_pago TEXT,
    division_cuenta JSONB,
    desglose_mixto JSONB,
    monto_recibido NUMERIC(10, 2),
    cambio_entregado NUMERIC(10, 2),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla de Pedidos a Cocina (KDS)
CREATE TABLE IF NOT EXISTS public.pedidos_cocina (
    id TEXT PRIMARY KEY,
    comanda_id TEXT NOT NULL,
    mesa_id TEXT NOT NULL,
    nombre_mesa TEXT NOT NULL,
    mesero TEXT NOT NULL,
    hora_envio TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabla de Cortes de Caja
CREATE TABLE IF NOT EXISTS public.cortes_caja (
    id TEXT PRIMARY KEY,
    fecha_apertura TEXT NOT NULL,
    fecha_cierre TEXT,
    total_ventas NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_efectivo NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_tarjeta NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_transferencia NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_propinas NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cuentas_cobradas_count INTEGER NOT NULL DEFAULT 0,
    ticket_promedio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    esta_abierto BOOLEAN NOT NULL DEFAULT true,
    pin_seguridad TEXT NOT NULL DEFAULT '1234',
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Poblar las 14 mesas iniciales si la tabla está vacía
INSERT INTO public.mesas (id, numero, nombre, capacidad, estado, area)
SELECT * FROM (VALUES
    ('mesa-1', 1, 'Mesa 1', 4, 'libre', 'mesa'),
    ('mesa-2', 2, 'Mesa 2', 4, 'libre', 'mesa'),
    ('mesa-3', 3, 'Mesa 3', 4, 'libre', 'mesa'),
    ('mesa-4', 4, 'Mesa 4', 4, 'libre', 'mesa'),
    ('mesa-5', 5, 'Mesa 5', 4, 'libre', 'mesa'),
    ('mesa-6', 6, 'Mesa 6', 4, 'libre', 'mesa'),
    ('mesa-7', 7, 'Mesa 7', 4, 'libre', 'mesa'),
    ('mesa-8', 8, 'Mesa 8', 4, 'libre', 'mesa'),
    ('mesa-9', 9, 'Mesa 9', 4, 'libre', 'mesa'),
    ('mesa-10', 10, 'Mesa 10', 4, 'libre', 'mesa'),
    ('mesa-11', 11, 'Mesa 11', 4, 'libre', 'mesa'),
    ('mesa-12', 12, 'Mesa 12', 4, 'libre', 'mesa'),
    ('domicilio-1', 201, 'Domicilio 1', 1, 'libre', 'domicilio'),
    ('domicilio-2', 202, 'Domicilio 2', 1, 'libre', 'domicilio')
) AS v(id, numero, nombre, capacidad, estado, area)
WHERE NOT EXISTS (SELECT 1 FROM public.mesas);

-- 6. Habilitar Seguridad a Nivel de Fila (RLS) con acceso completo para la terminal taquera (anon)
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_cocina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortes_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total para mesas" ON public.mesas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total para cuentas" ON public.cuentas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total para cocina" ON public.pedidos_cocina FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total para cortes" ON public.cortes_caja FOR ALL USING (true) WITH CHECK (true);

-- 7. Activar Supabase Realtime para sincronización instantánea entre celulares
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cuentas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_cocina;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cortes_caja;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
