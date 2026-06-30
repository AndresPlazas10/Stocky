import React, { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import type { ComboProductRecord } from '../../../services/combosService';
import type { ComboFormItemState } from '../comboUtils';
import { combosStyles as styles } from '../combosStyles';

type Props = {
  visible: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  productCatalogFiltered: ComboProductRecord[];
  formItems: ComboFormItemState[];
  productPickerRowIndex: number | null;
  onSelectProduct: (productId: string) => void;
  onClose: () => void;
};

export const ProductPickerModal = React.memo(function ProductPickerModal({
  visible,
  productSearch,
  onProductSearchChange,
  productCatalogFiltered,
  formItems,
  productPickerRowIndex,
  onSelectProduct,
  onClose,
}: Props) {
  const takenByOtherSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < formItems.length; i++) {
      if (i === productPickerRowIndex) continue;
      const pid = formItems[i]?.productoId;
      if (pid) set.add(pid);
    }
    return set;
  }, [formItems, productPickerRowIndex]);
  return (
    <StockyModal
      visible={visible}
      title="Selecciona un producto"
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={24}
      modalAnimationType="fade"
      animationDurationMs={150}
      bodyFlex
      perfTag="combos.picker_producto"
      onClose={onClose}
    >
      <View style={styles.modalSection}>
        <TextInput
          value={productSearch}
          onChangeText={onProductSearchChange}
          placeholder="Buscar por nombre o codigo..."
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {productCatalogFiltered.length === 0 ? (
        <Text style={styles.emptyText}>No se encontraron productos para seleccionar.</Text>
      ) : null}

      {productCatalogFiltered.map((product) => {
        const selected =
          productPickerRowIndex !== null &&
          formItems[productPickerRowIndex]?.productoId === product.id;
        const takenByOther = takenByOtherSet.has(product.id);
        return (
          <Pressable
            key={product.id}
            style={[
              styles.comboPickerItem,
              selected && styles.comboPickerItemSelected,
              takenByOther && styles.comboPickerItemDisabled,
            ]}
            onPress={() => onSelectProduct(product.id)}
            disabled={takenByOther}
          >
            <Text
              style={[styles.comboPickerItemTitle, selected && styles.comboPickerItemTitleSelected]}
            >
              {product.name}
            </Text>
            <Text
              style={[styles.comboPickerItemMeta, selected && styles.comboPickerItemMetaSelected]}
            >
              {product.code || 'Sin código'} · Stock {product.stock}
              {takenByOther ? ' · Ya agregado' : ''}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
});
