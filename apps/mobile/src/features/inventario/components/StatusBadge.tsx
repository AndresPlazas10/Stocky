import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inventarioStyles as styles } from '../inventarioStyles';

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusInactive]}>
      {active ? <Ionicons name="checkmark" size={16} color="#067647" /> : null}
      <Text
        style={[
          styles.statusBadgeText,
          active ? styles.statusActiveText : styles.statusInactiveText,
        ]}
      >
        {active ? 'Activo' : 'Inactivo'}
      </Text>
    </View>
  );
}
