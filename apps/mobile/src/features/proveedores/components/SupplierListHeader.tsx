import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { proveedoresStyles as styles } from '../proveedoresStyles';

interface SupplierListHeaderProps {
  canManageSuppliers: boolean;
  checkingPermissions: boolean;
  loading: boolean;
  refreshing: boolean;
  onCreate: () => void;
}

export const SupplierListHeader = memo(function SupplierListHeader({
  canManageSuppliers,
  checkingPermissions,
  loading,
  refreshing,
  onCreate,
}: SupplierListHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Ionicons name="business-outline" size={56} color="#C9CBD2" />
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>Proveedores</Text>
            <Text style={styles.heroSubtitle}>Gestiona tu red de proveedores</Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.heroCreateButtonWrap,
            (!canManageSuppliers || checkingPermissions) && styles.buttonDisabled,
          ]}
          onPress={onCreate}
          disabled={!canManageSuppliers || checkingPermissions}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroCreateButton}
          >
            <Ionicons name="add" size={22} color="#D1D5DB" />
            <Text style={styles.heroCreateButtonText}>Nuevo Proveedor</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {loading || refreshing ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
    </View>
  );
});
