-- ============================================================
-- Script de diagnóstico y corrección para combo "Cubetazo"
-- Fecha: 2026-07-15
-- ============================================================

-- PASO 1: Diagnosticar el combo "Cubetazo"
-- Ejecutar primero para ver el estado actual
SELECT 
  c.id AS combo_id,
  c.nombre,
  c.precio_venta,
  c.estado,
  c.business_id,
  COUNT(ci.id) AS total_items
FROM public.combos c
LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
WHERE lower(c.nombre) LIKE '%cubetazo%'
GROUP BY c.id, c.nombre, c.precio_venta, c.estado, c.business_id;

-- PASO 2: Ver los items del combo (si tiene)
SELECT 
  ci.id AS combo_item_id,
  ci.combo_id,
  ci.producto_id,
  ci.cantidad,
  p.name AS producto_nombre,
  p.stock AS producto_stock,
  p.is_active AS producto_activo
FROM public.combo_items ci
JOIN public.combos c ON c.id = ci.combo_id
LEFT JOIN public.products p ON p.id = ci.producto_id
WHERE lower(c.nombre) LIKE '%cubetazo%';

-- PASO 3: Ver todos los combos sin items (para detectar más combos problemáticos)
SELECT 
  c.id AS combo_id,
  c.nombre,
  c.precio_venta,
  c.estado,
  c.business_id
FROM public.combos c
LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
WHERE ci.id IS NULL
  AND c.estado = 'active';

-- ============================================================
-- CORRECCIÓN: Opción A - Agregar items al combo "Cubetazo"
-- Descomentar y ajustar los product_id según los productos
-- que debería contener el combo
-- ============================================================
/*
-- Ejemplo: Si "Cubetazo" debe contener 2 productos
INSERT INTO public.combo_items (combo_id, producto_id, cantidad)
SELECT 
  c.id AS combo_id,
  'PRODUCTO_UUID_1'::uuid AS producto_id,
  1 AS cantidad
FROM public.combos c
WHERE lower(c.nombre) LIKE '%cubetazo%'
  AND NOT EXISTS (
    SELECT 1 FROM public.combo_items ci WHERE ci.combo_id = c.id
  );

INSERT INTO public.combo_items (combo_id, producto_id, cantidad)
SELECT 
  c.id AS combo_id,
  'PRODUCTO_UUID_2'::uuid AS producto_id,
  2 AS cantidad
FROM public.combos c
WHERE lower(c.nombre) LIKE '%cubetazo%'
  AND NOT EXISTS (
    SELECT 1 FROM public.combo_items ci WHERE ci.combo_id = c.id
  );
*/

-- ============================================================
-- CORRECCIÓN: Opción B - Desactivar combo sin items
-- Usar si el combo no debería estar activo
-- ============================================================
/*
UPDATE public.combos
SET estado = 'inactive',
    updated_at = timezone('utc', now())
WHERE lower(nombre) LIKE '%cubetazo%'
  AND NOT EXISTS (
    SELECT 1 FROM public.combo_items ci WHERE ci.combo_id = combos.id
  );
*/

-- ============================================================
-- VERIFICACIÓN: Confirmar que no hay combos activos sin items
-- ============================================================
SELECT 
  'Combos activos sin items' AS problema,
  COUNT(*) AS total
FROM public.combos c
LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
WHERE c.estado = 'active'
  AND ci.id IS NULL;
