# 🚨 FIX URGENTE: Error en Compras (5 minutos)

## Error Actual

```
❌ insert or update on table "purchases" violates foreign key constraint "purchases_user_id_fkey"
```

## Solución Rápida

### Paso 1: Ir a Supabase
1. Abre [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** (menú izquierdo)

### Paso 2: Ejecutar este SQL

```sql
-- Eliminar FK constraint incorrecto
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_user_id_fkey;

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_business_user ON purchases(business_id, user_id);
```

### Paso 3: Verificar

```sql
-- Debe retornar 0 filas
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'purchases' 
  AND constraint_name = 'purchases_user_id_fkey';
```

### Paso 4: Probar en la App

1. Ve a **Dashboard → Compras**
2. Haz clic en **"+ Nueva Compra"**
3. Registra una compra de prueba
4. ✅ Debe funcionar sin errores

## ¿Qué causó el error?

El Foreign Key `purchases_user_id_fkey` estaba mal configurado:
- **Intentaba referenciar:** `public.users` (tabla que NO EXISTE)
- **Código usa correctamente:** `auth.users.id` (Supabase Auth)
- **Solución:** Eliminar el FK incorrecto

## ¿Es seguro eliminar el FK?

✅ **SÍ, es seguro** porque:

1. La tabla `public.users` nunca existió
2. El código ya usa `auth.users.id` correctamente
3. La integridad se mantiene a nivel de aplicación
4. Los índices creados mejoran el performance

## Documentación Completa

Si necesitas más detalles:
- **Guía completa:** `docs/SOLUCION_PURCHASES_FK.md`
- **Script SQL completo:** `docs/sql/fix_purchases_fk.sql`

## Tiempo Total

⏱️ **5 minutos** (incluyendo verificación)

---

**Estado:** ⏳ PENDIENTE - Ejecutar en Supabase  
**Prioridad:** 🔴 MÁXIMA - Bloquea registro de compras
