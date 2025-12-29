#!/bin/bash

# Script de Verificación de Compatibilidad con Navegadores Antiguos
# Verifica que todos los archivos CSS usen sintaxis compatible

echo "🔍 Verificando compatibilidad con navegadores antiguos..."
echo ""

# Contador de problemas
ISSUES=0

# Verificar que browser-compat.css existe
if [ -f "src/browser-compat.css" ]; then
    echo "✅ browser-compat.css existe"
else
    echo "❌ browser-compat.css NO existe"
    ISSUES=$((ISSUES + 1))
fi

# Verificar que se importa en main.jsx
if grep -q "browser-compat.css" src/main.jsx; then
    echo "✅ browser-compat.css está importado en main.jsx"
else
    echo "❌ browser-compat.css NO está importado en main.jsx"
    ISSUES=$((ISSUES + 1))
fi

# Buscar sintaxis moderna de color incompatible (rgb con slash)
echo ""
echo "🔍 Buscando sintaxis moderna incompatible..."

# Buscar rgb/rgba con sintaxis slash en archivos CSS (excluyendo browser-compat.css que tiene fallbacks)
if grep -r "rgb([^)]*\s/\s" src/*.css | grep -v "browser-compat.css" | grep -v "//"; then
    echo "⚠️  Encontrada sintaxis rgb/rgba con slash (puede no ser compatible)"
    ISSUES=$((ISSUES + 1))
else
    echo "✅ No se encontró sintaxis rgb/rgba incompatible en archivos CSS principales"
fi

# Buscar backdrop-filter en archivos CSS (excluyendo browser-compat.css)
echo ""
if grep -r "backdrop-filter:" src/*.css | grep -v "browser-compat.css"; then
    echo "⚠️  Encontrado backdrop-filter (puede no ser compatible con navegadores antiguos)"
    echo "   Nota: Si está en browser-compat.css es parte de la solución"
else
    echo "✅ No se encontró backdrop-filter en archivos CSS principales"
fi

# Buscar gradientes sin prefijos
echo ""
echo "🔍 Verificando gradientes..."
if grep -r "background:.*linear-gradient" src/index.css | grep -v "\-webkit\-" | head -5; then
    echo "ℹ️  Algunos gradientes pueden necesitar prefijos -webkit- y -moz-"
    echo "   Verificando si tienen fallbacks..."
    
    # Contar líneas con linear-gradient
    TOTAL_GRADIENTS=$(grep -c "linear-gradient" src/index.css)
    # Contar líneas con -webkit-linear-gradient
    WEBKIT_GRADIENTS=$(grep -c "\-webkit-linear-gradient" src/index.css)
    
    if [ $WEBKIT_GRADIENTS -gt 0 ]; then
        echo "✅ Se encontraron $WEBKIT_GRADIENTS gradientes con prefijo -webkit-"
    else
        echo "⚠️  No se encontraron gradientes con prefijo -webkit-"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo "✅ Gradientes verificados"
fi

# Verificar orden de importación en main.jsx
echo ""
echo "🔍 Verificando orden de importación en main.jsx..."
ORDER_CHECK=$(grep -n "\.css" src/main.jsx | head -3)
echo "$ORDER_CHECK"

if echo "$ORDER_CHECK" | grep -q "index.css" && echo "$ORDER_CHECK" | grep -q "browser-compat.css"; then
    # Obtener números de línea
    INDEX_LINE=$(echo "$ORDER_CHECK" | grep "index.css" | cut -d: -f1)
    COMPAT_LINE=$(echo "$ORDER_CHECK" | grep "browser-compat.css" | cut -d: -f1)
    
    if [ "$INDEX_LINE" -lt "$COMPAT_LINE" ]; then
        echo "✅ Orden de importación correcto (index.css antes de browser-compat.css)"
    else
        echo "❌ Orden de importación incorrecto"
        ISSUES=$((ISSUES + 1))
    fi
fi

# Resumen final
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ISSUES -eq 0 ]; then
    echo "✅ VERIFICACIÓN EXITOSA"
    echo "   Todos los archivos están optimizados para compatibilidad"
    echo "   con navegadores antiguos."
else
    echo "⚠️  SE ENCONTRARON $ISSUES PROBLEMA(S)"
    echo "   Revisar los mensajes anteriores."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Información adicional
echo "📋 Navegadores soportados:"
echo "   • Internet Explorer 11+"
echo "   • Safari 9+"
echo "   • Chrome 49+"
echo "   • Firefox 52+"
echo "   • Edge (todas las versiones)"
echo ""

exit $ISSUES
