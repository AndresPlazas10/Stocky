import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  canManageProducts: boolean;
  checkingPermissions: boolean;
  openCreateModal: () => void;
  search: string;
  setSearch: (v: string) => void;
  filteredCount: number;
  totalCount: number;
  refreshing: boolean;
};

export const InventoryListHeader = memo(function InventoryListHeader({
  canManageProducts,
  checkingPermissions,
  openCreateModal,
  search,
  setSearch,
  filteredCount,
  totalCount,
  refreshing,
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
            <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
          </View>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>Inventario</Text>
            <Text style={styles.heroSubtitle}>Gestión de productos y stock</Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.heroCreateButton,
            (!canManageProducts || checkingPermissions) && styles.buttonDisabled,
          ]}
          onPress={openCreateModal}
          disabled={!canManageProducts || checkingPermissions}
        >
          <Ionicons name="add" size={22} color="rgba(255,255,255,0.88)" />
          <Text style={styles.heroCreateButtonText}>Agregar Producto</Text>
        </Pressable>
      </LinearGradient>

      {!canManageProducts ? (
        <Text style={styles.permissionText}>Modo consulta: sin permisos de edición</Text>
      ) : null}

      <View style={styles.searchCard}>
        <View style={styles.searchTitleRow}>
          <Ionicons name="search-outline" size={18} color="#1E3A8A" />
          <Text style={styles.searchTitle}>Buscar producto por nombre</Text>
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Ej: Coca Cola, Arroz, Cerveza..."
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Text style={styles.searchResultText}>
          Mostrando {filteredCount} de {totalCount} productos
        </Text>
      </View>

      {refreshing ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
    </View>
  );
});
