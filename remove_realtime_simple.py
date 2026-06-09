#!/usr/bin/env python3
"""
Script simplificado para eliminar funciones realtime inline
"""

import re

def main():
    filepath = '/Users/andresplazas/Documents/Stocky/apps/mobile/src/features/mesas/MesasPanel.tsx'
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Funciones a eliminar
    function_names = [
        'applyRealtimeMesaLockHint',
        'applyRealtimeMesaLockEvent',
        'applyRealtimeMesaLockBroadcast',
        'refreshMesasRealtime',
        'scheduleMesasRealtimeRefresh',
        'scheduleMesaLocksRefresh',
        'scheduleOrderRealtimeSummaryHydration',
        'applyRealtimeTableEvent',
        'applyRealtimeOrderEvent',
        'applyRealtimeOrderItemDelta',
        'applyRealtimeMesaBroadcast',
    ]
    
    ranges_to_remove = []
    
    for func_name in function_names:
        # Buscar la línea de inicio
        start_idx = None
        for i, line in enumerate(lines):
            if f'const {func_name} = useCallback' in line:
                start_idx = i
                break
        
        if start_idx is None:
            print(f"✗ No encontrada: {func_name}")
            continue
        
        # Encontrar el cierre (buscar }); con el mismo nivel de indentación)
        bracket_count = 0
        end_idx = None
        
        for i in range(start_idx, len(lines)):
            line = lines[i]
            bracket_count += line.count('{') - line.count('}')
            
            if bracket_count == 0 and '});' in line:
                end_idx = i
                break
        
        if end_idx is not None:
            ranges_to_remove.append((start_idx, end_idx, func_name))
            print(f"✓ {func_name}: líneas {start_idx+1}-{end_idx+1}")
        else:
            print(f"✗ No se encontró cierre: {func_name}")
    
    # Ordenar de mayor a menor para eliminar desde el final
    ranges_to_remove.sort(key=lambda x: x[0], reverse=True)
    
    # Eliminar rangos
    for start, end, name in ranges_to_remove:
        del lines[start:end+1]
    
    # Guardar archivo
    with open(filepath, 'w') as f:
        f.writelines(lines)
    
    print(f"\nTotal eliminadas: {len(ranges_to_remove)}/{len(function_names)}")
    print(f"Líneas eliminadas: {sum(end - start + 1 for start, end, _ in ranges_to_remove)}")

if __name__ == '__main__':
    main()
