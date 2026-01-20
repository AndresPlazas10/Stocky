# 🚨 Guía: Modal de Advertencia de Pagos Pendientes

## 📋 Descripción

Sistema de advertencia automática para negocios que no han realizado el pago mensual de Stocky.

## 🎯 Funcionamiento

Cuando un negocio con pago pendiente intenta iniciar sesión:
1. El sistema carga normalmente el dashboard
2. Después de 1 segundo, aparece un modal de advertencia
3. El modal muestra información de contacto para regularizar el pago
4. El usuario puede cerrar el modal y continuar usando el sistema (con advertencia)

## 📁 Archivos Creados

### 1. `src/components/PaymentWarningModal.jsx`
Modal visual que muestra la advertencia de pago pendiente.

**Características:**
- ⚠️ Diseño llamativo con gradiente rojo-naranja
- 📱 Información de contacto (teléfono y email)
- ⏰ Advertencia sobre posible suspensión del servicio
- ✅ Botón para continuar bajo responsabilidad del usuario

### 2. `src/config/unpaidBusinesses.js`
Configuración de IDs de negocios con pago pendiente.

**Funciones:**
- `UNPAID_BUSINESS_IDS`: Array con los IDs de negocios sin pago
- `hasUnpaidStatus(businessId)`: Verifica si un negocio tiene pago pendiente

### 3. Modificaciones en `src/pages/Dashboard.jsx`
Integración del modal en el flujo de inicio de sesión.

## 🔧 Cómo Usar

### Agregar un negocio a la lista de pagos pendientes:

1. Abre el archivo: `/src/config/unpaidBusinesses.js`

2. Agrega el ID del negocio al array `UNPAID_BUSINESS_IDS`:

```javascript
export const UNPAID_BUSINESS_IDS = [
  'abc123-def456-ghi789',  // ID del negocio sin pago
  'xyz789-uvw456-rst123',  // Otro negocio sin pago
];
```

3. Guarda el archivo

4. La próxima vez que ese negocio inicie sesión, verá el modal de advertencia

### Quitar un negocio de la lista (después de pagar):

1. Abre el archivo: `/src/config/unpaidBusinesses.js`

2. Elimina el ID del negocio del array:

```javascript
export const UNPAID_BUSINESS_IDS = [
  // 'abc123-def456-ghi789',  // ✅ Comentado o eliminado
];
```

3. Guarda el archivo

## 🔍 Cómo Obtener el ID de un Negocio

### Opción 1: Desde la Consola del Navegador
1. El negocio inicia sesión normalmente
2. Abre la consola del navegador (F12)
3. Escribe en la consola:
   ```javascript
   // Ver en el dashboard el ID del negocio
   console.log(window.location.pathname)
   ```
4. O revisa el objeto `business` en el estado de React DevTools

### Opción 2: Desde Supabase
1. Ve a tu proyecto en Supabase
2. Abre el Table Editor
3. Selecciona la tabla `businesses`
4. Busca el negocio por nombre o email del dueño
5. Copia el valor de la columna `id`

### Opción 3: Agregar un console.log temporal
En `Dashboard.jsx`, después de cargar el negocio:
```javascript
setBusiness(finalBusiness);
console.log('🆔 Business ID:', finalBusiness.id);  // 👈 Agregar esta línea
```

## 📞 Actualizar Información de Contacto

Para cambiar el teléfono o email que aparece en el modal:

1. Abre: `/src/components/PaymentWarningModal.jsx`

2. Busca la sección de contacto (líneas ~70-85):

```jsx
<p className="text-gray-700">+57 XXX XXX XXXX</p>  // 👈 Cambiar teléfono
<p className="text-gray-700">pagos@stockly.com</p>  // 👈 Cambiar email
```

3. Reemplaza con la información real

## ⚙️ Personalización del Modal

### Cambiar el tiempo de aparición:
En `Dashboard.jsx`, busca:
```javascript
setTimeout(() => {
  setShowPaymentWarning(true);
}, 1000);  // 👈 Cambiar este valor (en milisegundos)
```

### Hacer que el modal bloquee el acceso completamente:
En `PaymentWarningModal.jsx`, elimina el botón "Continuar" y deshabilita el cierre.

## 🧪 Probar el Modal

1. Agrega un ID de prueba al array (puede ser cualquier string):
   ```javascript
   export const UNPAID_BUSINESS_IDS = [
     'test-id-123',
   ];
   ```

2. En el Dashboard, temporalmente cambia la verificación para forzar el modal:
   ```javascript
   // Temporal para pruebas
   setHasUnpaidBusiness(true);
   setShowPaymentWarning(true);
   ```

3. Verifica que el modal aparece correctamente

4. Revisa el diseño y los textos

5. Elimina los cambios temporales

## ✅ Checklist de Implementación

- [x] Modal de advertencia creado
- [x] Sistema de configuración de IDs implementado
- [x] Integración con Dashboard completa
- [ ] Actualizar información de contacto real
- [ ] Probar con ID de negocio real
- [ ] Documentar proceso interno de cobros

## 🎨 Diseño del Modal

El modal incluye:
- ⚠️ Icono de advertencia animado
- 🎨 Gradiente rojo-naranja llamativo
- 💳 Información clara sobre el problema
- 📞 Datos de contacto visibles
- ⏰ Advertencia sobre suspensión del servicio
- ✅ Botón para aceptar y continuar

## 📝 Notas Importantes

1. **Seguridad**: Esta es una advertencia, no un bloqueo. El usuario puede cerrar el modal y continuar usando el sistema.

2. **Persistencia**: El modal aparecerá cada vez que el usuario inicie sesión hasta que se quite el ID de la lista.

3. **Sin base de datos**: Los IDs se manejan en código, no en base de datos, para mayor control y rapidez.

4. **Mantenimiento**: Recuerda actualizar la lista regularmente según los pagos recibidos.
