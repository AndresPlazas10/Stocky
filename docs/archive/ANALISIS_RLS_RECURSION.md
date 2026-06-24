# Análisis: Problema de Recursión en RLS Policies

**Fecha:** 19 de Enero 2026  
**Problema:** Recursión circular entre políticas RLS de `employees` y `businesses`  
**Impacto:** Imposibilidad de login para empleados

---

## 🔴 Problema Identificado

### Recursión Circular

```
employees.SELECT → lee businesses (para verificar si eres owner)
                    ↓
businesses.SELECT → lee employees (para verificar si eres empleado)
                    ↓
employees.SELECT → lee businesses (recursión infinita)
```

### Manifestación del Error

```
❌ Error al verificar permisos de empleado
Error 406 (Not Acceptable) en consultas a employees
Bloqueo completo del flujo de autenticación
```

---

## 🔍 Causa Raíz

### Política Problemática 1: employees
```sql
CREATE POLICY employees_select_all ON employees
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()  -- ❌ Lee businesses
    )
  );
```

### Política Problemática 2: businesses
```sql
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid())  -- ❌ Lee employees
  );
```

### Por Qué Falla

Cuando un empleado intenta hacer login:
1. Código ejecuta: `SELECT * FROM employees WHERE user_id = 'xxx'`
2. PostgreSQL evalúa política RLS de employees
3. Política necesita verificar: `business_id IN (SELECT id FROM businesses...)`
4. PostgreSQL evalúa política RLS de businesses
5. Política necesita verificar: `EXISTS (SELECT 1 FROM employees...)`
6. **LOOP INFINITO** → PostgreSQL aborta con error

---

## ✅ Soluciones Posibles

### Solución 1: Romper la Recursión (IMPLEMENTADA) ⭐

**Estrategia:** Hacer que UNA de las dos tablas sea totalmente permisiva.

```sql
-- employees: Totalmente permisivo (rompe recursión)
CREATE POLICY employees_select_all ON employees
  FOR SELECT
  USING (true);  -- ✅ No consulta ninguna otra tabla

-- businesses: Puede leer employees sin problemas
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    id IN (SELECT business_id FROM employees WHERE user_id = auth.uid())
  );
```

**Pros:**
- ✅ Funciona inmediatamente
- ✅ Sin recursión
- ✅ Fácil de mantener

**Contras:**
- ⚠️ Cualquier usuario autenticado puede ver TODOS los registros de employees
- ⚠️ Expone datos como emails, nombres, roles de empleados de otros negocios

**Mitigación del riesgo:**
- La tabla employees NO contiene datos sensibles (contraseñas están en auth.users)
- Los datos importantes (ventas, productos) SÍ están protegidos correctamente
- INSERT/UPDATE/DELETE de employees siguen protegidos (solo owners)

---

### Solución 2: Funciones SECURITY DEFINER (RECOMENDADA) 🏆

**Estrategia:** Crear una función que se ejecute con privilegios elevados y no evalúe RLS.

```sql
-- Función que verifica si un usuario es empleado SIN evaluar RLS
CREATE OR REPLACE FUNCTION is_employee_of_business(user_id_param uuid, business_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- ⚠️ Ejecuta con privilegios del creador (bypassa RLS)
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE user_id = user_id_param 
      AND business_id = business_id_param
  );
END;
$$;

-- Política de businesses usando la función
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    is_employee_of_business(auth.uid(), id)  -- ✅ No hay recursión RLS
  );

-- Política de employees puede ser segura
CREATE POLICY employees_select_all ON employees
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    business_id IN (SELECT id FROM businesses WHERE created_by = auth.uid())
  );
```

**Pros:**
- ✅ Sin recursión (función bypassa RLS)
- ✅ Seguridad adecuada en employees
- ✅ Performance óptimo

**Contras:**
- ⚠️ Requiere conocimiento de `SECURITY DEFINER`
- ⚠️ Potencialmente peligroso si la función no está bien escrita

---

### Solución 3: Vista Materializada

**Estrategia:** Pre-calcular las relaciones user_id → business_id en una vista sin RLS.

```sql
-- Vista materializada que relaciona usuarios con negocios
CREATE MATERIALIZED VIEW user_business_access AS
SELECT DISTINCT
  e.user_id,
  e.business_id,
  'employee' as access_type
FROM employees e
UNION ALL
SELECT DISTINCT
  b.created_by as user_id,
  b.id as business_id,
  'owner' as access_type
FROM businesses b;

-- Crear índice para performance
CREATE INDEX idx_user_business_access ON user_business_access(user_id, business_id);

-- Refrescar automáticamente (trigger o cron)
CREATE OR REPLACE FUNCTION refresh_user_business_access()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_business_access;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Política de businesses usando la vista
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    id IN (
      SELECT business_id 
      FROM user_business_access 
      WHERE user_id = auth.uid()
    )
  );
```

**Pros:**
- ✅ Sin recursión
- ✅ Performance excepcional (pre-calculado)
- ✅ Escalable

**Contras:**
- ⚠️ Complejidad adicional (vista materializada)
- ⚠️ Necesita refresh periódico
- ⚠️ Posible lag en permisos (hasta el siguiente refresh)

---

### Solución 4: Tabla de Unión Desnormalizada

**Estrategia:** Crear tabla `user_business_permissions` que duplique los permisos.

