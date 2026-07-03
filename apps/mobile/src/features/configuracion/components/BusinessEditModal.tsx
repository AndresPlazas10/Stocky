import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import type { BusinessFormState } from '../configuracionUtils';
import { configuracionStyles as styles } from '../configuracionStyles';

interface BusinessEditModalProps {
  visible: boolean;
  saving: boolean;
  businessNameLabel: string;
  businessEmailLabel: string;
  form: BusinessFormState;
  onFormChange: (updates: Partial<BusinessFormState>) => void;
  onClose: () => void;
  onSave: () => void;
}

export function BusinessEditModal({
  visible,
  saving,
  businessNameLabel,
  businessEmailLabel,
  form,
  onFormChange,
  onClose,
  onSave,
}: BusinessEditModalProps) {
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      bodyFlex
      sheetStyle={styles.businessEditSheet}
      onClose={onClose}
      hideCloseButton
      headerSlot={
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.businessEditHeader}
        >
          <View style={styles.businessEditHeaderLeft}>
            <View style={styles.businessEditHeaderIconWrap}>
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.businessEditHeaderTextWrap}>
              <Text style={styles.businessEditHeaderTitle}>Editar Negocio</Text>
              <Text style={styles.businessEditHeaderSubtitle}>
                Actualiza NIT, teléfono y dirección
              </Text>
            </View>
          </View>
          <Pressable style={styles.businessEditHeaderClose} onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color="#E5E7EB" />
          </Pressable>
        </LinearGradient>
      }
      footerStyle={styles.businessEditFooter}
      footer={
        <View style={styles.businessEditFooterRow}>
          <Pressable
            style={[styles.businessEditCancelButton, saving && styles.disabled]}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.businessEditCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.businessEditSaveWrap, saving && styles.disabled]}
            onPress={onSave}
            disabled={saving}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.businessEditSaveButton}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="save-outline" size={17} color="#FFFFFF" />
              )}
              <Text style={styles.businessEditSaveText}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      <View style={styles.businessEditFields}>
        <View style={styles.businessEditField}>
          <Text style={styles.businessEditLabel}>Nombre del Negocio (solo lectura)</Text>
          <View style={styles.businessEditReadOnlyBox}>
            <Text style={styles.businessEditReadOnlyText}>{businessNameLabel}</Text>
          </View>
        </View>

        <View style={styles.businessEditField}>
          <Text style={styles.businessEditLabel}>Email (solo lectura)</Text>
          <View style={styles.businessEditReadOnlyBox}>
            <Text style={styles.businessEditReadOnlyText}>{businessEmailLabel}</Text>
          </View>
        </View>

        <View style={styles.businessEditField}>
          <Text style={styles.businessEditLabel}>NIT</Text>
          <TextInput
            value={form.nit}
            onChangeText={(next) => onFormChange({ nit: next })}
            style={styles.businessEditInput}
            placeholder="900.123.456-7"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.businessEditField}>
          <Text style={styles.businessEditLabel}>Teléfono</Text>
          <TextInput
            value={form.phone}
            onChangeText={(next) => onFormChange({ phone: next })}
            style={styles.businessEditInput}
            placeholder="+57 300 123 4567"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.businessEditField}>
          <Text style={styles.businessEditLabel}>Dirección</Text>
          <TextInput
            value={form.address}
            onChangeText={(next) => onFormChange({ address: next })}
            style={[styles.businessEditInput, styles.businessEditTextArea]}
            placeholder="Calle 123 #45-67, Ciudad"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            multiline
          />
        </View>
      </View>
    </StockyModal>
  );
}
