-- ==============================================================================
-- Migración: Agregar columna seller_name a sales
-- ==============================================================================
-- Ejecutar en: Supabase SQL Editor

-- 1) Agregar columna si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'seller_name'
  ) THEN
    ALTER TABLE sales ADD COLUMN seller_name text;
  END IF;
END $$;

-- 2) Opcional: índice para búsquedas por vendedor
CREATE INDEX IF NOT EXISTS sales_seller_name_idx ON sales (seller_name);

-- 3) Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'seller_name';
