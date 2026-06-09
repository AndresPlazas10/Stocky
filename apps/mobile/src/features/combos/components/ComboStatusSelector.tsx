import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ComboStatusFilter } from '../comboUtils';
import { combosStyles as styles } from '../combosStyles';

type Props = {
  value: ComboStatusFilter;
  onChange: (next: ComboStatusFilter) => void;
};

export const ComboStatusSelector = memo(function ComboStatusSelector({ value, onChange }: Props) {
  const options: Array<{ value: ComboStatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
  ];

  return (
    <View style={styles.filterRow}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.filterChip, selected && styles.filterChipSelected]}
          >
            <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
