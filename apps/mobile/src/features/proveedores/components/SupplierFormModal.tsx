import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import type { ProveedorRecord } from '../../../services/proveedoresService';
import type { ProveedorFormState } from '../proveedoresUtils';
import { proveedoresStyles as styles } from '../proveedoresStyles';

interface SupplierFormModalProps {
  visible: boolean;
  saving: boolean;
  error: string | null;
  editingSupplier: ProveedorRecord | null;
  form: ProveedorFormState;
  onFormChange: (updates: Partial<ProveedorFormState>) => void;
  onClose: () => void;
  onSave: () => void;
  formDetailsReady: boolean;
  setFormDetailsReady: (ready: boolean) => void;
}

export function SupplierFormModal({
  visible,
  saving,
  error,
  editingSupplier,
  form,
  onFormChange,
  onClose,
  onSave,
  formDetailsReady,
  setFormDetailsReady,
}: SupplierFormModalProps) {
  useEffect(() => {
    if (!visible) {
      setFormDetailsReady(false);
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
  }, [visible, setFormDetailsReady]);

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      modalAnimationType="fade"
      animationDurationMs={180}
      deferContent
      deferFallback={(
        <View style={styles.formDeferredFallback}>
          <ActivityIndicator color={STOCKY_COLORS.primary900} />
          <Text style={styles.formDeferredFallbackText}>Cargando formulario...</Text>
        </View>
      )}
      bodyFlex
      sheetStyle={styles.supplierFormSheet}
      contentContainerStyle={styles.supplierFormContent}
      perfTag="proveedores.form_proveedor"
      onClose={onClose}
      hideCloseButton
      headerSlot={(
        <View style={styles.supplierFormHeader}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.supplierFormHeaderIconWrap}
          >
            <Ionicons name={editingSupplier ? 'create-outline' : 'add'} size={30} color="#D1D5DB" />
          </LinearGradient>
          <Text style={styles.supplierFormHeaderTitle}>
            {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </Text>
          <Pressable style={[styles.supplierFormHeaderClose, saving && styles.buttonDisabled]} onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={34} color="#111827" />
          </Pressable>
        </View>
      )}
      footerStyle={styles.supplierFormFooter}
      footer={(
        <View style={styles.supplierFormFooterRow}>
          <Pressable
            style={[styles.supplierFormCancelButton, saving && styles.buttonDisabled]}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.supplierFormCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.supplierFormSaveButton, saving && styles.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#F5F3FF" /> : null}
            <Text style={styles.supplierFormSaveText}>
              {saving ? 'Guardando...' : (editingSupplier ? 'Actualizar' : 'Guardar')}
            </Text>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.supplierFormFields}>
        {error ? (
          <View style={styles.formErrorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.fieldGroup}>
          <Text style={styles.inputLabel}>Nombre de la Empresa *</Text>
          <TextInput
            value={form.business_name}
            onChangeText={(next) => onFormChange({ business_name: next })}
            style={styles.input}
          />
        </View>

        {formDetailsReady ? (
          <>
            <View style={styles.formRow}>
              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Persona de Contacto</Text>
                <TextInput
                  value={form.contact_name}
                  onChangeText={(next) => onFormChange({ contact_name: next })}
                  style={styles.input}
                />
              </View>

              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>NIT</Text>
                <TextInput
                  value={form.nit}
                  onChangeText={(next) => onFormChange({ nit: next })}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={form.email}
                  onChangeText={(next) => onFormChange({ email: next })}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <TextInput
                  value={form.phone}
                  onChangeText={(next) => onFormChange({ phone: next })}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Dirección</Text>
                <TextInput
                  value={form.address}
                  onChangeText={(next) => onFormChange({ address: next })}
                  style={styles.input}
                />
              </View>

              <View style={[styles.fieldGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Notas</Text>
                <TextInput
                  value={form.notes}
                  onChangeText={(next) => onFormChange({ notes: next })}
                  style={[styles.input, styles.textArea]}
                  multiline
                />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.formSectionLoader}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={styles.formSectionLoaderText}>Cargando campos adicionales...</Text>
          </View>
        )}
      </View>
    </StockyModal>
  );
}
