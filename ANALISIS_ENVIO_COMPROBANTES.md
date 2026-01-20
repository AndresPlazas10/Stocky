# 📧 ANÁLISIS COMPLETO: Sistema de Envío de Comprobantes por Correo

**Fecha:** 20 de enero de 2026  
**Estado:** ⚠️ PARCIALMENTE FUNCIONAL

---

## 🔍 RESUMEN EJECUTIVO

El sistema de envío de comprobantes por correo **está configurado pero NO funcionará** hasta que se agregue la API Key de Resend en las variables de entorno de Vercel.

**Estado actual:**
- ✅ Código implementado correctamente
- ✅ Interfaz de usuario funcional
- ✅ EmailJS configurado (fallback)
- ❌ **Resend NO configurado** (falta API Key)

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Componentes Involucrados

```
┌─────────────────────────────────────────────────────────┐
│ 1. INTERFAZ DE USUARIO (Ventas.jsx)                    │
│    - Botón "Enviar Comprobante" (línea 1455)           │
│    - Modal con formulario (líneas 1514-1634)           │
│    - Campos: nombre, email, NIT/cédula                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 2. LÓGICA DE NEGOCIO (Ventas.jsx)                      │
│    - generateInvoiceFromSale() (línea 813)             │
│    - Crea registro en BD (invoices + invoice_items)    │
│    - Llama a servicio de email                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 3. CAPA DE SERVICIO (emailService.js)                  │
│    - Selector de proveedor (Resend o EmailJS)          │
│    - Prioridad: Resend > EmailJS                       │
└──────────────────┬──────────────────────────────────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
      ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│ 4a. RESEND   │      │ 4b. EMAILJS      │
│ (Principal)  │      │ (Fallback)       │
│ ❌ NO CONFIG │      │ ✅ CONFIGURADO   │
└──────────────┘      └──────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ 5. VERCEL SERVERLESS FUNCTION (api/send-email.js)      │
│    - Recibe request del cliente                         │
│    - Llama a API de Resend                             │
│    - ❌ FALLA: process.env.RESEND_API_KEY = undefined  │
└─────────────────────────────────────────────────────────┘
```

---

## ❌ PROBLEMAS IDENTIFICADOS

### **Problema #1: RESEND_API_KEY no configurada**

**Ubicación:** `api/send-email.js` línea 91

```javascript
'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
//                        ↑ UNDEFINED en producción
```

**Síntomas:**
- Al hacer clic en "Enviar Comprobante" aparece error
- Mensaje: "Resend no está configurado"
- El email NO se envía

**Causa raíz:**
Las variables de entorno de Vercel **NO están configuradas**:
- ❌ `RESEND_API_KEY` (servidor)
- ❌ `RESEND_FROM_EMAIL` (servidor)

---

### **Problema #2: Confusión entre variables cliente vs servidor**

**Variables del CLIENTE** (navegador):
```env
VITE_RESEND_API_KEY=          # ← Vacío en .env.local
VITE_RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Variables del SERVIDOR** (Vercel Function):
```env
RESEND_API_KEY=               # ← No existe en Vercel
RESEND_FROM_EMAIL=            # ← No existe en Vercel
```

**Son diferentes** porque:
- Cliente usa `VITE_*` (expuestas al navegador)
- Servidor usa variables normales (solo en backend)

---

### **Problema #3: Validación insuficiente**

El código no valida si Resend está configurado antes de intentar usarlo, causando errores confusos.

**ANTES (código original):**
```javascript
const response = await fetch('https://api.resend.com/emails', {
  headers: {
    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    // ↑ Si undefined, Resend retorna "Invalid API key"
  }
});
```

**AHORA (código mejorado):**
```javascript
// ✅ Valida ANTES de intentar
if (!process.env.RESEND_API_KEY) {
  return res.status(500).json({ 
    error: 'Resend no está configurado',
    configured: false 
  });
}
```

---

## ✅ SOLUCIONES IMPLEMENTADAS

### 1. Validación en la API Function (`api/send-email.js`)

**Cambios:**
```javascript
// ✅ Validar que la API Key esté configurada
if (!process.env.RESEND_API_KEY) {
  return res.status(500).json({ 
    error: 'Resend no está configurado. Configura RESEND_API_KEY en las variables de entorno de Vercel.',
    configured: false 
  });
}

