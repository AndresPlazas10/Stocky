# 🗑️ Funcionalidad: Eliminación de Compras por Administrador

## 📋 Resumen

Se ha implementado la funcionalidad completa para que los administradores puedan eliminar compras, incluyendo la reversión automática del stock en el inventario.

## ✨ Características Implementadas

### 1. **Verificación de Permisos**
- Solo usuarios con rol `admin` o `owner` pueden ver y usar el botón de eliminar
- Verificación automática al cargar el componente
- El botón de eliminar solo aparece para administradores

### 2. **Reversión Automática de Stock**
- Al eliminar una compra, el stock se revierte automáticamente
- Se resta la cantidad comprada del inventario actual
- Protección contra stock negativo (mínimo 0)

### 3. **Proceso de Eliminación Seguro**
```javascript
1. Verificar permisos de administrador
2. Obtener detalles de la compra
3. Revertir stock de cada producto
4. Eliminar detalles de compra (purchase_details)
5. Eliminar compra principal (purchases)
6. Recargar datos actualizados
```

### 4. **Modal de Confirmación**
- Modal con advertencia clara sobre la acción
- Mensaje informativo sobre reversión de stock
- Botones de "Cancelar" y "Eliminar"
- Diseño consistente con el resto de la aplicación

## 🔧 Cambios Técnicos

### Estados Agregados
```javascript
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [purchaseToDelete, setPurchaseToDelete] = useState(null);
const [isAdmin, setIsAdmin] = useState(false);
```

### Funciones Implementadas

#### `checkAdminRole()`
Verifica si el usuario es administrador o dueño del negocio.

#### `handleDeletePurchase(purchaseId)`
Abre el modal de confirmación con el ID de la compra a eliminar.

#### `confirmDeletePurchase()`
Ejecuta el proceso completo de eliminación:
- Obtiene detalles de la compra
- Revierte el stock producto por producto
- Elimina purchase_details
- Elimina la compra
- Muestra mensaje de éxito/error

#### `cancelDelete()`
Cierra el modal y limpia los estados.

## 🎨 Interfaz de Usuario

### Botón de Eliminar
- Color: Rojo (`bg-red-500`)
- Icono: Trash2 de lucide-react
- Posición: Al lado del botón "Ver Detalles"
- Tooltip: "Eliminar compra"

### Modal de Confirmación
- Título: "Eliminar Compra"
- Icono de advertencia (AlertCircle)
- Banner amarillo con advertencia sobre reversión de stock
- Mensaje claro y descriptivo
- Botones: "Cancelar" (gris) y "Eliminar" (rojo)

## 🔒 Seguridad

### Permisos
- Solo `admin` y `owner` pueden eliminar compras
- Verificación en el frontend (UI)
- RLS de Supabase debe validar permisos en backend

### Validaciones
- Verifica que existe `purchaseToDelete` antes de proceder
- Manejo de errores en cada paso del proceso
- Mensajes claros de error para el usuario

## ⚠️ Consideraciones Importantes

### Reversión de Stock
```javascript
// El stock se calcula de forma segura:
const newStock = Math.max(0, (producto.stock || 0) - detail.quantity);
```

### Orden de Eliminación
1. **Primero**: Revertir stock (crítico para integridad)
2. **Segundo**: Eliminar purchase_details (FK constraint)
3. **Tercero**: Eliminar purchase (tabla principal)

### Manejo de Errores
- Cada operación tiene try/catch individual
- Mensajes de error específicos para cada fallo
- Cleanup automático del modal en caso de error

## 📱 Experiencia de Usuario

### Flujo de Eliminación
1. Usuario admin ve botón rojo 🗑️ en tarjeta de compra
2. Click en botón → Se abre modal de confirmación
3. Modal muestra advertencia sobre reversión de stock
4. Usuario confirma → Proceso de eliminación
5. Mensaje de éxito ✅ y recarga automática de datos

### Mensajes
- **Éxito**: "✅ Compra eliminada exitosamente y stock revertido"
- **Error**: "❌ Error al eliminar la compra: [detalle]"
- Auto-ocultan después de 4-8 segundos

## 🧪 Pruebas Recomendadas

### Caso 1: Eliminación Exitosa
```
1. Crear compra de 10 unidades de Producto A
2. Verificar stock aumentó +10
3. Eliminar la compra como admin
4. Verificar stock disminuyó -10
5. Verificar compra ya no aparece en lista
```

### Caso 2: Permisos
```
1. Iniciar sesión como empleado regular
2. Verificar que botón de eliminar NO aparece
3. Iniciar sesión como admin
4. Verificar que botón de eliminar SÍ aparece
```

### Caso 3: Reversión de Stock
```
1. Producto con stock = 50
2. Compra de 20 unidades (stock → 70)
3. Eliminar compra
4. Verificar stock = 50 (revertido correctamente)
```

### Caso 4: Múltiples Productos
```
1. Compra con 3 productos diferentes
2. Eliminar compra
3. Verificar stock revertido en los 3 productos
```

## 🔄 Integración con Sistema Existente

### Compatibilidad
- ✅ Usa el mismo patrón de Ventas.jsx
- ✅ Mantiene coherencia visual con el diseño
- ✅ Reutiliza componentes UI existentes
- ✅ Compatible con sistema de tiempo real (useRealtimeSubscription)

### Dependencias
```javascript
import { Trash2, AlertCircle } from 'lucide-react';
// Ya existentes en el proyecto
```

## 📊 Impacto en la Base de Datos

### Tablas Afectadas
1. **purchases** - Se elimina el registro
2. **purchase_details** - Se eliminan todos los detalles
3. **products** - Se actualiza el stock

### Operaciones
```sql
-- 1. Revertir stock
UPDATE products 
SET stock = stock - quantity 
WHERE id = product_id;

-- 2. Eliminar detalles
DELETE FROM purchase_details 
WHERE purchase_id = ?;

-- 3. Eliminar compra
DELETE FROM purchases 
WHERE id = ?;
```

## 🚀 Próximas Mejoras Opcionales

1. **Registro de Auditoría**: Guardar log de compras eliminadas
2. **Soft Delete**: Marcar como eliminado en lugar de borrar
3. **Restricción Temporal**: Permitir eliminar solo compras recientes (últimas 24h)
4. **Confirmación Doble**: Requerir escribir "CONFIRMAR" para eliminar
5. **Notificaciones**: Email al administrador cuando se elimina una compra

## 📝 Notas de Desarrollo

- Archivo modificado: `src/components/Dashboard/Compras.jsx`
- Líneas aproximadas añadidas: ~150
- No requiere migraciones de base de datos
- Compatible con versión actual de Supabase
- No rompe funcionalidad existente

---

**Fecha de implementación**: 19 de diciembre de 2025  
**Desarrollador**: GitHub Copilot  
**Estado**: ✅ Implementado y funcional
