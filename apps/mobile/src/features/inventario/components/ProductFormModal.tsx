import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import type {
  InventoryProductRecord,
  InventorySupplierRecord,
} from '../../../services/inventoryService';
import {
  getCategoryLabel,
  getSupplierDisplayName,
  getUnitLabel,
  type ProductFormState,
} from '../inventoryUtils';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  visible: boolean;
  saving: boolean;
  error: string | null;
  editingProduct: InventoryProductRecord | null;
  form: ProductFormState;
  suppliers: InventorySupplierRecord[];
  onClose: () => void;
  onFormChange: (updates: Partial<ProductFormState>) => void;
  onSave: () => void;
  onOpenCategoryPicker: () => void;
  onOpenUnitPicker: () => void;
  onOpenSupplierPicker: () => void;
  onRefreshSuppliers: () => void;
};

export function ProductFormModal({
  visible,
  saving,
  error,
  editingProduct,
  form,
  suppliers,
  onClose,
  onFormChange,
  onSave,
  onOpenCategoryPicker,
  onOpenUnitPicker,
  onOpenSupplierPicker,
  onRefreshSuppliers,
}: Props) {
  const { t } = useTranslation();
  const selectedUnitLabel = getUnitLabel(form.unit);
  const selectedCategoryLabel = form.category
    ? getCategoryLabel(form.category)
    : t('inventarioSection.selectCategory');
  const selectedSupplierLabel = form.supplierId
    ? getSupplierDisplayName(suppliers.find((s) => s.id === form.supplierId))
    : t('form.noSupplier');

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      bodyFlex
      sheetStyle={styles.productFormSheet}
      contentContainerStyle={styles.productFormContent}
      perfTag="inventario.form_producto"
      onClose={onClose}
      hideCloseButton
      headerSlot={
        <View style={styles.productFormHeader}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.productFormHeaderIconWrap}
          >
            <Ionicons name={editingProduct ? 'create-outline' : 'add'} size={30} color="#D1D5DB" />
          </LinearGradient>
          <Text style={styles.productFormHeaderTitle}>
            {editingProduct
              ? t('inventarioSection.editProduct')
              : t('inventarioSection.newProduct')}
          </Text>
          <Pressable
            style={[styles.productFormHeaderClose, saving && styles.buttonDisabled]}
            onPress={onClose}
            disabled={saving}
          >
            <Ionicons name="close" size={34} color="#111827" />
          </Pressable>
        </View>
      }
      footerStyle={styles.productFormFooter}
      footer={
        <View style={styles.productFormFooterRow}>
          <Pressable
            style={[styles.productFormCancelButton, saving && styles.buttonDisabled]}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.productFormCancelText}>{t('buttons.cancel')}</Text>
          </Pressable>
          <Pressable
            style={[styles.productFormSaveButton, saving && styles.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#F5F3FF" /> : null}
            <Text style={styles.productFormSaveText}>
              {saving
                ? editingProduct
                  ? t('inventarioSection.updating')
                  : t('inventarioSection.creating')
                : editingProduct
                  ? t('inventarioSection.update')
                  : t('inventarioSection.save')}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.formFields}>
        {error ? (
          <View style={styles.formErrorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}
        {editingProduct ? (
          <View style={styles.readOnlyCode}>
            <Text style={styles.readOnlyCodeLabel}>{t('inventarioSection.code')}</Text>
            <Text style={styles.readOnlyCodeValue}>{editingProduct.code || 'n/a'}</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>{t('inventarioSection.productName')}</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => onFormChange({ name: value })}
            placeholder={t('inventarioSection.productNamePlaceholder')}
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={styles.textInput}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>{t('inventarioSection.categoryRequired')}</Text>
          <Pressable style={styles.selectInput} onPress={onOpenCategoryPicker}>
            <Text style={[styles.selectInputText, !form.category && styles.selectInputPlaceholder]}>
              {selectedCategoryLabel}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#64748B" />
          </Pressable>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={styles.warningText}>{t('inventarioSection.kitchenReceiptNote')}</Text>
        </View>

        <View style={styles.formRow}>
          <View style={[styles.fieldGroup, styles.formCol]}>
            <Text style={styles.inputLabel}>{t('inventarioSection.purchasePrice')}</Text>
            <TextInput
              value={form.purchasePrice}
              onChangeText={(value) => onFormChange({ purchasePrice: value })}
              placeholder="0.00"
              keyboardType="numeric"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.textInput}
            />
          </View>
          <View style={[styles.fieldGroup, styles.formCol]}>
            <Text style={styles.inputLabel}>{t('inventarioSection.salePrice')}</Text>
            <TextInput
              value={form.salePrice}
              onChangeText={(value) => onFormChange({ salePrice: value })}
              placeholder="0.00"
              keyboardType="numeric"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.textInput}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>{t('inventarioSection.stockControl')}</Text>
          <Pressable
            style={styles.stockControlRow}
            onPress={() =>
              onFormChange(
                form.manageStock
                  ? { manageStock: false, stock: '0', minStock: '0' }
                  : { manageStock: true },
              )
            }
          >
            <Text style={styles.stockControlText}>
              {t('inventarioSection.stockControlQuestion')}
            </Text>
            <Ionicons
              name={form.manageStock ? 'checkbox' : 'square-outline'}
              size={22}
              color={form.manageStock ? '#6D28D9' : '#64748B'}
            />
          </Pressable>
        </View>

        <View style={styles.formRow}>
          <View style={[styles.fieldGroup, styles.formColThird]}>
            <Text style={styles.inputLabel}>
              {editingProduct
                ? t('inventarioSection.currentStock')
                : t('inventarioSection.initialStock')}{' '}
              {form.manageStock ? '*' : t('inventarioSection.disabled')}
            </Text>
            <TextInput
              value={form.stock}
              onChangeText={(value) => onFormChange({ stock: value })}
              placeholder="0"
              keyboardType="numeric"
              editable={!editingProduct && form.manageStock}
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={[
                styles.textInput,
                (!form.manageStock || !!editingProduct) && styles.textInputDisabled,
              ]}
            />
          </View>
          <View style={[styles.fieldGroup, styles.formColThird]}>
            <Text style={styles.inputLabel}>{t('inventarioSection.minimumStock')}</Text>
            <TextInput
              value={form.minStock}
              onChangeText={(value) => onFormChange({ minStock: value })}
              placeholder="5"
              keyboardType="numeric"
              editable={form.manageStock}
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={[styles.textInput, !form.manageStock && styles.textInputDisabled]}
            />
          </View>
          <View style={[styles.fieldGroup, styles.formColThird]}>
            <Text style={styles.inputLabel}>{t('inventarioSection.unit')}</Text>
            <Pressable style={styles.selectInput} onPress={onOpenUnitPicker}>
              <Text style={styles.selectInputText}>{selectedUnitLabel}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>{t('inventarioSection.supplierOptional')}</Text>
          <Pressable
            style={styles.selectInput}
            onPress={() => {
              onRefreshSuppliers();
              onOpenSupplierPicker();
            }}
          >
            <Text
              style={[styles.selectInputText, !form.supplierId && styles.selectInputPlaceholder]}
              numberOfLines={1}
            >
              {selectedSupplierLabel}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#64748B" />
          </Pressable>
        </View>
      </View>
    </StockyModal>
  );
}