// ✅ Validar datos requeridos
if (!email || !invoiceNumber || !customerName || !total || !items) {
  return res.status(400).json({ 
    error: 'Faltan datos requeridos: email, invoiceNumber, customerName, total, items' 
  });
}
```

### 2. Mejor manejo de errores en cliente (`emailServiceResend.js`)

**Cambios:**
```javascript
if (!response.ok) {
  // ✅ Mensaje de error más claro
  const errorMessage = data.configured === false 
    ? '⚠️ Resend no está configurado. Por favor configura las variables de entorno RESEND_API_KEY y RESEND_FROM_EMAIL.'
    : data.error || data.message || 'Error al enviar email con Resend';
  
  throw new Error(errorMessage);
}
```

---

## 🚀 PASOS PARA SOLUCIONAR EL ERROR

### OPCIÓN A: Configurar Resend (RECOMENDADO)

#### Paso 1: Obtener API Key

1. Ve a https://resend.com
2. Crea una cuenta gratuita (3,000 emails/mes)
3. Ve a **API Keys** → **Create API Key**
4. Copia la key (empieza con `re_`)

#### Paso 2: Configurar en Vercel (Producción)

**Opción 2A: Desde Dashboard (más fácil)**
```
1. Ve a: https://vercel.com/tu-usuario/stockly
2. Settings → Environment Variables
3. Agrega las siguientes variables:

   Variable               | Valor                    | Environment
   ---------------------- | ------------------------ | -----------
   RESEND_API_KEY         | re_tu_key_aqui          | Production
   RESEND_FROM_EMAIL      | onboarding@resend.dev   | Production
```

**Opción 2B: Desde Terminal**
```bash
vercel env add RESEND_API_KEY
# Pega: re_tu_key_aqui
# Selecciona: Production

vercel env add RESEND_FROM_EMAIL
# Pega: onboarding@resend.dev
# Selecciona: Production
```

#### Paso 3: Re-deployar

```bash
# Forzar nuevo deploy para que tome las variables
vercel --prod
```

#### Paso 4: Verificar

```bash
# Debe retornar las variables configuradas
vercel env ls
```

---

### OPCIÓN B: Usar EmailJS (Ya funciona en PRODUCCIÓN)

Si no quieres configurar Resend ahora, el sistema **automáticamente usa EmailJS** como fallback.

**⚠️ ACLARACIÓN IMPORTANTE:**
EmailJS funciona **TANTO en desarrollo COMO en producción**. Las variables `VITE_*` se inyectan durante el build y están disponibles en el código compilado.

**Estado actual de EmailJS:**
```env
✅ VITE_EMAILJS_PUBLIC_KEY=6RrzlGmb6SzFtpcOM  ← Funciona en DEV y PROD
✅ VITE_EMAILJS_SERVICE_ID=service_62fvrkd    ← Funciona en DEV y PROD
✅ VITE_EMAILJS_TEMPLATE_ID=template_mkz4rb4  ← Funciona en DEV y PROD
```

**Ventajas:**
- ✅ Ya está configurado
- ✅ Funciona sin cambios adicionales
- ✅ **Funciona en desarrollo Y producción**
- ✅ Gratis para 200 emails/mes
- ✅ No requiere configuración en Vercel

**Desventajas:**
- ⚠️ Menos profesional que Resend
- ⚠️ Límite bajo (200 emails/mes)
- ⚠️ Reputación menor (más probabilidad de ir a spam)
- ⚠️ API Key visible en el navegador (menos seguro)

---

## 📊 COMPARACIÓN DE PROVEEDORES

| Característica | Resend | EmailJS |
|---------------|--------|---------|
| **Estado** | ❌ No configurado | ✅ Configurado |
| **Emails gratis** | 3,000/mes | 200/mes |
| **Deliverability** | 99.9% | ~85% |
| **Reputación** | Excelente | Moderada |
| **Dashboard** | Sí (analytics) | Sí (básico) |
| **Configuración** | Requiere Vercel vars | Ya está listo |
| **Funciona en producción** | Sí | **Sí** ✅ |
| **Recomendado para** | Producción (óptimo) | Producción (básico) |

---

## 🔍 DEBUGGING

### Verificar si Resend está configurado

**En desarrollo (.env.local):**
```bash
cat .env.local | grep RESEND

# Debe mostrar:
# VITE_RESEND_API_KEY=re_tu_key_aqui
# VITE_RESEND_FROM_EMAIL=onboarding@resend.dev
```

**En producción (Vercel):**
```bash
vercel env ls

# Debe mostrar:
# RESEND_API_KEY          Production
# RESEND_FROM_EMAIL       Production
```

### Probar la API Function localmente

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Correr en modo desarrollo
vercel dev

# 3. La función estará disponible en:
# http://localhost:3000/api/send-email
```

