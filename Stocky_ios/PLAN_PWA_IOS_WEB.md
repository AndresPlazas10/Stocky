# Plan PWA para iOS y web de Stocky

## Objetivo
Convertir la experiencia web de Stocky en una Progressive Web App instalable para usuarios de iPhone, con soporte de notificaciones web en iOS moderno, acceso rápido desde la pantalla de inicio y una integración visible dentro de www.stockypos.app.

## Requisito clave
La PWA de iOS debe tener paridad visual 1:1 con la app Android:
1. misma estructura de pantallas,
2. mismos componentes UI,
3. mismas tipografias, espaciados y jerarquia,
4. mismos estados de carga, vacio y error,
5. mismo comportamiento visual en login, dashboard, ventas, mesas, inventario y reportes.

## Resultado esperado
1. La web se puede instalar como PWA en iPhone.
2. El usuario encuentra fácilmente la opción de descarga e instalación desde la home y la página de descargas.
3. La app muestra instrucciones claras para iOS.
4. La PWA soporta notificaciones web donde iOS lo permita.
5. La implementación queda lista para mantener Android nativo y Windows como descargas separadas.

---

## Estado actual del proyecto
1. Existe la ruta pública de descarga en la web.
2. Ya hay una página de descargas para Android y Windows.
3. El proyecto detecta iOS y modo standalone mediante hooks existentes.
4. Todavía no existe manifest de PWA ni service worker dedicado.
5. Todavía no existe una estrategia formal de instalación PWA en la interfaz.

---

## Fase 0. Alcance y decisiones técnicas
Objetivo: definir qué entra en la PWA y qué sigue siendo nativo.

Tareas:
1. Confirmar que la PWA será la opción principal para iOS web.
2. Mantener Android como app nativa y Windows como instalador.
3. Definir el alcance de la primera versión de PWA:
   - login
   - dashboard
   - ventas
   - mesas
   - inventario
   - reportes
   - notificaciones web
4. Decidir si la PWA tendrá un modo offline básico o solo caché de shell e interfaz.
5. Definir si la PWA será una capa de la misma web actual o una experiencia con rutas e instrucciones especiales para iOS.
6. Definir una matriz de paridad visual Android vs PWA para cada modulo critico.

Entregable:
- Documento de alcance de la PWA v1.

---

## Fase 1. Base PWA técnica
Objetivo: hacer que la web sea instalable y cargue de forma consistente.

Tareas:
1. Agregar manifest de PWA con:
   - nombre
   - short name
   - theme color
   - background color
   - iconos de 192, 512 y Apple touch
2. Agregar service worker con estrategia de cache para:
   - shell de la aplicación
   - assets estáticos
   - rutas críticas
3. Configurar actualización automática o semiautomática de la PWA.
4. Verificar que el build web siga funcionando en Vercel.
5. Asegurar que los assets públicos estén accesibles por HTTPS.

Entregable:
- PWA base instalable en navegador compatible.

---

## Fase 2. Integración visual en la web
Objetivo: que el usuario encuentre la instalación sin buscarla.

Tareas:
1. Agregar un bloque visible en la home explicando la experiencia PWA.
2. Mantener la ruta de descargas actual como página central de plataforma.
3. Mostrar un botón claro para instalar o aprender cómo instalar en iPhone.
4. Agregar instrucciones específicas para iOS:
   - abrir en Safari
   - usar compartir
   - añadir a pantalla de inicio
5. Mostrar una pista visual si el usuario está en iPhone o si la app ya está instalada como standalone.
6. Incluir un CTA secundario en navbar o hero para acceder a la página de instalación.

Entregable:
- Home con acceso visible a la PWA.

---

## Fase 3. Página de descargas unificada
Objetivo: centralizar Android, iOS PWA y Windows en un solo punto.

Tareas:
1. Ampliar la página de descargas para separar claramente:
   - Android
   - iPhone PWA
   - Windows
