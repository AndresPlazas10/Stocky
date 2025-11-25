#!/bin/bash
# Script para remover console.log/error/warn de producción
# Mantiene solo errores críticos en producción

find src -name "*.jsx" -o -name "*.js" | while read file; do
  # Respaldar archivo
  cp "$file" "$file.bak"
  
  # Remover console.log
  sed -i '' '/^\s*console\.log(/d' "$file"
  
  # Remover console.warn  
  sed -i '' '/^\s*console\.warn(/d' "$file"
  
  # Remover console.info
  sed -i '' '/^\s*console\.info(/d' "$file"
  
  # Remover console.debug
  sed -i '' '/^\s*console\.debug(/d' "$file"
  
  echo "Procesado: $file"
done

echo "✅ Console statements removidos"
echo "⚠️  Backups creados con extensión .bak"
