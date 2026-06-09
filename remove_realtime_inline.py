#!/usr/bin/env python3
"""
Script para eliminar todas las funciones realtime inline de MesasPanel.tsx
"""

import re

def find_closing_bracket(lines, start_line):
    """Encuentra la línea de cierre de un useCallback (}, [deps]);)"""
    bracket_count = 0
    in_usecallback = False
    
    for i in range(start_line, len(lines)):
        line = lines[i]
        
        if 'useCallback(' in line:
            in_usecallback = True
        
        if in_usecallback:
            bracket_count += line.count('{') - line.count('}')
            
            if bracket_count == 0 and '});' in line:
                return i
    
    return -1

def find_useeffect_end(lines, start_line):
    """Encuentra la línea de cierre de un useEffect"""
    bracket_count = 0
    in_useeffect = False
    
    for i in range(start_line, len(lines)):
        line = lines[i]
        
        if 'useEffect(' in line:
            in_useeffect = True
        
        if in_useeffect:
            bracket_count += line.count('{') - line.count('}')
            
            if bracket_count == 0 and ('});' in line or '}, [' in line):
                return i
    
    return -1

def main():
    filepath = '/Users/andresplazas/Documents/Stocky/apps/mobile/src/features/mesas/MesasPanel.tsx'
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Funciones realtime a eliminar (líneas base 0-indexed)
    functions_to_remove = [
        578,  # applyRealtimeMesaLockHint
        622,  # applyRealtimeMesaLockEvent
        680,  # applyRealtimeMesaLockBroadcast
        850,  # refreshMesasRealtime
        899,  # scheduleMesasRealtimeRefresh
        907,  # scheduleMesaLocksRefresh
        977,  # scheduleOrderRealtimeSummaryHydration
        993,  # applyRealtimeTableEvent
        1157, # applyRealtimeOrderEvent
        1214, # applyRealtimeOrderItemDelta
        1354, # applyRealtimeMesaBroadcast
    ]
    
    # useEffect de suscripciones realtime
    useeffect_line = 1482
    
    # Encontrar rangos a eliminar
    ranges_to_remove = []
    
    for start_line in functions_to_remove:
        if start_line < len(lines):
            end_line = find_closing_bracket(lines, start_line)
            if end_line != -1:
                ranges_to_remove.append((start_line, end_line))
                print(f"Función en línea {start_line+1}: eliminar hasta línea {end_line+1}")
    
    # Encontrar useEffect
    useeffect_end = find_useeffect_end(lines, useeffect_line)
    if useeffect_end != -1:
        ranges_to_remove.append((useeffect_line, useeffect_end))
        print(f"useEffect en línea {useeffect_line+1}: eliminar hasta línea {useeffect_end+1}")
    
    # Ordenar rangos de mayor a menor para eliminar desde el final
    ranges_to_remove.sort(reverse=True)
    
    # Eliminar rangos
    for start, end in ranges_to_remove:
        del lines[start:end+1]
    
    # Guardar archivo
    with open(filepath, 'w') as f:
        f.writelines(lines)
    
    print(f"\nEliminadas {len(ranges_to_remove)} funciones/useEffects")
    print(f"Archivo guardado: {filepath}")

if __name__ == '__main__':
    main()
