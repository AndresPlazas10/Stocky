# Realtime UI Checklist (Web + Mobile)

## Preparacion
- Usar entorno staging con datos de prueba.
- Abrir al menos 2 sesiones del mismo negocio: `owner/admin` y `employee`.
- (Opcional) Abrir una 3ra sesion de otro negocio para validar aislamiento.
- Mantener abierta consola de red para detectar reconexiones o errores de canal.

## Web - Sincronizacion funcional

### Mesas
- Usuario A abre una mesa disponible.
- Usuario B debe ver la mesa como ocupada sin refrescar.
- Usuario A agrega y cambia cantidades en `order_items`.
- Usuario B debe ver total/unidades actualizados en menos de 2 segundos.
- Cerrar y reabrir modal varias veces para detectar canales duplicados o eventos repetidos.

### Ventas
- Registrar una nueva venta en usuario A.
- Usuario B debe ver insercion en historial en tiempo real.
- Validar update/delete si el rol lo permite.

### Compras
- Registrar compra en usuario A.
- Usuario B debe ver el nuevo registro en tiempo real.
- Verificar consistencia de fecha, total y proveedor.

### Inventario y Combos
- Modificar stock/precio en inventario.
- Verificar que otra sesion refleje el cambio en catalogos relacionados.
- Crear/editar/eliminar combo y verificar propagacion.

### Empleados y Notificaciones
- Actualizar estado o datos de empleado.
- Verificar refresco inmediato en panel de empleados.
- Verificar notificaciones por insercion en ventas/compras/productos.

## Mobile - Consistencia con modelo mixto

### Mesas (polling + locks)
- Abrir la misma mesa desde dos dispositivos.
- Verificar lock visual `... esta usando esta mesa`.
- Confirmar que al liberar lock el segundo dispositivo pueda entrar.
- Medir tiempo de reflejo de totales/unidades (esperado: acorde al polling configurado).

### Ventas, Compras, Inventario, Combos, Proveedores, Empleados
- Ejecutar alta/edicion/eliminacion en un dispositivo.
- Ir a la misma pantalla en el otro y validar actualizacion por focus refresh o recarga de pantalla.
- Confirmar que no hay stale persistente tras volver al modulo.

## Seguridad y filtrado
- Usuario de otro negocio NO debe recibir cambios de negocio ajeno.
- Empleado debe ver solo lo permitido por RLS y permisos de UI.

## Resiliencia
- Forzar reconexion (modo avion on/off o cambio de red).
- Verificar que canales se recuperan o que el fallback repone estado.
- Repetir navegacion rapida entre modulos para detectar suscripciones huérfanas.

## Clasificacion de hallazgos
- `realtime roto`: evento no llega a actor autorizado.
- `filtro/config roto`: leak cross-business o canal no suscribe.
- `sincronizacion lenta por polling`: actualiza pero fuera del SLA esperado por polling/focus refresh.
