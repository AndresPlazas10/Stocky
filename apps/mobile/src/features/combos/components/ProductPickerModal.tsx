import React, { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      title={t('combos.picker.title')}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={24}
      bodyFlex
      perfTag="combos.picker_producto"
      onClose={onClose}
    >
      <View style={styles.modalSection}>
        <TextInput
          value={productSearch}
          onChangeText={onProductSearchChange}
          placeholder={t('combos.picker.searchPlaceholder')}
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {productCatalogFiltered.length === 0 ? (
        <Text style={styles.emptyText}>{t('combos.picker.noResults')}</Text>
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
              {product.code || t('combos.form.noCode')} · Stock {product.stock}
              {takenByOther ? ` · ${t('combos.picker.alreadyAdded')}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
});
