-- ===================================================================
-- TAQUERÍA KM 243 / LA ESTACIÓN GRILL
-- TABLA DE REGISTROS DEL SISTEMA, AUDITORÍA Y CRASH REPORTING
-- Ejecuta este script en el "SQL Editor" de tu proyecto de Supabase
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nivel TEXT NOT NULL CHECK (nivel IN ('CRASH', 'ERROR', 'WARN', 'INFO')),
    origen TEXT NOT NULL DEFAULT 'frontend-pos',
    dispositivo_id TEXT NOT NULL DEFAULT 'desconocido',
    mensaje TEXT NOT NULL,
    detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas de alta velocidad por nivel, dispositivo y fecha
CREATE INDEX IF NOT EXISTS idx_logs_sistema_nivel ON public.logs_sistema (nivel);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_creado_en ON public.logs_sistema (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_dispositivo ON public.logs_sistema (dispositivo_id);

-- Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

-- Política de lectura y escritura para terminales de restaurante (anon)
DROP POLICY IF EXISTS "Acceso completo anon logs_sistema" ON public.logs_sistema;
CREATE POLICY "Acceso completo anon logs_sistema"
ON public.logs_sistema
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Habilitar publicaciones en tiempo real para el panel de observabilidad
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'logs_sistema'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_sistema;
    END IF;
END $$;
