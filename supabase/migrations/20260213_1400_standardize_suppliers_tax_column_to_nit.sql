-- ============================================================
-- Estandariza columna fiscal de proveedores a `nit`
-- Fecha: 2026-02-13
-- Objetivo:
--   - Si existe `tax_id` y NO existe `nit`: renombrar `tax_id` -> `nit`
--   - Si existen ambas: migrar datos faltantes de `tax_id` a `nit` y eliminar `tax_id`
--   - Si ya existe solo `nit`: no hacer cambios
-- ============================================================

BEGIN;

DO $$
DECLARE
  has_nit boolean;
  has_tax_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'nit'
  ) INTO has_nit;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'tax_id'
  ) INTO has_tax_id;

  IF has_tax_id AND NOT has_nit THEN
    EXECUTE 'ALTER TABLE public.suppliers RENAME COLUMN tax_id TO nit';
    RAISE NOTICE 'Columna renombrada: suppliers.tax_id -> suppliers.nit';
  ELSIF has_tax_id AND has_nit THEN
    EXECUTE $sql$
      UPDATE public.suppliers
      SET nit = COALESCE(NULLIF(BTRIM(nit), ''), tax_id)
      WHERE (nit IS NULL OR BTRIM(nit) = '')
        AND tax_id IS NOT NULL
    $sql$;

    EXECUTE 'ALTER TABLE public.suppliers DROP COLUMN tax_id';
    RAISE NOTICE 'Datos migrados de tax_id a nit y columna tax_id eliminada';
  ELSE
    RAISE NOTICE 'No se requieren cambios: estructura de suppliers ya estandarizada';
  END IF;

  -- Mantener documentación consistente, solo si nit existe.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'nit'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.suppliers.nit IS ''NIT o RUT del proveedor''';
  END IF;
END $$;

COMMIT;
