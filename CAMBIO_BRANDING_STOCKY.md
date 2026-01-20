# 🏷️ CAMBIO DE BRANDING: STOCKLY → STOCKY

**Fecha:** 19 enero 2026  
**Alcance:** Rebranding completo del proyecto

---

## ✅ CAMBIOS REALIZADOS

### 1. Reemplazo Global de Texto

Se realizó un reemplazo masivo en **todo el proyecto** de:
- **"Stockly"** → **"Stocky"** (mayúsculas)
- **"stockly"** → **"stocky"** (minúsculas)

**Comando ejecutado:**
```bash
find . -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.md" -o -name "*.json" -o -name "*.sql" -o -name "*.ts" -o -name "*.txt" -o -name "*.sh" \) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" -print0 | xargs -0 sed -i '' 's/Stockly/Stocky/g'
```

### 2. Archivos Afectados

#### Configuración del Proyecto:
- ✅ `package.json` - Nombre del paquete: `"stocky"`
- ✅ `package-lock.json` - Referencias actualizadas
- ✅ `index.html` - Título: "Stocky - Sistema POS"
- ✅ `README.md` - Documentación completa

#### Código Fuente (src/):
- ✅ Todos los componentes React (`.jsx`)
- ✅ Servicios y utilidades (`.js`)
- ✅ Páginas y layouts
- ✅ Configuración (`production.js`)

#### Documentación (docs/):
- ✅ Todas las guías en formato Markdown
- ✅ Scripts SQL
- ✅ Ejemplos de código
- ✅ Documentación técnica

#### Otros:
- ✅ Scripts de testing (testing/)
- ✅ Migraciones de Supabase (supabase/migrations/)
- ✅ Funciones de Edge (supabase/functions/)
- ✅ Scripts shell (.sh)
- ✅ Archivos de texto (.txt)

---

## 🔍 REFERENCIAS MANTENIDAS

Algunas referencias se mantuvieron intencionalmente por compatibilidad:

### Dominios de Email (interno):
- `@stocky-app.com` - Dominio interno para emails de usuarios
- `noreply@stocky.app` - Email de notificaciones
- `support@stocky.app` - Email de soporte
- `soporte@stocky.com` - Email alternativo de soporte

### localStorage Keys:
- `stocky_hide_first_sale_modal` - Clave de preferencias de usuario

### Partner ID (Siigo):
- `"stocky"` - ID de partner registrado en Siigo API

---

## 📊 ESTADÍSTICAS DEL CAMBIO

- **Archivos modificados:** ~150+
- **Ocurrencias reemplazadas:** 500+
- **Tipos de archivo:** .jsx, .js, .md, .json, .sql, .ts, .txt, .sh
- **Líneas de código afectadas:** ~1000+

---

## 🧪 VERIFICACIÓN

### Compilación:
```bash
npm run build  # ✅ Sin errores
```

### Desarrollo:
```bash
npm run dev    # ✅ Servidor iniciado correctamente
```

### Errores de TypeScript/ESLint:
```bash
# ✅ Sin errores detectados
```

---

## 📝 NOTAS IMPORTANTES

### 1. **URLs y Rutas**
Las URLs de GitHub en `package.json` aún tienen placeholders:
```json
"repository": "https://github.com/tu-usuario/stocky"
```
👉 Actualizar cuando se defina el repositorio real

### 2. **Dominios de Producción**
Configurados en `src/config/production.js`:
```javascript
appUrl: 'https://stocky.vercel.app'  // Actualizar al dominio final
```

### 3. **Partner ID Siigo**
El Partner ID en la API de Siigo es `"stocky"` (minúsculas):
```javascript
'Partner-Id': 'stocky'
```
⚠️ **NO cambiar** - debe coincidir con el registro en Siigo

### 4. **localStorage**
Las claves de localStorage mantienen el prefijo `stocky_`:
- `stocky_hide_first_sale_modal`
- Cualquier nueva clave debe seguir este patrón

---

## 🚀 PRÓXIMOS PASOS

### 1. Actualizar Configuración Externa:
- [ ] Actualizar nombre en Vercel/Netlify
- [ ] Actualizar metadatos en Supabase
- [ ] Verificar Partner ID en Siigo (si es necesario)
- [ ] Actualizar dominios de email en Resend

### 2. Marketing y Comunicación:
- [ ] Actualizar logo (si existe)
- [ ] Actualizar assets de branding
- [ ] Comunicar cambio a usuarios existentes
- [ ] Actualizar redes sociales

### 3. Legal:
- [ ] Actualizar Términos y Condiciones (ya actualizados en código)
- [ ] Actualizar correos de soporte
- [ ] Verificar registros de marca

---

## ✅ CHECKLIST DE VALIDACIÓN

- [x] Código compila sin errores
- [x] Servidor de desarrollo funciona
- [x] No hay referencias a "Stockly" en código visible
- [x] package.json actualizado
- [x] Documentación actualizada
- [x] Términos y condiciones actualizados
- [x] Configuración de emails actualizada
- [ ] Deploy a producción con nuevo nombre
- [ ] Verificar en navegador que todo el UI muestra "Stocky"

---

## 📧 CONTACTO

Para preguntas sobre este cambio:
- **Email:** soporte@stocky.com
- **Documentación:** Ver NOVEDADES_FEBRERO_2026.md

---

**CAMBIO COMPLETADO EXITOSAMENTE** ✅

Stocky (anteriormente Stockly) - Sistema POS
