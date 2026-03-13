-- ============================================================
-- Bloqueo de edición por mesa (con TTL)
-- Fecha: 2026-03-08
-- Objetivo: evitar edición concurrente de una misma mesa.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.table_edit_locks (
  table_id uuid PRIMARY KEY REFERENCES public.tables(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  lock_owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_owner_name text NOT NULL DEFAULT 'Usuario',
  lock_token text,
  lock_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.table_edit_locks
  ADD COLUMN IF NOT EXISTS lock_owner_name text NOT NULL DEFAULT 'Usuario',
  ADD COLUMN IF NOT EXISTS lock_token text,
  ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'table_edit_locks_owner_name_not_blank'
      AND conrelid = 'public.table_edit_locks'::regclass
  ) THEN
    ALTER TABLE public.table_edit_locks
      ADD CONSTRAINT table_edit_locks_owner_name_not_blank
      CHECK (length(btrim(lock_owner_name)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_table_edit_locks_business_expires
  ON public.table_edit_locks (business_id, lock_expires_at);

CREATE OR REPLACE FUNCTION public.set_table_edit_locks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_table_edit_locks_updated_at ON public.table_edit_locks;
CREATE TRIGGER trg_table_edit_locks_updated_at
BEFORE UPDATE ON public.table_edit_locks
FOR EACH ROW
EXECUTE FUNCTION public.set_table_edit_locks_updated_at();

ALTER TABLE public.table_edit_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS table_edit_locks_select_policy ON public.table_edit_locks;
CREATE POLICY table_edit_locks_select_policy
ON public.table_edit_locks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = table_edit_locks.business_id
      AND b.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = table_edit_locks.business_id
      AND e.user_id = auth.uid()
      AND COALESCE(e.is_active, true) = true
  )
);

DROP POLICY IF EXISTS table_edit_locks_insert_policy ON public.table_edit_locks;
CREATE POLICY table_edit_locks_insert_policy
ON public.table_edit_locks
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND lock_owner_user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = table_edit_locks.business_id
        AND b.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.business_id = table_edit_locks.business_id
        AND e.user_id = auth.uid()
        AND COALESCE(e.is_active, true) = true
    )
  )
);

DROP POLICY IF EXISTS table_edit_locks_update_policy ON public.table_edit_locks;
CREATE POLICY table_edit_locks_update_policy
ON public.table_edit_locks
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND lock_owner_user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND lock_owner_user_id = auth.uid()
);

DROP POLICY IF EXISTS table_edit_locks_delete_policy ON public.table_edit_locks;
CREATE POLICY table_edit_locks_delete_policy
ON public.table_edit_locks
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND lock_owner_user_id = auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_edit_locks TO authenticated;
