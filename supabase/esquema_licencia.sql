-- ==============================================================================
-- Esquema de Control de Licencia y Estado de Suscripción (LA ESTACIÓN GRILL)
-- ==============================================================================

-- 1. Tabla principal de control de licencia
CREATE TABLE IF NOT EXISTS public.licencia_sistema (
  id TEXT PRIMARY KEY DEFAULT 'principal',
  activa BOOLEAN NOT NULL DEFAULT true,
  motivo TEXT NOT NULL DEFAULT 'PAGO_PENDIENTE',
  titulo TEXT NOT NULL DEFAULT 'Servicio Temporalmente Suspendido',
  mensaje TEXT NOT NULL DEFAULT 'El acceso al sistema ha sido suspendido temporalmente por falta de pago de la suscripción o licencia de uso.',
  contacto TEXT NOT NULL DEFAULT 'Favor de comunicarse con el proveedor del sistema para regularizar su cuenta y reactivar el servicio.',
  fecha_vencimiento TIMESTAMPTZ,
  fecha_suspension TIMESTAMPTZ,
  actualizado_el TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Registro predeterminado (Activo por defecto)
INSERT INTO public.licencia_sistema (id, activa, motivo, titulo, mensaje, contacto)
VALUES (
  'principal',
  true,
  'AL_CORRIENTE',
  'Servicio Activo',
  'El sistema se encuentra al corriente y operando con normalidad.',
  'Soporte Técnico Oficial'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar Seguridad por Nivel de Fila (RLS)
ALTER TABLE public.licencia_sistema ENABLE ROW LEVEL SECURITY;

-- 4. Política: Lectura pública para que las terminales puedan verificar su estado
DROP POLICY IF EXISTS "Lectura publica del estado de licencia" ON public.licencia_sistema;
CREATE POLICY "Lectura publica del estado de licencia"
ON public.licencia_sistema
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Política: Solo el administrador (service_role) puede modificar el estado de la licencia
-- Cualquier intento de INSERT/UPDATE/DELETE desde el cliente con anon key será rechazado
DROP POLICY IF EXISTS "Solo service_role modifica licencia" ON public.licencia_sistema;
CREATE POLICY "Solo service_role modifica licencia"
ON public.licencia_sistema
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Habilitar publicación Realtime para que los cambios se reflejen de inmediato en todas las terminales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'licencia_sistema'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.licencia_sistema;
  END IF;
END $$;
