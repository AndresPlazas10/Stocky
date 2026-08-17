-- =====================================================
-- CONSOLIDACIÓN DE POLÍTICAS RLS (order_items / sale_details)
-- Fecha: 2026-08-16
--
-- Objetivo: reducir el costo de evaluación RLS. Según el snapshot real de la
-- base (marzo 2026), order_items tiene 9 políticas y sale_details 6, casi
-- todas duplicadas con la misma expresión. Las políticas se evalúan OR-wise
-- en cada operación, multiplicando el trabajo.
--
-- SEGURIDAD PARA USUARIOS ACTIVOS:
--  * Se conserva SIEMPRE la política canónica (*_realtime_access_policy,
--    FOR ALL con can_access_business = dueño + empleados activos), que es
--    estrictamente un superset de las que se eliminan.
--  * ANTES de borrar nada se verifica que la política canónica exista en la
--    base; si no existe (base divergida del snapshot), se emite un NOTICE y
--    se OMITE la limpieza de esa tabla — jamás se deja la tabla sin política.
--  * Cada drop usa DROP POLICY IF EXISTS: no-op si la política ya no existe.
--  * No hay ALTER TABLE ni cambios de estructura.
-- =====================================================

DO $$
DECLARE
  v_dropped int := 0;
BEGIN
  -- ------------------------------------------------------------------
  -- order_items: conservar order_items_realtime_access_policy (canónica).
  -- Eliminar 8 duplicadas: select/insert/update/delete (legacy) + *_policy.
  -- ------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'order_items_realtime_access_policy'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS order_items_select ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_insert ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_update ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_delete ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_select_policy ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_insert_policy ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_update_policy ON public.order_items';
    EXECUTE 'DROP POLICY IF EXISTS order_items_delete_policy ON public.order_items';
    v_dropped := v_dropped + 8;
    RAISE NOTICE 'order_items: duplicadas eliminadas (canónica conservada)';
  ELSE
    RAISE NOTICE 'order_items: canónica NO encontrada — limpieza omitida por seguridad';
  END IF;

  -- ------------------------------------------------------------------
  -- sale_details: conservar sale_details_realtime_access_policy (canónica,
  -- can_access_business = superset). Eliminar la policy ALL antigua
  -- (sale_details_access_policy, basada en user_id) + las 4 *_policy.
  -- ------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_details'
      AND policyname = 'sale_details_realtime_access_policy'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS sale_details_access_policy ON public.sale_details';
    EXECUTE 'DROP POLICY IF EXISTS sale_details_select_policy ON public.sale_details';
    EXECUTE 'DROP POLICY IF EXISTS sale_details_insert_policy ON public.sale_details';
    EXECUTE 'DROP POLICY IF EXISTS sale_details_update_policy ON public.sale_details';
    EXECUTE 'DROP POLICY IF EXISTS sale_details_delete_policy ON public.sale_details';
    v_dropped := v_dropped + 5;
    RAISE NOTICE 'sale_details: duplicadas eliminadas (canónica conservada)';
  ELSE
    RAISE NOTICE 'sale_details: canónica NO encontrada — limpieza omitida por seguridad';
  END IF;

  RAISE NOTICE 'Consolidación RLS completada: % políticas duplicadas eliminadas', v_dropped;
END $$;

-- =====================================================
-- Fin
-- =====================================================
