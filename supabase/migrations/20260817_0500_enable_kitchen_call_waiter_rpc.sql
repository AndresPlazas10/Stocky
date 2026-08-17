-- ============================================================
-- ENABLE KITCHEN CALL WAITER - RPC dedicado para call_requested_at
-- Fecha: 2026-08-17
-- Objetivo: permitir que el rol cocina (solo lectura por el hardening
-- 20260817_0100/0200) pueda "llamar al mesero" sin violar la garantía
-- de solo lectura. El flujo actual hacia un UPDATE directo sobre
-- public.tables (columna call_requested_at), que RLS bloquea para
-- kitchen/cocina (tables_update_policy WITH CHECK can_operate_business).
--
-- Se exponen RPCs SECURITY DEFINER que validan membresía con
-- can_access_business (cualquier empleado activo, incluido cocina) y
-- actualizan SOLO la columna call_requested_at.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) set_table_call_requested: registra el llamado del mesero.
--    Autoriza por membresía (can_access_business) para que cocina
--    pueda llamar; solo toca call_requested_at.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_table_call_requested(
  p_table_id uuid,
  p_business_id uuid,
  p_called_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para llamar al mesero en este negocio';
  END IF;

  UPDATE public.tables
  SET call_requested_at = p_called_at
  WHERE id = p_table_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa no encontrada en este negocio';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_table_call_requested(uuid,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_table_call_requested(uuid,uuid,timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_table_call_requested(uuid,uuid,timestamptz) TO authenticated;

COMMENT ON FUNCTION public.set_table_call_requested(uuid,uuid,timestamptz)
IS 'Registra el llamado al mesero (call_requested_at) de una mesa del negocio. Autoriza por membresía (can_access_business): el rol cocina puede llamar sin escribir el resto de la mesa.';

-- ------------------------------------------------------------
-- 2) clear_table_call_requested: limpia el llamado cuando el mesero
--    atiende la mesa.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_table_call_requested(
  p_table_id uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para limpiar el llamado de este negocio';
  END IF;

  UPDATE public.tables
  SET call_requested_at = NULL
  WHERE id = p_table_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa no encontrada en este negocio';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_table_call_requested(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_table_call_requested(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_table_call_requested(uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.clear_table_call_requested(uuid,uuid)
IS 'Limpia el llamado al mesero (call_requested_at) de una mesa del negocio. Autoriza por membresía (can_access_business).';

COMMIT;