import React, { useCallback, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import type { MesaOrderCatalogItem } from '../../../services/mesaOrderService';

interface CatalogResultsListProps {
  catalog: MesaOrderCatalogItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemPress: (item: MesaOrderCatalogItem) => void;
  loading?: boolean;
  disabled?: boolean;
  isKeyboardVisible?: boolean;
}

const CatalogItemSeparator = () => <View style={styles.catalogResultRowDivider} />;

const catalogKeyExtractor = (item: MesaOrderCatalogItem) => `${item.item_type}:${item.id}`;

export const CatalogResultsList = React.memo(function CatalogResultsList({
  catalog,
  searchQuery,
  onSearchChange,
  onItemPress,
  loading = false,
  disabled = false,
  isKeyboardVisible = false,
}: CatalogResultsListProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const hasCatalogQuery = searchQuery.trim().length > 0;

  const renderItem = useCallback(
    ({ item }: { item: MesaOrderCatalogItem }) => (
      <Pressable
        style={[styles.catalogResultRow, disabled && styles.disabled]}
        disabled={disabled}
        onPress={() => {
          if (isKeyboardVisible) {
            Keyboard.dismiss();
            return;
          }
          onItemPress(item);
        }}
      >
        <View style={styles.catalogResultLeft}>
          <Text style={styles.catalogResultName}>{item.name}</Text>
          {item.item_type === 'combo' ? (
            <View style={styles.comboPill}>
              <Text style={styles.comboPillText}>Combo</Text>
            </View>
          ) : null}
        </View>
        <StockyMoneyText
          value={Number(item.sale_price || 0)}
          style={styles.catalogResultPrice}
        />
      </Pressable>
    ),
    [disabled, isKeyboardVisible, onItemPress],
  );

  return (
    <>
      <View style={styles.catalogSearchHeader}>
        <Ionicons name="search-outline" size={24} color="#111827" />
        <Text style={styles.catalogSearchHeaderText}>Agregar Producto o Combo</Text>
      </View>

      <TextInput
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Buscar por nombre..."
        placeholderTextColor={STOCKY_COLORS.textMuted}
        style={[styles.searchInput, isSearchFocused && styles.searchInputFocused]}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setIsSearchFocused(true)}
        onBlur={() => setIsSearchFocused(false)}
      />

      {hasCatalogQuery && loading ? (
        <Text style={styles.emptyState}>Cargando productos...</Text>
      ) : hasCatalogQuery && catalog.length === 0 ? (
        <Text style={styles.emptyState}>No hay resultados en el catalogo.</Text>
      ) : hasCatalogQuery ? (
        <View style={styles.catalogResultsCard}>
          <FlatList
            data={catalog}
            keyExtractor={catalogKeyExtractor}
            nestedScrollEnabled
            keyboardShouldPersistTaps="never"
            showsVerticalScrollIndicator
            style={styles.catalogResultsScroll}
            ItemSeparatorComponent={CatalogItemSeparator}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={5}
            renderItem={renderItem}
          />
        </View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  catalogSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  catalogSearchHeaderText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  searchInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  searchInputFocused: {
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyState: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 12,
  },
  catalogResultsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 2,
  },
  catalogResultsScroll: {
    maxHeight: 240,
  },
  catalogResultRow: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  catalogResultRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  catalogResultLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogResultName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  catalogResultPrice: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  comboPill: {
    borderRadius: 7,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  comboPillText: {
    color: '#1D4ED8',
    fontSize: 9,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.7,
  },
});
