import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { configuracionStyles as styles } from '../configuracionStyles';

interface InfoItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <View style={styles.infoItem}>
      <View style={styles.infoTopRow}>
        <Ionicons name={icon} size={24} color="#111827" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
