# 📧 Guía de Configuración de Email para Stockly

## 🚨 Problema Detectado

Supabase ha detectado una alta tasa de rebote en los emails transaccionales del proyecto. Esto puede resultar en restricción temporal del servicio de email.

## ✅ Soluciones Implementadas

### 1. **Validación Robusta de Emails**

Se ha creado `src/utils/emailValidation.js` con las siguientes validaciones:

- ✅ Formato de email (RFC 5322)
- ✅ Detección de emails temporales/descartables
- ✅ Normalización (lowercase, trim)
- ✅ Verificación de longitud máxima
- ✅ Detección de dominios inválidos
- ✅ Prevención de emails con puntos dobles

**Uso:**
```javascript
import { validateEmail } from './utils/emailValidation';

const result = validateEmail(email);
if (!result.valid) {
  console.error(result.error);
  return;
}
// Usar result.normalized
```

### 2. **Modo Testing para Desarrollo**

En desarrollo local (localhost), los emails se envían a un email de testing en lugar del email real.

**Configuración:**
1. Crea un archivo `.env.local`:
```env
# Email de testing válido para desarrollo
VITE_TEST_EMAIL=tu-email-real@gmail.com
```

2. Todos los emails en desarrollo se enviarán a este email de testing, evitando envíos a emails inválidos.

### 3. **Sistema de Logging**

Se implementó logging automático de todos los intentos de envío:

```javascript
import { getEmailStats } from './utils/emailValidation';

// Ver estadísticas de emails enviados
console.log(getEmailStats());
// Output: { total: 50, success: 45, failed: 3, skipped: 2 }
```

Los logs se guardan en `localStorage` y se pueden ver en la consola del navegador.

### 4. **EmailJS Mejorado**

El servicio `emailServiceSupabase.js` ahora:
- ✅ Valida emails antes de enviar
- ✅ Usa email de testing en desarrollo
- ✅ Registra todos los intentos
- ✅ Maneja errores apropiadamente
- ✅ No intenta enviar a emails inválidos

---

## 🔧 Configuración Recomendada: Custom SMTP

Para tener control total sobre el email, se recomienda usar un proveedor SMTP personalizado:

### Opción 1: **Resend** (Recomendado)

Resend es ideal para aplicaciones modernas, con excelente deliverability.

