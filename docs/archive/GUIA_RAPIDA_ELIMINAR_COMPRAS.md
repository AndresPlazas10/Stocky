# 🎯 Guía Rápida: Eliminar Compras (Administrador)

## ¿Cómo usar la nueva funcionalidad?

### Paso 1: Verificar Permisos
✅ Solo usuarios **Administradores** o **Dueños** pueden ver el botón de eliminar

### Paso 2: Ubicar el Botón
📍 En cada tarjeta de compra verás:
- **Botón azul**: "Ver Detalles" 👁️
- **Botón rojo**: Eliminar 🗑️ (solo para admin)

### Paso 3: Eliminar una Compra
1. Click en el botón rojo 🗑️
2. Se abre modal de confirmación
3. Lee la advertencia sobre reversión de stock
4. Click en "Eliminar" (rojo) o "Cancelar" (gris)

### Paso 4: Confirmación
✅ **Mensaje de éxito**: "Compra eliminada exitosamente y stock revertido"
❌ **Mensaje de error**: Si algo falla, se muestra detalle del error

## ⚠️ Importante: Reversión de Stock

Cuando eliminas una compra:
- ✅ El stock se **revierte automáticamente**
- ✅ Se resta la cantidad que se había comprado
- ✅ El inventario vuelve al estado anterior

### Ejemplo:
```
Antes de la compra:
- Producto A: 50 unidades

Registras compra:
- Compras 20 unidades de Producto A
- Stock nuevo: 70 unidades

Eliminas la compra:
- Stock se revierte: 70 - 20 = 50 unidades
- ✅ Inventario restaurado
```

## 🔐 Seguridad

### Solo Administradores
- Empleados regulares **NO** ven el botón de eliminar
- Solo `admin` y `owner` tienen acceso

### Proceso Seguro
1. Verifica permisos
2. Revierte stock primero (importante)
3. Elimina detalles de compra
4. Elimina compra principal
5. Recarga datos automáticamente

## 💡 Casos de Uso

### ¿Cuándo eliminar una compra?

✅ **SÍ eliminar cuando:**
- Registro duplicado por error
- Compra cancelada por proveedor
- Error en cantidades o productos
- Compra ficticia para pruebas

❌ **NO eliminar cuando:**
- Quieres hacer auditoría (mejor usar reportes)
- La compra ya fue procesada hace tiempo
- No estás seguro de los productos involucrados

## 🎨 Diseño Visual

```
┌─────────────────────────────────────────┐
│  Compras                         [+]    │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 📦 Proveedor ABC                  │  │
│  │ 📅 19 Dic 2025                    │  │
│  │ ─────────────────────────────────  │  │
│  │ Total: $500.000                   │  │
│  │ Método: Efectivo                  │  │
│  │ ─────────────────────────────────  │  │
│  │ [👁️ Ver Detalles] [🗑️ Eliminar]  │  │ <- Botón rojo solo para admin
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Modal de Confirmación:
```
┌─────────────────────────────────────┐
│ ⚠️  Eliminar Compra                 │
│ Esta acción no se puede deshacer    │
├─────────────────────────────────────┤
│                                     │
│ ⚠️ Importante: Al eliminar esta     │
│ compra, el stock se revertirá       │
│ automáticamente.                    │
│                                     │
│ ¿Estás seguro? El inventario se     │
│ ajustará restando las cantidades.   │
│                                     │
│ [Cancelar]  [Eliminar Compra]       │
│   (gris)       (rojo)               │
└─────────────────────────────────────┘
```

## 📊 Antes y Después

### Antes (sin funcionalidad):
- ❌ No se podían eliminar compras erróneas
- ❌ Stock incorrecto por registros duplicados
- ❌ Sin opción de corrección rápida

### Ahora (con funcionalidad):
- ✅ Eliminar compras en segundos
- ✅ Stock se revierte automáticamente
- ✅ Control total para administradores
- ✅ Proceso seguro con confirmación

## 🔍 Preguntas Frecuentes

### ¿Puedo eliminar cualquier compra?
Sí, si eres administrador puedes eliminar cualquier compra, sin importar cuándo se registró.

### ¿Qué pasa con el stock?
Se revierte automáticamente. Las unidades compradas se restan del inventario actual.

### ¿Se puede recuperar una compra eliminada?
No, la eliminación es permanente. Por eso aparece un modal de confirmación.

### ¿Los empleados pueden eliminar compras?
No, solo administradores (admin) y dueños (owner) del negocio.

### ¿Qué pasa si elimino una compra con múltiples productos?
El stock se revierte para **todos** los productos incluidos en la compra.

## 🐛 Solución de Problemas

### El botón de eliminar no aparece
- Verifica que eres administrador
- Actualiza la página
- Verifica tu sesión

### Error al eliminar
- Verifica conexión a internet
- Refresca la página
- Intenta nuevamente
- Si persiste, contacta soporte técnico

### Stock no se revirtió correctamente
- Verifica el mensaje de éxito
- Refresca la página de inventario
- Revisa el historial del producto

## 📞 Soporte

Si encuentras algún problema:
1. Verifica los pasos de esta guía
2. Revisa la documentación completa: `docs/FEATURE_ELIMINACION_COMPRAS.md`
3. Contacta al equipo de desarrollo

---

**¡Listo!** Ahora puedes gestionar compras con total control 🎉
