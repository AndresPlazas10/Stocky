# 🚀 Quick Start - Sistema de Facturación

## ⚡ Inicio Rápido

### 1. Configurar Supabase (5 minutos)

```bash
# 1. Ve a tu proyecto de Supabase
# 2. Abre SQL Editor
# 3. Copia todo el contenido de supabase_functions.sql
# 4. Pega y ejecuta (clic en RUN)
# 5. ¡Listo! ✅
```

### 2. Iniciar la Aplicación

```bash
npm run dev
```

Abre: http://localhost:5174/

## 🧪 Prueba Rápida (2 minutos)

### Paso 1: Crear Producto
1. Ve a **Inventario**
2. Clic en **+ Nuevo Producto**
3. Llena:
   - Nombre: "Producto Prueba"
   - Código: "PROD001"
   - Precio Venta: 10000
   - Stock: 50
4. Guardar

### Paso 2: Crear Factura
1. Ve a **Facturación**
2. Clic en **+ Nueva Factura**
3. Busca "Producto Prueba"
4. Clic en el producto (se agrega al carrito)
5. Selecciona método de pago
6. Clic en **✅ Crear Factura**

### Paso 3: Verificar Stock
1. Ve a **Inventario**
2. Busca "Producto Prueba"
3. Verifica que el stock ahora es **49** ✅

### Paso 4: Cancelar Factura
1. Ve a **Facturación**
2. Encuentra la factura recién creada
3. Clic en **❌ Cancelar**
4. Confirma

### Paso 5: Verificar Restauración
1. Ve a **Inventario**
2. Busca "Producto Prueba"
3. Verifica que el stock volvió a **50** ✅

## ✅ Si Todo Funcionó

**¡El sistema está listo!** Puedes:
- Crear facturas reales
- Gestionar clientes
- Enviar facturas por email
- Continuar con mejoras de diseño

## ❌ Si Algo Falló

### Error: "Function does not exist"
→ Ejecuta `supabase_functions.sql` en Supabase

### Error: "Stock insuficiente"
→ Agrega más stock al producto en Inventario

### Error: "Tu sesión ha expirado"
→ Inicia sesión nuevamente

### Stock no se restaura al cancelar
→ Verifica que el trigger esté creado en Supabase:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'invoice_cancel_restore_stock';
```

## 📚 Documentación Completa

- **FACTURACION_SETUP.md** - Configuración detallada
- **MEJORAS_FACTURACION.md** - Lista de mejoras implementadas
- **supabase_functions.sql** - Script SQL completo

## 🎯 Funcionalidades Clave

✅ Validación de stock en tiempo real
✅ Reducción automática de stock
✅ Restauración automática al cancelar
✅ Números de factura secuenciales
✅ Envío de emails (opcional)
✅ Gestión de clientes
✅ Múltiples métodos de pago
✅ Interfaz intuitiva y clara

## 🔥 Listo para Producción

El sistema está **completamente funcional** y validado.
Ahora puedes enfocarte en:
- 🎨 Mejoras de diseño
- 📱 Responsividad móvil  
- 🚀 Nuevas funcionalidades