**Pasos:**
1. Regístrate en [resend.com](https://resend.com)
2. Verifica tu dominio
3. Obtén tu API Key
4. Añade a `.env.local`:
```env
VITE_RESEND_API_KEY=re_xxxxxxxxxxxxx
VITE_RESEND_FROM_EMAIL=noreply@tudominio.com
```

### Opción 2: **SendGrid**

SendGrid ofrece 100 emails/día gratis.

**Pasos:**
1. Regístrate en [sendgrid.com](https://sendgrid.com)
2. Crea una API Key
3. Verifica tu dominio/sender
4. Añade a `.env.local`:
```env
VITE_SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
VITE_SENDGRID_FROM_EMAIL=noreply@tudominio.com
```

### Opción 3: **Gmail SMTP**

Para proyectos pequeños, puedes usar Gmail.

**Pasos:**
1. Habilita "Aplicaciones menos seguras" o usa contraseña de aplicación
2. Añade a `.env.local`:
```env
VITE_SMTP_HOST=smtp.gmail.com
VITE_SMTP_PORT=587
VITE_SMTP_USER=tu-email@gmail.com
VITE_SMTP_PASS=tu-contraseña-de-aplicacion
VITE_SMTP_FROM=tu-email@gmail.com
```

---

## 📊 Verificación de Configuración

### En Desarrollo (Local)

```javascript
// En la consola del navegador:
import { isDevelopment, getTestEmail } from './utils/emailValidation';

console.log('¿Modo desarrollo?', isDevelopment()); // true
console.log('Email de testing:', getTestEmail()); // test@example.com o tu email configurado
```

### En Producción

Los emails se enviarán solo a direcciones validadas. Los emails inválidos serán rechazados antes de intentar el envío.

---

## 🧪 Testing

### Ver logs de emails enviados:

```javascript
// En consola del navegador
import { getEmailStats } from './utils/emailValidation';
console.table(getEmailStats());
```

### Limpiar logs:

```javascript
import { clearEmailLogs } from './utils/emailValidation';
clearEmailLogs();
```

### Verificar email específico:

```javascript
import { validateEmail } from './utils/emailValidation';

// Email válido
console.log(validateEmail('usuario@gmail.com'));
// { valid: true, normalized: 'usuario@gmail.com' }

// Email temporal (rechazado)
console.log(validateEmail('test@tempmail.com'));
// { valid: false, error: 'No se permiten emails temporales o descartables' }

// Email inválido
console.log(validateEmail('email-sin-dominio'));
// { valid: false, error: 'Formato de email inválido' }
```

---

## ✅ Checklist de Implementación

- [x] Validación robusta de emails implementada
- [x] Modo testing para desarrollo configurado
- [x] Sistema de logging implementado
- [x] EmailJS actualizado con validaciones
- [ ] Configurar SMTP personalizado (Resend/SendGrid/Gmail)
- [ ] Verificar dominio en proveedor SMTP elegido
- [ ] Configurar variables de entorno en producción (Vercel)
- [ ] Testing en producción con emails reales válidos

---

## 🚀 Deployment en Vercel

### Variables de Entorno Requeridas

En Vercel Dashboard → Settings → Environment Variables:

```env
# EmailJS (actual)
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx

# Email de testing (solo para preview/development)
VITE_TEST_EMAIL=tu-email-testing@gmail.com

# SMTP Personalizado (opcional pero recomendado)
VITE_RESEND_API_KEY=re_xxxxxxxxxxxxx
VITE_RESEND_FROM_EMAIL=noreply@tudominio.com
```

---

## 📞 Soporte Supabase

Si continúan los problemas de bounced emails después de implementar estas mejoras:

1. **Contacta a Supabase**: support@supabase.com
2. **Menciona las mejoras implementadas**:
   - Validación estricta de emails
   - Modo testing en desarrollo
   - Sistema de logging
   - Plan de migración a SMTP personalizado

3. **Proporciona métricas**:
```javascript
// Ejecutar en consola y enviar resultados
getEmailStats();
```

---

## 🎯 Mejores Prácticas

### ✅ Hacer:
- Validar SIEMPRE el email antes de enviar
- Usar email de testing en desarrollo
- Monitorear logs de envío
- Usar SMTP personalizado para producción
- Verificar dominio con SPF, DKIM, DMARC

### ❌ NO Hacer:
- Enviar emails a direcciones no verificadas
- Usar emails temporales/descartables
- Enviar emails de testing en producción
- Ignorar errores de bounced emails
- Usar el mismo email para development y production

---

## 📈 Monitoreo

### Dashboard de Email Stats

Puedes crear un componente de administración para ver estadísticas:

```jsx
import { getEmailStats } from '../utils/emailValidation';

function EmailDashboard() {
  const stats = getEmailStats();
  
  return (
    <div>
      <h2>Email Statistics</h2>
      <p>Total enviados: {stats.total}</p>
      <p>Exitosos: {stats.success}</p>
      <p>Fallidos: {stats.failed}</p>
      <p>Omitidos: {stats.skipped}</p>
      <p>Tasa de éxito: {((stats.success / stats.total) * 100).toFixed(1)}%</p>
    </div>
  );
}
```

---

## 🔍 Troubleshooting

### Problema: Emails no llegan en producción

**Solución:**
1. Verificar que las variables de entorno estén configuradas en Vercel
2. Revisar logs de email: `getEmailStats()`
3. Verificar que el email del destinatario sea válido
4. Comprobar carpeta de spam

### Problema: "Email inválido" en emails correctos

**Solución:**
1. Verificar que el dominio esté en la lista de permitidos
2. Si es un dominio corporativo, añadirlo manualmente:

```javascript
// src/utils/emailValidation.js
// Añadir dominio a COMMON_EMAIL_PROVIDERS si es necesario
```

### Problema: Modo testing no funciona en desarrollo

**Solución:**
1. Verificar que `.env.local` exista
2. Asegurar que `VITE_TEST_EMAIL` esté configurado
3. Reiniciar servidor de desarrollo: `npm run dev`

---

## 📚 Referencias

- [Supabase Email Best Practices](https://supabase.com/docs/guides/auth/auth-email-templates)
- [RFC 5322 Email Specification](https://tools.ietf.org/html/rfc5322)
- [Resend Documentation](https://resend.com/docs)
- [SendGrid Documentation](https://docs.sendgrid.com)
