-- =====================================================
-- MIGRACIÓN: Agregar columnas faltantes
-- =====================================================
-- Script para agregar las columnas que faltan en
-- employees y sales basado en la estructura actual
-- =====================================================

-- =====================================================
-- PARTE 1: Agregar columnas a EMPLOYEES
-- =====================================================

-- Agregar access_code
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE employees ADD COLUMN access_code TEXT;
    RAISE NOTICE '✅ Columna access_code agregada a employees';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columna access_code ya existe en employees';
  END;
END $$;

-- Agregar updated_at
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE employees ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Columna updated_at agregada a employees';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columna updated_at ya existe en employees';
  END;
END $$;

-- =====================================================
-- PARTE 2: Agregar columnas a SALES
-- =====================================================

-- Agregar customer_id
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE sales ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Columna customer_id agregada a sales';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columna customer_id ya existe en sales';
  END;
END $$;

-- Agregar notes
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE sales ADD COLUMN notes TEXT;
    RAISE NOTICE '✅ Columna notes agregada a sales';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columna notes ya existe en sales';
  END;
END $$;

-- =====================================================
-- PARTE 3: Crear índices necesarios
-- =====================================================

-- Índice para access_code en employees
CREATE INDEX IF NOT EXISTS idx_employees_access_code 
  ON employees(access_code) 
  WHERE access_code IS NOT NULL;

-- Índice para customer_id en sales
CREATE INDEX IF NOT EXISTS idx_sales_customer_id 
  ON sales(customer_id);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ MIGRACIÓN COMPLETADA';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Columnas agregadas a EMPLOYEES:';
  RAISE NOTICE '  - access_code (TEXT)';
  RAISE NOTICE '  - updated_at (TIMESTAMPTZ)';
  RAISE NOTICE '';
  RAISE NOTICE 'Columnas agregadas a SALES:';
  RAISE NOTICE '  - customer_id (UUID FK → customers)';
  RAISE NOTICE '  - notes (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Índices creados:';
  RAISE NOTICE '  - idx_employees_access_code';
  RAISE NOTICE '  - idx_sales_customer_id';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;
