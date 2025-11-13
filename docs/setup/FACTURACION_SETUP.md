# 📋 Guía de Configuración del Sistema de Facturación

## 🔧 Pasos para Configurar Supabase

### 1. Ejecutar Script SQL de Funciones

1. Ve a tu proyecto de Supabase
2. Navega a **SQL Editor**
3. Abre el archivo `supabase_functions.sql` de este proyecto
4. Copia y pega TODO el contenido en el SQL Editor
5. Haz clic en **RUN** para ejecutar el script

Este script creará:
- ✅ Función `generate_invoice_number()` - Genera números de factura secuenciales
- ✅ Función `reduce_stock()` - Reduce el stock al crear factura
- ✅ Función `increase_stock()` - Aumenta el stock manualmente
- ✅ Función `restore_stock_from_invoice()` - Restaura stock al cancelar factura
- ✅ Trigger automático para restaurar stock al cancelar
- ✅ Tabla `customers` (si no existe)

### 2. Verificar Estructura de Tablas

Ejecuta estos comandos en el SQL Editor para verificar que las tablas existen:

```sql
-- Verificar tabla invoices
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices';

-- Verificar tabla invoice_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoice_items';

-- Verificar tabla customers
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers';
```

### 3. Verificar Row Level Security (RLS)

Asegúrate de que las políticas RLS estén configuradas correctamente:

```sql
-- Ver políticas de invoices
SELECT * FROM pg_policies WHERE tablename = 'invoices';

-- Ver políticas de invoice_items
SELECT * FROM pg_policies WHERE tablename = 'invoice_items';

-- Ver políticas de customers
SELECT * FROM pg_policies WHERE tablename = 'customers';
```

## 🧪 Pruebas de Funcionalidad

### Checklist de Pruebas

- [ ] **Crear Factura**
  - [ ] Agregar productos al formulario
  - [ ] Validar que no se pueda agregar más stock del disponible
  - [ ] Verificar que el precio se muestre correctamente
  - [ ] Seleccionar un cliente (o consumidor final)
  - [ ] Seleccionar método de pago
  - [ ] Crear la factura
  - [ ] Verificar que el número de factura se genera correctamente (FAC-000001, FAC-000002, etc.)

- [ ] **Verificar Reducción de Stock**
  - [ ] Después de crear una factura, ir a Inventario
  - [ ] Verificar que el stock de los productos se redujo correctamente
  - [ ] El stock debe disminuir en la cantidad facturada

- [ ] **Cancelar Factura**
  - [ ] Buscar una factura con estado "Guardado" (pending)
  - [ ] Hacer clic en el botón "❌ Cancelar"
  - [ ] Confirmar la cancelación
  - [ ] Verificar que el estado cambia a "🔴 Cancelada"
  - [ ] Ir a Inventario y verificar que el stock se restauró

- [ ] **Enviar a DIAN (Demo)**
  - [ ] Hacer clic en "📤 Enviar" en una factura pendiente
  - [ ] Verificar que el estado cambia a "🟢 Enviada"
  - [ ] Esta es una funcionalidad de demostración

- [ ] **Validaciones**
  - [ ] Intentar agregar un producto sin stock - debe mostrar error
  - [ ] Intentar agregar más cantidad del stock disponible - debe mostrar error
  - [ ] Intentar crear factura sin productos - debe mostrar error
  - [ ] Todos los mensajes de error deben ser claros

## 🐛 Solución de Problemas

### Error: "Function generate_invoice_number does not exist"

**Solución:** Ejecuta el script SQL completo de `supabase_functions.sql`

### Error: "Stock insuficiente para el producto"

**Causa:** El producto no tiene stock o ya fue vendido
**Solución:** 
1. Ve a Inventario
2. Agrega stock al producto
3. Intenta crear la factura nuevamente

### Error: "relation 'customers' does not exist"

**Solución:** Ejecuta la parte del script SQL que crea la tabla customers:

```sql
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  id_number TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### El stock no se restaura al cancelar factura

**Causa:** El trigger no está configurado o falló
**Solución:** 
1. Verifica que el trigger existe:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'invoice_cancel_restore_stock';
   ```
2. Si no existe, ejecuta la parte del script que crea el trigger
3. Si persiste, el sistema restaurará el stock manualmente

## 📊 Flujo del Sistema

```
1. Usuario crea factura
   ↓
2. Sistema valida stock disponible
   ↓
3. Sistema crea factura en estado "pending"
   ↓
4. Sistema crea invoice_items
   ↓
5. Sistema reduce stock con reduce_stock()
   ↓
6. (Opcional) Sistema envía email al cliente
   ↓
7. Usuario puede:
   - Enviar a DIAN (cambia a "sent")
   - Cancelar (restaura stock automáticamente)
```

## 🔐 Permisos Necesarios

- **Administradores:** Acceso completo a facturación
- **Empleados:** Acceso completo a facturación (según permisos)
- **RLS:** Solo pueden ver/crear facturas de su negocio

## 📝 Notas Importantes

1. **Números de Factura:** Se generan automáticamente en formato FAC-XXXXXX
2. **Stock:** Se reduce automáticamente al crear factura
3. **Cancelación:** Restaura el stock automáticamente vía trigger
4. **Email:** Si el cliente tiene email, se envía copia de la factura
5. **DIAN:** La integración con DIAN es una demostración (cambio de estado)

## 🚀 Mejoras Futuras

- [ ] Integración real con proveedor de facturación electrónica (ej: Alegra, Siigo)
- [ ] Generación de PDF de facturas
- [ ] Notas crédito para devoluciones
- [ ] Reportes de facturación
- [ ] Recordatorios de pago para facturas a crédito
- [ ] Firma electrónica de facturas

## 📞 Soporte

Si tienes problemas:
1. Revisa esta guía
2. Verifica los logs del navegador (F12 → Console)
3. Verifica los logs de Supabase
4. Asegúrate de que todas las funciones SQL estén creadas
