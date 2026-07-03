import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { reportesStyles as s } from '../reportesStyles';

interface InsightsProps {
  items: string[];
}

export function Insights({ items }: InsightsProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Insights</Text>
      {items.map((item) => (
        <View key={item} style={s.insightRow}>
          <Ionicons name="sparkles-outline" size={16} color="#334155" />
          <Text style={s.insightText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
