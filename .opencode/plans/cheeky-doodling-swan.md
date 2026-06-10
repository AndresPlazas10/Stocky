# Integrar Escena 3D GENKUB Robot

## Objetivo
Reemplazar la escena 3D de ejemplo con el robot GENKUB greeting que el usuario seleccionó.

## Cambios Necesarios

### Archivo: `src/pages/Home.jsx`
**Línea 302**: Actualizar la URL de la escena Spline

**Actual:**
```jsx
scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
```

**Nueva:**
```jsx
scene="https://prod.spline.design/c81LtkO3jIPTCgFo/scene.splinecode"
```

## Verificación
1. Ejecutar `npm run build` para verificar que compile correctamente
2. El servidor dev ya está corriendo en http://localhost:5173/
3. Recargar la página para ver el robot GENKUB en el Hero

## Notas
- El robot GENKUB es una escena 3D interactiva
- Ya está configurado el layout split con Spotlight teal
- No se necesitan otros cambios en el código