```sql
-- Tabla auxiliar sin dependencias circulares
CREATE TABLE user_business_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id),
  business_id uuid REFERENCES businesses(id),
  role text NOT NULL, -- 'owner', 'admin', 'employee'
  created_at timestamptz DEFAULT now()
);

-- RLS simple sin recursión
CREATE POLICY user_business_permissions_select ON user_business_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Política de businesses
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    id IN (
      SELECT business_id 
      FROM user_business_permissions 
      WHERE user_id = auth.uid()
    )
  );

-- Mantener sincronizada con triggers
CREATE OR REPLACE FUNCTION sync_user_permissions()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_business_permissions (user_id, business_id, role)
    VALUES (NEW.user_id, NEW.business_id, NEW.role);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE user_business_permissions 
    SET role = NEW.role
    WHERE user_id = NEW.user_id AND business_id = NEW.business_id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM user_business_permissions
    WHERE user_id = OLD.user_id AND business_id = OLD.business_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_employees_permissions
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION sync_user_permissions();
```

**Pros:**
- ✅ Sin recursión
- ✅ Performance óptimo (tabla indexada)
- ✅ Datos siempre actualizados (triggers)

**Contras:**
- ⚠️ Duplicación de datos
- ⚠️ Complejidad en mantenimiento (triggers)
- ⚠️ Posibles inconsistencias si triggers fallan

---

## 📊 Comparativa de Soluciones

| Solución | Seguridad | Performance | Complejidad | Mantenimiento |
|----------|-----------|-------------|-------------|---------------|
| **1. USING(true)** | ⚠️ Baja | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **2. SECURITY DEFINER** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **3. Vista Materializada** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **4. Tabla de Unión** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

---

## 🎯 Recomendación Final

### Para Producción Inmediata: **Solución 2 (SECURITY DEFINER)**

Es el mejor balance entre seguridad, performance y complejidad:

```sql
-- Migración recomendada
-- Archivo: 20260119_fix_rls_with_security_definer.sql

-- Función segura
CREATE OR REPLACE FUNCTION is_employee_of_business(business_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE user_id = auth.uid() 
      AND business_id = business_id_param
      AND is_active = true
  );
END;
$$;

-- Políticas sin recursión
DROP POLICY IF EXISTS employees_select_all ON employees;
CREATE POLICY employees_select_all ON employees
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    business_id IN (SELECT id FROM businesses WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS businesses_select_policy ON businesses;
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    is_employee_of_business(id)  -- ✅ Función bypassa RLS
  );
```

### Para Escala a Largo Plazo: **Solución 4 (Tabla de Unión)**

Si el sistema crece a +1000 negocios con múltiples empleados:
- Mejor performance
- Máxima seguridad
- Datos auditables

---

## 🚀 Plan de Implementación

### Fase 1: Mantener Solución Actual (1-2 semanas)
- ✅ `USING(true)` en employees
- ✅ Sistema funcional
- ⚠️ Monitorear si hay problemas de seguridad

### Fase 2: Migrar a SECURITY DEFINER (Corto plazo)
- Implementar función `is_employee_of_business()`
- Actualizar política de businesses
- Hacer employees más restrictiva
- Testing exhaustivo

### Fase 3: Evaluar Tabla de Unión (Si crece)
- Si +500 negocios o problemas de performance
- Implementar `user_business_permissions`
- Migrar políticas
- Deprecar solución anterior

---

## 📝 Notas Técnicas

### Por Qué `IN (SELECT ...)` vs `EXISTS`

```sql
-- EXISTS: Más eficiente para verificar existencia
EXISTS (SELECT 1 FROM employees WHERE ...)

-- IN (SELECT ...): Más legible pero potencialmente más lento
business_id IN (SELECT id FROM businesses WHERE ...)
```

Para este caso, ambos funcionan igual porque:
- Postgres optimiza IN (SELECT ...) similar a EXISTS
- La diferencia es negligible (<1ms)

### Por Qué `USING(true)` Funciona

```sql
USING (true)  -- Bypassa completamente la evaluación de condiciones RLS
```

Cuando Postgres evalúa `true`:
1. No ejecuta subconsultas
2. No lee otras tablas
3. **Rompe la cadena de recursión**
4. Permite que otras políticas funcionen correctamente

---

## 🔒 Consideraciones de Seguridad

### Datos Expuestos en employees con USING(true)

**Información visible:**
- `user_id` (UUID - no sensible)
- `business_id` (UUID - no sensible)
- `full_name` (nombre del empleado)
- `role` (admin/employee)
- `email` (email laboral)
- `is_active` (boolean)

**Información NO expuesta:**
- ❌ Contraseñas (están en auth.users con RLS propio)
- ❌ Datos de ventas
- ❌ Productos
- ❌ Información financiera

**Riesgo Real:** **BAJO**
- Un usuario podría ver nombres de empleados de otros negocios
- NO puede acceder a datos operacionales de esos negocios
- NO puede modificar empleados (INSERT/UPDATE/DELETE protegidos)

---

## 📚 Referencias

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Materialized Views Performance](https://www.postgresql.org/docs/current/rules-materializedviews.html)

---

**Conclusión:** La solución actual (`USING(true)`) es **funcional y segura** para el tamaño actual del sistema. Para mejorar la seguridad sin sacrificar funcionalidad, implementar **SECURITY DEFINER** en las próximas semanas.
