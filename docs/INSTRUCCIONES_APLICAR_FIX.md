# 🔧 Instrucciones para Aplicar la Corrección de Sincronización en Tiempo Real

## Resumen del Problema

Los cambios en productos de mesas no se sincronizaban en tiempo real entre diferentes cuentas del mismo negocio. Solo se veían al refrescar la página.

## Solución

Se implementaron 2 correcciones:

1. **Frontend** - Suscripción de Realtime a nivel de negocio (ya aplicada en el código)
2. **Backend** - Políticas RLS para `order_items` y `sale_details` (requiere ejecución SQL)

---

## 📋 Pasos para Aplicar la Solución

### 1. Verificar que el código frontend esté actualizado

El archivo `src/components/Dashboard/Mesas.jsx` ya contiene los cambios necesarios. Verifica que la suscripción de `order_items` incluya:

```javascript
useRealtimeSubscription('order_items', {
  enabled: !!businessId,
  filter: {}, // RLS se encarga del filtrado
  onInsert: (newItem) => handleOrderItemChange(newItem, 'INSERT'),
  onUpdate: (updatedItem) => handleOrderItemChange(updatedItem, 'UPDATE'),
  onDelete: (deletedItem) => handleOrderItemChange(deletedItem, 'DELETE')
});
```

### 2. Ejecutar el Script SQL Actualizado

#### Opción A: Desde el Editor SQL de Supabase (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor**
3. Crea una nueva query
4. Copia y pega **TODO** el contenido de `.archive/sql/enable_rls_fixed.sql`
5. Haz clic en **Run** o presiona `Cmd/Ctrl + Enter`
6. Verifica que se ejecutó sin errores

#### Opción B: Desde la Terminal

```bash
# Si tienes psql instalado y configurado
cd /Users/andres_plazas/Desktop/Stockly
psql -h <tu-host-supabase> -U postgres -d postgres -f .archive/sql/enable_rls_fixed.sql
```

### 3. Verificar que las Políticas se Aplicaron Correctamente

Ejecuta esta query en el SQL Editor de Supabase:

```sql
SELECT 
    tablename as "Tabla",
    policyname as "Política",
    cmd as "Operación"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('order_items', 'sale_details')
ORDER BY tablename, cmd;
```

**Resultado esperado:**

| Tabla        | Política                                   | Operación |
|--------------|-------------------------------------------|-----------|
| order_items  | Enable all for business members via orders | ALL       |
| sale_details | Enable all for business members via sales  | ALL       |

### 4. Probar la Sincronización

#### Prueba con 2 navegadores/cuentas:

1. **Navegador 1**: Inicia sesión con una cuenta del negocio
2. **Navegador 2**: Inicia sesión con otra cuenta del mismo negocio (o en modo incógnito con la misma cuenta)
3. **Navegador 1**: Abre una mesa y agrega un producto
4. **Navegador 2**: Ve la misma sección de mesas
5. ✅ **Verificar**: El cambio debe aparecer **inmediatamente** en el Navegador 2 sin necesidad de refrescar

#### Casos de prueba:

- [ ] Agregar producto a una mesa
- [ ] Modificar cantidad de un producto
- [ ] Eliminar un producto de la orden
- [ ] Cerrar una orden (debe liberar la mesa en ambas pantallas)
- [ ] Crear una nueva mesa (debe aparecer en todas las pantallas)

### 5. Monitorear en Producción

Si despliegas en producción, verifica en **Supabase Dashboard > Logs**:

- **Realtime Logs**: Confirma que los eventos de `order_items` se están transmitiendo
- **Database Logs**: Verifica que no haya errores relacionados con RLS

---

## 🔍 Troubleshooting

### Problema: Los cambios aún no se sincronizan

**Posibles causas:**

1. **RLS no habilitado**: Ejecuta:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('order_items', 'sale_details');
   ```
   Ambos deben tener `rowsecurity = true`

2. **Realtime no habilitado en la tabla**: Ve a **Database > Replication** en Supabase y asegúrate de que `order_items` y `sale_details` tengan Realtime habilitado.

3. **Canal no conectado**: Revisa la consola del navegador para ver si hay errores de conexión de Realtime.

### Problema: Errores de permisos al insertar/actualizar

**Solución**: Verifica que los GRANT estén aplicados:

```sql
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_name IN ('order_items', 'sale_details')
AND grantee = 'authenticated';
```

Debe mostrar permisos `SELECT, INSERT, UPDATE, DELETE` para ambas tablas.

---

## 📊 Verificación de Estado del Sistema

Ejecuta este script completo para verificar todo:

```sql
-- 1. Verificar RLS habilitado
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END as "Estado RLS"
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('orders', 'order_items', 'tables', 'sale_details')
ORDER BY tablename;

-- 2. Verificar políticas
SELECT 
    tablename,
    policyname,
    cmd as "Operación"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('orders', 'order_items', 'tables', 'sale_details')
ORDER BY tablename, cmd;

-- 3. Verificar permisos
SELECT 
    table_name,
    grantee,
    string_agg(privilege_type, ', ') as permisos
FROM information_schema.table_privileges 
WHERE table_schema = 'public'
AND table_name IN ('orders', 'order_items', 'tables', 'sale_details')
AND grantee IN ('authenticated', 'anon')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 4. Verificar función helper
SELECT 
    routine_name,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'get_my_business_ids';
```

---

## ✅ Checklist de Implementación

- [ ] Código frontend actualizado (`Mesas.jsx`)
- [ ] Script SQL ejecutado en Supabase
- [ ] Políticas RLS verificadas
- [ ] Permisos GRANT confirmados
- [ ] Realtime habilitado en `order_items` y `sale_details`
- [ ] Pruebas con 2+ cuentas exitosas
- [ ] Sin errores en consola del navegador
- [ ] Sin errores en logs de Supabase

---

## 📚 Documentación Relacionada

- [REALTIME_SYNC_FIX.md](./REALTIME_SYNC_FIX.md) - Explicación técnica detallada
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs de Supabase
2. Verifica la consola del navegador
3. Confirma que ambas cuentas pertenecen al mismo `business_id`
4. Asegúrate de que Realtime está habilitado en tu plan de Supabase
