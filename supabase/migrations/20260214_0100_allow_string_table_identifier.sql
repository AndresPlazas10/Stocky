-- ============================================================
-- Permitir identificador de mesa como texto (no solo número)
-- Fecha: 2026-02-14
-- Objetivo: aceptar valores tipo "A1", "Terraza-2", etc.
-- ============================================================

ALTER TABLE public.tables
  ALTER COLUMN table_number TYPE text USING table_number::text;

-- Normaliza posibles espacios residuales en datos previos.
UPDATE public.tables
SET table_number = btrim(table_number)
WHERE table_number IS NOT NULL
  AND table_number <> btrim(table_number);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_table_number_not_blank'
      AND conrelid = 'public.tables'::regclass
  ) THEN
    ALTER TABLE public.tables
      ADD CONSTRAINT tables_table_number_not_blank
      CHECK (length(btrim(table_number)) > 0);
  END IF;
END $$;
