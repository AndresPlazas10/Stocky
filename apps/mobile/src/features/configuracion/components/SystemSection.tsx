import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader } from './SectionHeader';
import { configuracionStyles as styles } from '../configuracionStyles';

interface SystemSectionProps {
  systemVersionLabel: string;
  systemStatusLabel: string;
}

export function SystemSection({ systemVersionLabel, systemStatusLabel }: SystemSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <SectionHeader
        icon="information-circle-outline"
        title="Información del Sistema"
        subtitle="Detalles técnicos"
      />
      <View style={styles.sectionBody}>
        <View style={[styles.systemItem, styles.systemInfoBlue]}>
          <View style={styles.systemTopRow}>
            <Ionicons name="settings-outline" size={24} color="#2563EB" />
            <Text style={[styles.systemLabel, styles.systemBlueText]}>Versión</Text>
          </View>
          <Text style={[styles.systemValue, styles.systemBlueText]}>{systemVersionLabel}</Text>
        </View>

        <View style={[styles.systemItem, styles.systemInfoPurple]}>
          <View style={styles.systemTopRow}>
            <Ionicons name="server-outline" size={24} color="#9333EA" />
            <Text style={[styles.systemLabel, styles.systemPurpleText]}>Base de Datos</Text>
          </View>
          <Text style={[styles.systemValue, styles.systemPurpleText]}>Supabase PostgreSQL</Text>
        </View>

        <View style={[styles.systemItem, styles.systemInfoGreen]}>
          <View style={styles.systemTopRow}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#059669" />
            <Text style={[styles.systemLabel, styles.systemGreenText]}>Estado</Text>
          </View>
          <Text style={[styles.systemValue, styles.systemGreenText]}>• {systemStatusLabel}</Text>
        </View>
      </View>
    </View>
  );
}
