-- =====================================================
-- PERMITIR ROL 'kitchen' EN employees.role
-- Fecha: 2026-08-13
-- Objetivo: la BD de producción tiene la constraint
-- `employees_role_check` (creada manualmente fuera del
-- repo) que bloquea el valor 'kitchen' al crear empleados
-- de cocina:
--   ERROR: new row for relation "employees" violates
--   check constraint "employees_role_check"
-- Solución: reconstruir la constraint conservando los
-- valores actuales y agregando 'kitchen' y 'cocina'.
-- Idempotente: si la constraint no existe (BD nueva),
-- se crea con el conjunto canónico de valores.
-- =====================================================

DO $$
DECLARE
  v_condef TEXT;
  v_vals TEXT[];
  v_item TEXT;
  v_sql TEXT;
BEGIN
  -- 1) Leer definición actual de la constraint (si existe)
  SELECT pg_get_constraintdef(oid) INTO v_condef
  FROM pg_constraint
  WHERE conname = 'employees_role_check'
    AND conrelid = 'public.employees'::regclass;

  IF v_condef IS NOT NULL THEN
    -- Extraer los literales citados (valores permitidos actuales)
    v_vals := ARRAY(
      SELECT DISTINCT regexp_replace(m[1], '''', '', 'g')
      FROM regexp_matches(v_condef, '''([^'']+)''', 'g') AS m
    );

    -- Si el formato no fue reconocido, usar el conjunto canónico
    IF array_length(v_vals, 1) IS NULL THEN
      v_vals := ARRAY['owner', 'admin', 'employee', 'cashier', 'manager', 'waiter'];
    END IF;

    ALTER TABLE public.employees DROP CONSTRAINT employees_role_check;
  ELSE
    v_vals := ARRAY['owner', 'admin', 'employee', 'cashier', 'manager', 'waiter'];
  END IF;

  -- 2) Agregar 'kitchen' y 'cocina' si faltan
  FOREACH v_item IN ARRAY ARRAY['kitchen', 'cocina'] LOOP
    IF NOT (v_item = ANY (v_vals)) THEN
      v_vals := v_vals || v_item;
    END IF;
  END LOOP;

  -- 3) Reconstruir la constraint con el conjunto completo
  v_sql := 'ALTER TABLE public.employees ADD CONSTRAINT employees_role_check '
        || 'CHECK (role = ANY (ARRAY[' || (
          SELECT string_agg(quote_literal(v), ', ') FROM unnest(v_vals) AS u(v)
        ) || ']::text[]))';

  EXECUTE v_sql;

  RAISE NOTICE 'employees_role_check reconstruida con valores: %',
    (SELECT string_agg(v, ', ') FROM unnest(v_vals) AS u(v));
END $$;
