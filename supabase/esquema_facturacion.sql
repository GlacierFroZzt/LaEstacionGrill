-- ==============================================================================
-- Esquema de Facturación Electrónica CFDI 4.0 (SAT México)
-- Taquería Km 243
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.facturas_cfdi (
    id TEXT PRIMARY KEY,
    cuenta_id TEXT REFERENCES public.cuentas(id) ON DELETE SET NULL,
    mesa_id TEXT,
    nombre_mesa TEXT,
    folio_ticket TEXT,
    rfc_receptor TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    codigo_postal TEXT NOT NULL,
    regimen_fiscal TEXT NOT NULL,
    uso_cfdi TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    iva NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    propina_excluida NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    metodo_pago_sat TEXT NOT NULL DEFAULT '01',
    clave_prod_serv TEXT NOT NULL DEFAULT '90101501',
    clave_unidad TEXT NOT NULL DEFAULT 'E48',
    estado TEXT NOT NULL DEFAULT 'solicitada', -- solicitada, timbrada, cancelada
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uuid_sat TEXT,
    url_xml TEXT,
    url_pdf TEXT,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_facturas_cuenta_id ON public.facturas_cfdi(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_facturas_rfc_receptor ON public.facturas_cfdi(rfc_receptor);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON public.facturas_cfdi(estado);

-- Publicación en Realtime para sincronizar facturas emitidas entre terminales
ALTER PUBLICATION supabase_realtime ADD TABLE public.facturas_cfdi;

-- Políticas de seguridad RLS
ALTER TABLE public.facturas_cfdi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total para clientes autorizados anon facturas"
ON public.facturas_cfdi FOR ALL
TO anon
USING (true)
WITH CHECK (true);
