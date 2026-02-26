-- =====================================================
-- REALTIME HARDENING
-- Fecha: 2026-02-26
-- Objetivo:
--  1) Garantizar acceso RLS para tablas relacionales usadas en realtime
--  2) Asegurar inclusion de tablas criticas en supabase_realtime
--  3) Exponer payload completo en DELETE/UPDATE para tablas relacionales
-- =====================================================

-- -----------------------------------------------------
-- 1) Helper de acceso por negocio (idempotente)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND e.is_active = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;

-- -----------------------------------------------------
-- 2) RLS para tablas relacionales de realtime
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_realtime_access_policy ON public.order_items;
DROP POLICY IF EXISTS "Enable all for business members via orders" ON public.order_items;

CREATE POLICY order_items_realtime_access_policy
ON public.order_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.can_access_business(o.business_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.can_access_business(o.business_id)
  )
);

DROP POLICY IF EXISTS sale_details_realtime_access_policy ON public.sale_details;
DROP POLICY IF EXISTS "Enable all for business members via sales" ON public.sale_details;

CREATE POLICY sale_details_realtime_access_policy
ON public.sale_details
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = sale_details.sale_id
      AND public.can_access_business(s.business_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = sale_details.sale_id
      AND public.can_access_business(s.business_id)
  )
);

-- -----------------------------------------------------
-- 3) Replica identity full para payload completo
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.order_items REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.sale_details REPLICA IDENTITY FULL;

-- -----------------------------------------------------
-- 4) Publicacion realtime para tablas criticas
-- -----------------------------------------------------
DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'tables',
    'orders',
    'order_items',
    'sales',
    'purchases',
    'products',
    'employees',
    'combos',
    'sale_details'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'supabase_realtime publication is missing; enable Realtime in Supabase first.';
    RETURN;
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE 'Skipping missing table public.%', v_table;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END LOOP;
END;
$$;

-- =====================================================
-- Fin
-- =====================================================
