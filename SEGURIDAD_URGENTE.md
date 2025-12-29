# 🔒 INSTRUCCIONES DE SEGURIDAD URGENTES

## ⚠️ ACCIÓN INMEDIATA REQUERIDA

**Fecha:** 28 de diciembre de 2025

### 🚨 CREDENCIALES EXPUESTAS EN GIT

El archivo `.env.production` fue commiteado al repositorio con **credenciales reales**.

---

## ✅ ACCIONES COMPLETADAS

1. ✅ **Removido `.env.production` de Git**
   ```bash
   git rm --cached .env.production
   ```

2. ✅ **Actualizado `.gitignore`**
   - Agregado `.env.production` explícitamente
   - Agregado `.env.development`

3. ✅ **Validación de variables de entorno mejorada**
   - [src/supabase/Client.jsx](src/supabase/Client.jsx) ahora valida con mensajes claros

---

## 🔴 ACCIONES REQUERIDAS POR TI

### 1. **Commitear los Cambios de Seguridad**
```bash
cd /Users/andres_plazas/Desktop/Stockly
git add .gitignore
git commit -m "🔒 Security: Remove .env.production and update .gitignore"
git push
```

### 2. **ROTAR CREDENCIALES EXPUESTAS** 🔥

Las siguientes credenciales en `.env.production` están **comprometidas** y deben rotarse:

#### **Supabase (URGENTE)**
1. Ve a https://supabase.com/dashboard
2. Ve a tu proyecto → Settings → API
3. Click en "Reset project API keys"
4. Actualiza `.env.production` LOCAL (NO commitear)

#### **EmailJS (URGENTE)**
1. Ve a https://dashboard.emailjs.com
2. Ve a Integration → API Keys
3. Regenera las keys:
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_TEMPLATE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`

#### **Resend (Si aplica)**
1. Ve a https://resend.com/api-keys
2. Revoca la key expuesta
3. Genera nueva `VITE_RESEND_API_KEY`

### 3. **Actualizar Vercel (Producción)**
```bash
# Ir a Vercel Dashboard
# Project → Settings → Environment Variables
# Actualizar todas las variables con las nuevas credenciales
```

### 4. **Verificar Historial de Git**

Si el repositorio es **público** o ha sido clonado por otros:
```bash
# Opción Nuclear: Reescribir historial (PELIGROSO)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.production" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

⚠️ **ADVERTENCIA:** Solo hacer esto si:
- El repo es privado y solo tú tienes acceso
- O coordinas con todo el equipo para re-clonar

---

## 📋 CHECKLIST DE SEGURIDAD

- [x] `.env.production` removido de Git
- [x] `.gitignore` actualizado
- [x] Validación de env vars mejorada
- [ ] **Commitear cambios de seguridad**
- [ ] **Rotar Supabase API keys**
- [ ] **Rotar EmailJS keys**
- [ ] **Actualizar variables en Vercel**
- [ ] Verificar historial de Git
- [ ] Notificar al equipo (si aplica)

---

## 🛡️ PREVENCIÓN FUTURA

### Usar Variables de Entorno en Vercel
```bash
# NO hacer:
git add .env.production

# SÍ hacer:
# 1. Mantener .env.production SOLO en local
# 2. Configurar en Vercel Dashboard
# 3. Usar .env.production.example como template
```

### Template Seguro (.env.production.example)
```bash
# Este archivo SÍ puede estar en Git
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_key_aqui
VITE_EMAILJS_SERVICE_ID=service_xxx
```

---

## 📞 SOPORTE

Si necesitas ayuda:
1. Documentación Supabase: https://supabase.com/docs/guides/api#api-url-and-keys
2. Documentación EmailJS: https://www.emailjs.com/docs/
3. Vercel Env Vars: https://vercel.com/docs/concepts/projects/environment-variables

---

**Generado:** 28 de diciembre de 2025  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** ⏳ ACCIÓN REQUERIDA
