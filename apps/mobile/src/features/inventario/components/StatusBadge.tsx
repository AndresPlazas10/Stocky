import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { inventarioStyles as styles } from '../inventarioStyles';

export function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusInactive]}>
      {active ? <Ionicons name="checkmark" size={16} color="#067647" /> : null}
      <Text
        style={[
          styles.statusBadgeText,
          active ? styles.statusActiveText : styles.statusInactiveText,
        ]}
      >
        {active ? t('inventarioSection.active') : t('inventarioSection.inactive')}
      </Text>
    </View>
  );
}