2. Cambiar el copy para que el usuario entienda qué descarga corresponde a cada plataforma.
3. Añadir tarjeta específica para iPhone con instrucciones de instalación como PWA.
4. Mantener el botón de Windows apuntando al instalador publicado.
5. Mantener el botón de Android apuntando al APK oficial.

Entregable:
- Página de descargas con tres caminos claros por plataforma.

---

## Fase 4. Notificaciones web en iOS
Objetivo: habilitar alertas para usuarios de iPhone dentro de la PWA.

Tareas:
1. Verificar compatibilidad con iOS 16.4 o superior.
2. Implementar el flujo de permiso de notificaciones dentro de la PWA.
3. Conectar el registro del suscriptor con el backend existente.
4. Asegurar que los eventos importantes disparen notificaciones:
   - nueva venta
   - stock bajo
   - mensajes operativos
5. Definir fallback cuando el navegador o iOS no soporte push.

Entregable:
- Notificaciones web operativas en iPhone compatible.

---

## Fase 5. UX específica de iOS
Objetivo: evitar confusión entre app web, PWA instalada y app nativa.

Tareas:
1. Detectar iOS y mostrar instrucciones específicas.
2. Detectar modo standalone y simplificar la UI cuando la app ya está instalada.
3. Ocultar o suavizar elementos redundantes de navegador en standalone.
4. Usar banners o cards de instalación con copy corto y claro.
5. Asegurar que los botones tengan tamaños cómodos para touch.
6. Validar que ajustes de iOS (safe area, barra superior, teclado) no rompan la paridad visual respecto a Android.

Entregable:
- Experiencia iOS más parecida a una app.

---

## Fase 6. QA y validación
Objetivo: probar la PWA antes de publicarla como canal recomendado para iOS.

Tareas:
1. Probar instalación en Safari de iPhone.
2. Probar acceso offline parcial o recarga con caché.
3. Probar notificaciones donde sea compatible.
4. Probar login, ventas, mesas e inventario en modo PWA.
5. Validar que la página de descargas siga funcionando en desktop y Android.

Entregable:
- Checklist de QA PWA aprobado.

---

## Cambios sugeridos en el código
1. Configurar un plugin de PWA en la build web.
2. Crear o ampliar el manifest con iconos correctos.
3. Registrar service worker en el arranque de la app.
4. Reutilizar la detección de iOS y standalone ya existente.
5. Ajustar la home y la página de descargas para iPhone.
6. Conectar el flujo de notificaciones al backend actual.

---

## Páginas y archivos que probablemente se tocan
1. index.html
2. vite.config.js
3. src/main.jsx
4. src/App.jsx
5. src/pages/Home.jsx
6. src/pages/Download.jsx
7. src/hooks/useViewport.js
8. src/utils/notifications o servicio equivalente
9. public/ para iconos y manifest

---

## Cronograma sugerido
1. Día 1: alcance y decisión de rutas.
2. Día 2: manifest y service worker.
3. Día 3: integración visual en home y descargas.
4. Día 4: notificaciones web.
5. Día 5: QA en iPhone y ajustes finales.

---

## Riesgos
1. iOS limita algunas capacidades de PWA respecto a una app nativa.
2. El usuario debe instalarla desde Safari y no desde cualquier navegador.
3. Las notificaciones dependen de soporte iOS y permisos del usuario.
4. La experiencia debe explicarse bien para no parecer una simple web.

---

## Criterios de salida
La PWA se considera lista cuando:
1. Se puede instalar desde iPhone.
2. La home y la página de descargas explican claramente cómo usarla.
3. Las notificaciones funcionan en iOS compatible.
4. No rompe el flujo de Android ni Windows.
5. La web sigue desplegando bien en Vercel.

---

## Próximo paso recomendado
1. Implementar primero manifest y service worker.
2. Luego agregar la tarjeta de iPhone PWA en la página de descargas.
3. Después conectar notificaciones web.
