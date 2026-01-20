# Guía: Aplicar RLS Sin Dependencias Circulares

## ✅ ¿Por qué estas políticas NO generan problemas?

### El Problema Anterior (Dependencia Circular)
```sql
-- ❌ POLÍTICA MALA (causaba 403)
CREATE POLICY "employees_insert"
  ON employees FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses 
      WHERE created_by = auth.uid()  -- ⚠️ Consulta businesses con RLS
    )
  );
```

**Problema**: Para insertar un empleado, necesita verificar la tabla `businesses`, pero `businesses` tiene RLS que bloquea la consulta → **403 Forbidden**

### La Solución (Función Helper con SECURITY DEFINER)
```sql
-- ✅ FUNCIÓN QUE BYPASEA RLS
CREATE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID)
SECURITY DEFINER  -- ← CLAVE: Ejecuta con permisos del creador
AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  SELECT b.id FROM businesses b
  INNER JOIN employees e ON e.business_id = b.id
  WHERE e.user_id = auth.uid();
END;
$$;

-- ✅ POLÍTICA BUENA (sin dependencia circular)
CREATE POLICY "employees_insert"
  ON employees FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())  -- ← Usa función helper
  );
```

**Ventaja**: La función `get_user_business_ids()` bypasea RLS porque usa `SECURITY DEFINER`, eliminando la dependencia circular.

---

## 📋 Pasos para Aplicar las Políticas

### Paso 1: Abrir Supabase SQL Editor
1. Ve a [supabase.com](https://supabase.com)
2. Abre tu proyecto **Stocky**
3. Ir a **SQL Editor** (menú lateral izquierdo)
4. Click en **New Query**

### Paso 2: Copiar y Ejecutar el Script
1. Abre el archivo: `docs/sql/rls_sin_dependencias_circulares.sql`
2. **Copia TODO el contenido** del archivo
3. Pégalo en el SQL Editor de Supabase
4. Click en **Run** (o presiona `Ctrl/Cmd + Enter`)

### Paso 3: Verificar que se Aplicó Correctamente
Ejecuta esta consulta para verificar las políticas:

```sql
-- Ver todas las políticas creadas
SELECT 
  tablename,
  policyname,
  cmd AS operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Deberías ver:
- ✅ `businesses_select`, `businesses_insert`, `businesses_update`, `businesses_delete`
- ✅ `employees_select`, `employees_insert`, `employees_update`, `employees_delete`
- ✅ `products_all`
- ✅ `sales_all`
- ✅ `purchases_all`
- ✅ Y todas las demás tablas con políticas `_all`

### Paso 4: Verificar la Función Helper
```sql
-- Verificar que la función existe y funciona
SELECT * FROM get_user_business_ids();
```

Si estás logueado, debería devolver los IDs de tus negocios.

---

## 🧪 Probar Creación de Empleados

### En la Aplicación (Frontend)
1. Inicia sesión en tu aplicación
2. Ve a la sección **Empleados**
3. Intenta crear un nuevo empleado con:
   - Usuario: `test@example.com`
   - Contraseña: `Test123!`
   - Nombre: `Test Employee`
   - Rol: `Vendedor`

### Verificar en Supabase
Si todo funciona correctamente:
- ✅ NO debe aparecer error **403 Forbidden**
- ✅ NO debe aparecer "Ya existe una cuenta"
- ✅ El empleado debe crearse exitosamente

Si hay errores:
1. Abre la consola del navegador (`F12`)
2. Ve a la pestaña **Network**
3. Busca el request POST que falló
4. Copia el error y envíamelo

---

## 🔧 Comandos de Troubleshooting

### Ver qué políticas tiene una tabla específica
```sql
SELECT * FROM pg_policies WHERE tablename = 'employees';
```

### Ver si RLS está habilitado en una tabla
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('businesses', 'employees', 'products', 'sales');
```

### Deshabilitar RLS temporalmente (para debugging)
```sql
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
```

### Re-habilitar RLS
```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
```

### Ver logs de errores de RLS
En Supabase Studio:
1. Ve a **Logs** (menú lateral)
2. Selecciona **Postgres Logs**
3. Busca errores relacionados con "policy"

---

## 📊 Comparación: Antes vs Después

### ❌ ANTES (con dependencia circular)
```
Usuario crea empleado
    ↓
Política verifica: ¿business_id es tuyo?
    ↓
Consulta tabla businesses con RLS
    ↓
RLS de businesses bloquea consulta
    ↓
❌ 403 FORBIDDEN
```

### ✅ DESPUÉS (con función helper)
```
Usuario crea empleado
    ↓
Política verifica: ¿business_id es tuyo?
    ↓
Llama get_user_business_ids() con SECURITY DEFINER
    ↓
Función bypasea RLS y devuelve IDs
    ↓
Política permite inserción
    ↓
✅ EMPLEADO CREADO
```

---

## 🛡️ Seguridad

### ¿Es seguro usar SECURITY DEFINER?
**Sí**, porque:
1. La función SOLO devuelve IDs basados en `auth.uid()`
2. NO acepta parámetros del usuario
3. NO ejecuta código arbitrario
4. Solo devuelve negocios que el usuario tiene permiso de ver

### ¿Qué hace SECURITY DEFINER?
- Ejecuta la función con los permisos del **creador** (normalmente postgres/superuser)
- Bypasea RLS durante la ejecución de la función
- Pero SOLO dentro de la función, no afecta al resto

### ¿Es más seguro que desactivar RLS?
**Sí**, mucho más:
- Con RLS desactivado: Cualquier usuario puede ver/modificar TODO
- Con esta función: Solo ves tus propios negocios, validado por `auth.uid()`

---

## 🚀 Siguiente Paso

Después de aplicar las políticas:
1. ✅ Verificar que employee creation funciona
2. ✅ Verificar que no puedes ver negocios de otros usuarios
3. ✅ Verificar que productos/ventas/compras funcionan correctamente
4. ⏳ Limpiar negocios de prueba creados el 12 de diciembre

---

## 📞 Si Algo Sale Mal

### Error: "function get_user_business_ids() does not exist"
**Solución**: Vuelve a ejecutar la parte de creación de función:
```sql
CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  SELECT b.id FROM businesses b
  INNER JOIN employees e ON e.business_id = b.id
  WHERE e.user_id = auth.uid() AND e.is_active = true;
END;
$$;
```

### Error: "permission denied for table businesses"
**Solución**: Asegúrate de ejecutar el script completo en Supabase SQL Editor (no en la consola del navegador).

### Sigue apareciendo 403
1. Verifica que RLS esté habilitado: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'employees';`
2. Verifica que las políticas existan: `SELECT * FROM pg_policies WHERE tablename = 'employees';`
3. Verifica que la función devuelva tus business IDs: `SELECT * FROM get_user_business_ids();`

---

**¿Listo para aplicar las políticas?** Simplemente copia el archivo SQL y ejecútalo en Supabase.
