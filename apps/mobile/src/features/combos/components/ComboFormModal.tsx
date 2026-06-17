import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import type { ComboProductRecord, ComboRecord } from '../../../services/combosService';
import type { ComboFormState } from '../comboUtils';
import { combosStyles as styles } from '../combosStyles';

type Props = {
  visible: boolean;
  saving: boolean;
  error: string | null;
  editingCombo: ComboRecord | null;
  form: ComboFormState;
  productsById: Map<string, ComboProductRecord>;
  hasDuplicateProducts: boolean;
  onClose: () => void;
  onFormChange: (updates: Partial<ComboFormState>) => void;
  onSave: () => void;
  onAddItemRow: () => void;
  onRemoveItemRow: (index: number) => void;
  onItemChange: (index: number, field: 'productoId' | 'cantidad', value: string) => void;
  onOpenProductPicker: (rowIndex: number) => void;
};

export function ComboFormModal({
  visible,
  saving,
  error: _error,
  editingCombo,
  form,
  productsById,
  hasDuplicateProducts,
  onClose,
  onFormChange,
  onSave,
  onAddItemRow,
  onRemoveItemRow,
  onItemChange,
  onOpenProductPicker,
}: Props) {
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      modalAnimationType="fade"
      animationDurationMs={180}
      bodyFlex
      sheetStyle={styles.comboFormSheet}
      contentContainerStyle={styles.comboFormContent}
      perfTag="combos.form_combo"
      onClose={onClose}
      hideCloseButton
      headerSlot={
        <View style={styles.comboFormHeader}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.comboFormHeaderIconWrap}
          >
            <Ionicons
              name={editingCombo ? 'create-outline' : 'layers-outline'}
              size={30}
              color="#D1D5DB"
            />
          </LinearGradient>
          <Text style={styles.comboFormHeaderTitle}>
            {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
          </Text>
          <Pressable
            style={[styles.comboFormHeaderClose, saving && styles.buttonDisabled]}
            onPress={onClose}
            disabled={saving}
          >
            <Ionicons name="close" size={34} color="#111827" />
          </Pressable>
        </View>
      }
      footerStyle={styles.comboFormFooter}
      footer={
        <View style={styles.comboFormFooterRow}>
          <Pressable
            style={[styles.comboFormCancelButton, saving && styles.buttonDisabled]}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.comboFormCancelButtonText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.comboFormSaveButton, saving && styles.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#F5F3FF" /> : null}
            <Text style={styles.comboFormSaveButtonText}>
              {saving ? 'Guardando...' : editingCombo ? 'Actualizar' : 'Guardar'}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.comboFormFields}>
        <View style={styles.comboFormRow}>
          <View style={[styles.modalSection, styles.comboFormCol]}>
            <Text style={styles.inputLabel}>Nombre del combo *</Text>
            <TextInput
              value={form.nombre}
              onChangeText={(next) => onFormChange({ nombre: next })}
              placeholder="Ej: Cubetazo"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.input}
            />
          </View>

          <View style={[styles.modalSection, styles.comboFormCol]}>
            <Text style={styles.inputLabel}>Precio de venta *</Text>
            <TextInput
              value={form.precioVenta}
              onChangeText={(next) => onFormChange({ precioVenta: next })}
              placeholder="Ej: 25000"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.input}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.modalSection}>
          <Text style={styles.inputLabel}>Descripción (opcional)</Text>
          <TextInput
            value={form.descripcion}
            onChangeText={(next) => onFormChange({ descripcion: next })}
            placeholder="Descripción del combo"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={[styles.input, styles.textArea]}
            multiline
          />
        </View>

        <View style={styles.modalSection}>
          <View style={styles.comboItemsHeaderRow}>
            <Text style={styles.inputLabel}>Productos del combo *</Text>
            <Pressable style={styles.comboAddItemButton} onPress={onAddItemRow}>
              <Ionicons name="add" size={16} color="#4338CA" />
              <Text style={styles.comboAddItemButtonText}>Agregar producto</Text>
            </Pressable>
          </View>

          <View style={styles.comboItemsList}>
            {form.items.map((item, index) => {
              const selectedProduct = productsById.get(item.productoId);
              return (
                <View key={`combo-item-${index}`} style={styles.comboItemRowWrap}>
                  <View style={styles.comboItemEditorRow}>
                    <Pressable
                      style={styles.comboItemSelect}
                      onPress={() => onOpenProductPicker(index)}
                    >
                      <Text
                        style={[
                          styles.comboItemSelectText,
                          !item.productoId && styles.comboItemSelectPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedProduct?.name || 'Selecciona un producto'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#64748B" />
                    </Pressable>

                    <TextInput
                      value={item.cantidad}
                      onChangeText={(next) => onItemChange(index, 'cantidad', next)}
                      keyboardType="numeric"
                      style={styles.comboItemQtyInput}
                      placeholder="Cantidad"
                      placeholderTextColor={STOCKY_COLORS.textMuted}
                    />

                    <Pressable
                      style={[
                        styles.comboItemRemoveButton,
                        form.items.length <= 1 && styles.buttonDisabled,
                      ]}
                      onPress={() => onRemoveItemRow(index)}
                      disabled={form.items.length <= 1}
                    >
                      <Ionicons name="close" size={18} color="#DC2626" />
                    </Pressable>
                  </View>

                  <Text style={styles.comboItemMeta} numberOfLines={1}>
                    {selectedProduct
                      ? `${selectedProduct.code || 'Sin código'} · Stock: ${selectedProduct.stock}`
                      : 'Producto requerido'}
                  </Text>
                </View>
              );
            })}
          </View>

          {hasDuplicateProducts ? (
            <Text style={styles.comboFieldError}>
              No se permiten productos repetidos en el combo.
            </Text>
          ) : null}
        </View>

        {form.items.length > 0 ? (
          <View style={styles.comboSummaryBox}>
            <Text style={styles.comboSummaryTitle}>Resumen de composición</Text>
            {form.items.map((item, index) => {
              const product = productsById.get(item.productoId);
              const quantity = Number(String(item.cantidad || '').replace(',', '.'));
              return (
                <Text key={`combo-summary-${index}`} style={styles.comboSummaryText}>
                  {Number.isFinite(quantity) && quantity > 0 ? quantity : 0} x{' '}
                  {product?.name || 'Producto sin seleccionar'}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>
    </StockyModal>
  );
}
