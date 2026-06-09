#!/usr/bin/env python3
"""
Script mejorado para eliminar todas las funciones realtime inline de MesasPanel.tsx
"""

import re

def remove_function(lines, pattern):
    """Elimina una función que coincide con el patrón"""
    for i, line in enumerate(lines):
        if re.search(pattern, line):
            # Encontrar el cierre de useCallback
            bracket_count = 0
            start_line = i
            in_function = False
            
            for j in range(i, len(lines)):
                if 'useCallback(' in lines[j]:
                    in_function = True
                
                if in_function:
                    bracket_count += lines[j].count('{') - lines[j].count('}')
                    
                    if bracket_count == 0 and '});' in lines[j]:
                        # Eliminar desde start_line hasta j (inclusive)
                        del lines[start_line:j+1]
                        return True
    
    return False

def main():
    filepath = '/Users/andresplazas/Documents/Stocky/apps/mobile/src/features/mesas/MesasPanel.tsx'
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Patrones de funciones a eliminar
    patterns = [
        r'const applyRealtimeMesaLockHint = useCallback',
        r'const applyRealtimeMesaLockEvent = useCallback',
        r'const applyRealtimeMesaLockBroadcast = useCallback',
        r'const refreshMesasRealtime = useCallback',
        r'const scheduleMesasRealtimeRefresh = useCallback',
        r'const scheduleMesaLocksRefresh = useCallback',
        r'const scheduleOrderRealtimeSummaryHydration = useCallback',
        r'const applyRealtimeTableEvent = useCallback',
        r'const applyRealtimeOrderEvent = useCallback',
        r'const applyRealtimeOrderItemDelta = useCallback',
        r'const applyRealtimeMesaBroadcast = useCallback',
    ]
    
    removed_count = 0
    for pattern in patterns:
        if remove_function(lines, pattern):
            removed_count += 1
            print(f"Eliminada: {pattern}")
        else:
            print(f"NO encontrada: {pattern}")
    
    # Guardar archivo
    with open(filepath, 'w') as f:
        f.writelines(lines)
    
    print(f"\nTotal eliminadas: {removed_count}/{len(patterns)}")
    print(f"Archivo guardado: {filepath}")

if __name__ == '__main__':
    main()
