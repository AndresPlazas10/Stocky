import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { configuracionStyles as styles } from '../configuracionStyles';

interface SectionHeaderProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ icon, title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.sectionHeader}
    >
      <View style={styles.sectionHeaderTop}>
        <View style={styles.sectionHeaderIconWrap}>
          <Ionicons name={icon} size={28} color="#D1D5DB" />
        </View>
        <View style={styles.sectionHeaderTextWrap}>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable style={styles.sectionHeaderAction} onPress={onAction}>
            <Ionicons name="create-outline" size={18} color="#D1D5DB" />
            <Text style={styles.sectionHeaderActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}
