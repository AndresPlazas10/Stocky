import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import type {
  InventoryProductRecord,
  InventorySupplierRecord,
} from '../../../services/inventoryService';
import { getSupplierDisplayName, UNIT_OPTIONS, type ProductFormState } from '../inventoryUtils';
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
  const [formDetailsReady, setFormDetailsReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFormDetailsReady(false); // eslint-disable-line react-hooks/set-state-in-effect -- reset al cerrar modal
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setFormDetailsReady(true);
      }
    });

    return () => {
      cancelled = true;
      (task as { cancel?: () => void }).cancel?.();
    };
  }, [visible]);

  const selectedUnitLabel =
    UNIT_OPTIONS.find((item) => item.value === form.unit)?.label || 'Unidad';
  const selectedSupplierLabel = form.supplierId
    ? getSupplierDisplayName(suppliers.find((s) => s.id === form.supplierId))
    : 'Sin proveedor';

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      modalAnimationType="fade"
      animationDurationMs={180}
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
            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
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
            <Text style={styles.productFormCancelText}>Cancelar</Text>
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
                  ? 'Actualizando...'
                  : 'Creando...'
                : editingProduct
                  ? 'Actualizar'
                  : 'Guardar'}
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
            <Text style={styles.readOnlyCodeLabel}>Código</Text>
            <Text style={styles.readOnlyCodeValue}>{editingProduct.code || 'n/a'}</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>Nombre del producto *</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => onFormChange({ name: value })}
            placeholder="Ej: Laptop HP"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={styles.textInput}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>Categoría *</Text>
          <Pressable style={styles.selectInput} onPress={onOpenCategoryPicker}>
            <Text style={[styles.selectInputText, !form.category && styles.selectInputPlaceholder]}>
              {form.category || 'Seleccionar categoría'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#64748B" />
          </Pressable>
        </View>

        {formDetailsReady ? (
          <>
            <View style={styles.warningCard}>
              <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
              <Text style={styles.warningText}>
                Nota importante: para que los productos aparezcan en los recibos de cocina, deben
                estar en la categoría "Platos". Los productos de otras categorías no se incluirán.
              </Text>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Precio compra *</Text>
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
                <Text style={styles.inputLabel}>Precio venta *</Text>
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
              <Text style={styles.inputLabel}>Control de stock</Text>
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
                <Text style={styles.stockControlText}>¿Este producto lleva control de stock?</Text>
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
                  Stock {editingProduct ? 'actual' : 'inicial'}{' '}
                  {form.manageStock ? '*' : '(deshabilitado)'}
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
                <Text style={styles.inputLabel}>Stock mínimo</Text>
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
                <Text style={styles.inputLabel}>Unidad</Text>
                <Pressable style={styles.selectInput} onPress={onOpenUnitPicker}>
                  <Text style={styles.selectInputText}>{selectedUnitLabel}</Text>
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Proveedor (opcional)</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => {
                  onRefreshSuppliers();
                  onOpenSupplierPicker();
                }}
              >
                <Text
                  style={[
                    styles.selectInputText,
                    !form.supplierId && styles.selectInputPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedSupplierLabel}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.formSectionLoader}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={styles.formSectionLoaderText}>Cargando campos avanzados...</Text>
          </View>
        )}
      </View>
    </StockyModal>
  );
}
