-- ============================================================
-- VALIDACION POST-MIGRACION: RLS negocio en employees/sales/purchases
-- Fecha: 2026-02-13
-- Uso: Ejecutar en Supabase SQL Editor despues de aplicar migraciones.
-- Objetivo:
--   1) Verificar que can_access_business contempla is_active NULL como activo.
--   2) Verificar policies esperadas en sales y employees.
--   3) Validar acceso efectivo para owner/employee/outsider.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Check estatico de funcion y policies
-- ------------------------------------------------------------
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'can_access_business'
    AND pg_get_function_identity_arguments(p.oid) = 'p_business_id uuid'
)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM fn)
    THEN 'OK'
    ELSE 'MISSING'
  END AS can_access_business_exists,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM fn
      WHERE def ILIKE '%COALESCE(e.is_active, true) = true%'
    )
    THEN 'OK'
    ELSE 'REVIEW'
  END AS can_access_business_null_active_compat;

SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'sales' AND policyname IN ('sales_access_policy', 'sales_select_policy'))
    OR
    (tablename = 'employees' AND policyname IN ('employees_select_policy', 'employees_select_all'))
  )
ORDER BY tablename, policyname;

-- ------------------------------------------------------------
-- 2) Validacion funcional (sin escrituras, solo SELECT)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_business_id uuid;
  v_owner_uid uuid;
  v_employee_uid uuid;
  v_outsider_uid uuid;

  v_expected_sales integer := 0;
  v_expected_purchases integer := 0;
  v_expected_employees integer := 0;

  v_owner_sales integer := 0;
  v_owner_purchases integer := 0;
  v_owner_employees integer := 0;

  v_employee_sales integer := 0;
  v_employee_purchases integer := 0;
  v_employee_employees integer := 0;

  v_outsider_sales integer := 0;
  v_outsider_purchases integer := 0;
  v_outsider_employees integer := 0;
BEGIN
  -- Tomar un negocio que tenga owner + empleado activo (incluye is_active NULL).
  SELECT
    b.id,
    b.created_by,
    e.user_id
  INTO v_business_id, v_owner_uid, v_employee_uid
  FROM public.businesses b
  JOIN public.employees e
    ON e.business_id = b.id
   AND e.user_id <> b.created_by
   AND COALESCE(e.is_active, true) = true
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE NOTICE 'SKIP: No hay negocio con owner + empleado activo para validar RLS.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_expected_sales
  FROM public.sales s
  WHERE s.business_id = v_business_id;

  SELECT COUNT(*) INTO v_expected_purchases
  FROM public.purchases p
  WHERE p.business_id = v_business_id;

  SELECT COUNT(*) INTO v_expected_employees
  FROM public.employees e
  WHERE e.business_id = v_business_id;

  SELECT u.id INTO v_outsider_uid
  FROM auth.users u
  WHERE u.id <> v_owner_uid
    AND u.id <> v_employee_uid
  LIMIT 1;

  IF v_outsider_uid IS NULL THEN
    v_outsider_uid := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Owner
  PERFORM set_config('request.jwt.claim.sub', v_owner_uid::text, true);
  SELECT COUNT(*) INTO v_owner_sales
  FROM public.sales s
  WHERE s.business_id = v_business_id;
  SELECT COUNT(*) INTO v_owner_purchases
  FROM public.purchases p
  WHERE p.business_id = v_business_id;
  SELECT COUNT(*) INTO v_owner_employees
  FROM public.employees e
  WHERE e.business_id = v_business_id;

  -- Employee
  PERFORM set_config('request.jwt.claim.sub', v_employee_uid::text, true);
  SELECT COUNT(*) INTO v_employee_sales
  FROM public.sales s
  WHERE s.business_id = v_business_id;
  SELECT COUNT(*) INTO v_employee_purchases
  FROM public.purchases p
  WHERE p.business_id = v_business_id;
  SELECT COUNT(*) INTO v_employee_employees
  FROM public.employees e
  WHERE e.business_id = v_business_id;

  -- Outsider
  PERFORM set_config('request.jwt.claim.sub', v_outsider_uid::text, true);
  SELECT COUNT(*) INTO v_outsider_sales
  FROM public.sales s
  WHERE s.business_id = v_business_id;
  SELECT COUNT(*) INTO v_outsider_purchases
  FROM public.purchases p
  WHERE p.business_id = v_business_id;
  SELECT COUNT(*) INTO v_outsider_employees
  FROM public.employees e
  WHERE e.business_id = v_business_id;

  RAISE NOTICE 'Business test: %', v_business_id;
  RAISE NOTICE 'Expected totals -> sales: %, purchases: %, employees: %',
    v_expected_sales, v_expected_purchases, v_expected_employees;

  RAISE NOTICE 'Owner   -> sales: %, purchases: %, employees: %',
    v_owner_sales, v_owner_purchases, v_owner_employees;
  RAISE NOTICE 'Employee-> sales: %, purchases: %, employees: %',
    v_employee_sales, v_employee_purchases, v_employee_employees;
  RAISE NOTICE 'Outsider-> sales: %, purchases: %, employees: %',
    v_outsider_sales, v_outsider_purchases, v_outsider_employees;

  IF v_owner_sales <> v_expected_sales
     OR v_owner_purchases <> v_expected_purchases
     OR v_owner_employees <> v_expected_employees THEN
    RAISE NOTICE 'FAIL: owner no ve todos los registros del negocio.';
  ELSE
    RAISE NOTICE 'OK: owner ve los registros esperados.';
  END IF;

  IF v_employee_sales <> v_expected_sales
     OR v_employee_purchases <> v_expected_purchases
     OR v_employee_employees <> v_expected_employees THEN
    RAISE NOTICE 'FAIL: employee no ve todos los registros del negocio.';
  ELSE
    RAISE NOTICE 'OK: employee ve los registros esperados.';
  END IF;

  IF v_outsider_sales <> 0
     OR v_outsider_purchases <> 0
     OR v_outsider_employees <> 0 THEN
    RAISE NOTICE 'FAIL: outsider tiene acceso a registros de otro negocio.';
  ELSE
    RAISE NOTICE 'OK: outsider no tiene acceso.';
  END IF;
END $$;