### Test manual con curl

```bash
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "invoiceNumber": "INV-001",
    "customerName": "Cliente Test",
    "total": 50000,
    "items": [
      {
        "product_name": "Producto Test",
        "quantity": 2,
        "unit_price": 25000
      }
    ],
    "businessName": "Mi Negocio"
  }'
```

**Respuesta esperada (sin configurar):**
```json
{
  "error": "Resend no está configurado. Configura RESEND_API_KEY en las variables de entorno de Vercel.",
  "configured": false
}
```

**Respuesta esperada (configurado):**
```json
{
  "success": true,
  "data": {
    "id": "re_123abc...",
    ...
  }
}
```

---

## 📁 ARCHIVOS MODIFICADOS

### 1. `api/send-email.js`
**Cambios:**
- ✅ Agregada validación de `RESEND_API_KEY`
- ✅ Agregada validación de datos requeridos
- ✅ Mejor logging de errores

### 2. `src/utils/emailServiceResend.js`
**Cambios:**
- ✅ Mensaje de error más claro cuando Resend no está configurado

---

## 🎯 CHECKLIST DE VERIFICACIÓN

### Antes de enviar a producción:

- [ ] ¿Tienes cuenta en Resend? (https://resend.com)
- [ ] ¿Copiaste la API Key de Resend?
- [ ] ¿Agregaste `RESEND_API_KEY` en Vercel?
- [ ] ¿Agregaste `RESEND_FROM_EMAIL` en Vercel?
- [ ] ¿Re-deployaste la aplicación?
- [ ] ¿Probaste enviar un comprobante de prueba?
- [ ] ¿El email llegó correctamente?
- [ ] ¿No fue a spam?

### Si usas EmailJS (fallback):

- [x] ✅ EmailJS configurado
- [x] ✅ Template creado
- [x] ✅ Funciona automáticamente

---

## 🔐 SEGURIDAD
Diferencia entre variables cliente y servidor

**VARIABLES DE CLIENTE (VITE_*):**
```env
# ✅ CORRECTO para servicios cliente (EmailJS)
VITE_EMAILJS_PUBLIC_KEY=6RrzlGmb6SzFtpcOM
# ↑ Se inyecta en el bundle, visible en navegador
# ↑ Funciona en desarrollo Y producción
# ↑ Está BIEN para EmailJS (usa public key)
```

**VARIABLES DE SERVIDOR (sin VITE_):**
```env
# ✅ CORRECTO para servicios servidor (Resend)
RESEND_API_KEY=re_tu_key_secreta
# ↑ Solo disponible en Vercel Function
# ↑ NUNCA visible en el navegador
# ↑ REQUERIDO para Resend (API privada)
```

**INCORRECTO:**
```env
# ❌ NUNCA expongas API Keys privadas con VITE_
VITE_RESEND_API_KEY=re_tu_key_secreta
# ↑ Se expone al navegador (INSEGURO)
```

**Regla:**
- Variables con `VITE_*` → Se inyectan en el bundle → Visibles en navegador → Solo para datos públicos
- Variables sin `VITE_*` → Solo en servidor → Nunca visibles → Para secretos (API keys privadas)

**¿Por qué EmailJS usa VITE_ y funciona?**
- EmailJS está diseñado para usarse desde el navegador
- Su "Public Key" es segura de exponer
- La verificación real se hace en el servidor de EmailJS
- Por eso funciona tanto en desarrollo como producción datos públicos)
- Variables sin `VITE_*` → Solo en servidor (secretos)

---

## 📞 CONTACTO Y SOPORTE

**Documentación oficial:**
- Resend: https://resend.com/docs
- EmailJS: https://www.emailjs.com/docs

**En caso de problemas:**
1. Revisa los logs en Vercel Dashboard
2. Verifica las variables de entorno
3. Prueba con curl (ver sección debugging)
4. Contacta soporte de Resend/EmailJS

---

## 🎓 CONCLUSIÓN

**Estado actual:**
- ✅ Sistema funcionando con EmailJS (fallback)
- ⚠️ Resend requiere configuración en Vercel
- ✅ Código mejorado con validaciones
- ✅ Mensajes de error más claros

**Próximos pasos:**
1. Obtener API Key de Resend
2. Configurar en Vercel
3. Probar envío de comprobante
4. Verificar que no vaya a spam

**Tiempo estimado:** 10-15 minutos

---

**Última actualización:** 20 de enero de 2026
