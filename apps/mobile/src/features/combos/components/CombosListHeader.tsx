import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { combosStyles as styles } from '../combosStyles';

type Props = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  canManageCombos: boolean;
  checkingPermissions: boolean;
  onOpenCreate: () => void;
};

export const CombosListHeader = memo(function CombosListHeader({
  loading,
  refreshing,
  error,
  canManageCombos,
  checkingPermissions,
  onOpenCreate,
}: Props) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIconBox}>
            <Ionicons name="layers-outline" size={32} color="#D1D5DB" />
          </View>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>Combos</Text>
            <Text style={styles.heroSubtitle}>Gestiona combos estructurados de productos</Text>
          </View>
        </View>

        <Pressable
          style={[styles.heroCreateButton, (!canManageCombos || checkingPermissions) && styles.buttonDisabled]}
          onPress={onOpenCreate}
          disabled={!canManageCombos || checkingPermissions}
        >
          <Ionicons name="add" size={20} color="rgba(255,255,255,0.88)" />
          <Text style={styles.heroCreateButtonText}>Nuevo Combo</Text>
        </Pressable>
      </LinearGradient>

      {loading || refreshing ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});
