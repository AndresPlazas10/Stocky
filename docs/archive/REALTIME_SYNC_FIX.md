# Solución: Sincronización en Tiempo Real entre Cuentas

## Problema Identificado

Cuando un usuario realizaba cambios en productos de una mesa (agregar, modificar cantidad, eliminar), estos cambios **NO se reflejaban en tiempo real** para otros usuarios del mismo negocio. Solo se actualizaban al refrescar la página.

### Causa Raíz

1. **Suscripción limitada a sesión individual**: La suscripción de `order_items` en `Mesas.jsx` solo escuchaba cambios cuando:
   - Había una `selectedMesa` activa en ESA sesión específica
   - Se filtraba por `order_id` de la mesa seleccionada
   
   ```javascript
   // ❌ CÓDIGO ANTERIOR (PROBLEMA)
   useRealtimeSubscription('order_items', {
     enabled: !!businessId && !!selectedMesa?.current_order_id,
     filter: { order_id: selectedMesa?.current_order_id },
     // ...
   });
   ```

2. **Falta de políticas RLS**: Las tablas `order_items` y `sale_details` no tenían políticas de Row Level Security configuradas, lo que impedía que Supabase Realtime pudiera transmitir los cambios correctamente.

## Solución Implementada

### 1. Cambio en Suscripción de Realtime (Mesas.jsx)

Se modificó la suscripción de `order_items` para escuchar **TODOS los cambios a nivel de negocio**, no solo de la mesa seleccionada:

```javascript
// ✅ NUEVO CÓDIGO (SOLUCIÓN)
const handleOrderItemChange = useCallback(async (item, eventType) => {
  const orderId = item.order_id;
  
  // Encontrar la mesa asociada a esta orden
  const mesaAfectada = mesas.find(m => m.current_order_id === orderId);
  if (!mesaAfectada) return;
  
  // Recargar los detalles de la orden para actualizar el total
  const { data: updatedOrder } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        quantity,
        price,
        subtotal,
        products (name)
      )
    `)
    .eq('id', orderId)
    .single();
  
  if (updatedOrder) {
    // Actualizar el estado de mesas
    setMesas(prev => prev.map(mesa => {
      if (mesa.id === mesaAfectada.id) {
        return { ...mesa, orders: updatedOrder };
      }
      return mesa;
    }));
    
    // Si esta es la mesa abierta actualmente, actualizar también orderItems
    if (selectedMesa?.id === mesaAfectada.id) {
      setOrderItems(updatedOrder.order_items || []);
      setSelectedMesa(prev => ({ ...prev, orders: updatedOrder }));
    }
  }
}, [mesas, selectedMesa]);

// Suscripción a nivel de negocio (sin filtro específico)
useRealtimeSubscription('order_items', {
  enabled: !!businessId,
  filter: {}, // RLS filtra automáticamente por business_id
  onInsert: (newItem) => handleOrderItemChange(newItem, 'INSERT'),
  onUpdate: (updatedItem) => handleOrderItemChange(updatedItem, 'UPDATE'),
  onDelete: (deletedItem) => handleOrderItemChange(deletedItem, 'DELETE')
});
```

### 2. Políticas RLS para order_items y sale_details

Se agregaron políticas de seguridad en `enable_rls_fixed.sql`:

```sql
-- ORDER_ITEMS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for business members via orders"
ON order_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.business_id IN (SELECT get_my_business_ids())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.business_id IN (SELECT get_my_business_ids())
  )
);

-- SALE_DETAILS
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for business members via sales"
ON sale_details FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales 
    WHERE sales.id = sale_details.sale_id 
    AND sales.business_id IN (SELECT get_my_business_ids())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales 
    WHERE sales.id = sale_details.sale_id 
    AND sales.business_id IN (SELECT get_my_business_ids())
  )
);
```

### 3. Permisos de Base de Datos

Se otorgaron permisos necesarios:

```sql
GRANT ALL ON TABLE order_items TO authenticated;
GRANT ALL ON TABLE sale_details TO authenticated;
```

## Cómo Funciona Ahora

1. **Usuario A** agrega un producto a Mesa 5
2. El cambio se inserta en `order_items`
3. **Supabase Realtime** detecta el cambio (gracias a RLS)
4. **TODAS las sesiones** del negocio reciben la notificación
5. El callback `handleOrderItemChange`:
   - Identifica la mesa afectada (`Mesa 5`)
   - Recarga los detalles actualizados de la orden
   - Actualiza el estado global de `mesas`
   - Si **Usuario B** tiene abierta Mesa 5, también actualiza `orderItems`
6. **Usuario B** ve el cambio inmediatamente sin refrescar

## Beneficios

✅ **Sincronización instantánea** entre todas las cuentas del negocio  
✅ **Menos consultas a la BD** (solo cuando hay cambios reales)  
✅ **Mejor experiencia** para equipos trabajando en paralelo  
✅ **Seguridad mantenida** (RLS sigue filtrando por negocio)  

## Archivos Modificados

1. `src/components/Dashboard/Mesas.jsx` - Lógica de suscripción mejorada
2. `.archive/sql/enable_rls_fixed.sql` - Políticas RLS para tablas relacionales

## Próximos Pasos Recomendados

- [ ] Ejecutar el script SQL actualizado en Supabase
- [ ] Probar con 2+ cuentas del mismo negocio simultáneamente
- [ ] Verificar que no se pierdan actualizaciones en escenarios de alta concurrencia
- [ ] Considerar optimización de consultas si hay muchas mesas activas

## Notas Técnicas

- **RLS automático**: Supabase Realtime respeta automáticamente las políticas RLS, por lo que no es necesario filtrar manualmente por `business_id`
- **Performance**: La suscripción sin filtro específico es segura porque RLS garantiza que solo se reciban cambios del negocio del usuario autenticado
- **Escalabilidad**: Si el negocio tiene 100+ mesas activas, considerar implementar paginación o virtualización
