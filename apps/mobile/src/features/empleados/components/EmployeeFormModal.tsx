import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StockyModal } from '../../../ui/StockyModal';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { empleadosStyles as s } from '../empleadosStyles';
import { type EmployeeFormState } from '../empleadosUtils';

interface EmployeeFormModalProps {
  visible: boolean;
  form: EmployeeFormState;
  creating: boolean;
  error: string | null;
  onFormChange: (updates: Partial<EmployeeFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function EmployeeFormModal({
  visible,
  form,
  creating,
  error,
  onFormChange,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) {
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      modalAnimationType="fade"
      bodyFlex
      sheetStyle={s.employeeFormSheet}
      onClose={() => {
        if (creating) return;
        onClose();
      }}
      hideCloseButton
      headerSlot={
        <LinearGradient
          colors={['#EEF2FF', '#F5F3FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.employeeFormHeader}
        >
          <View style={s.employeeFormHeaderLeft}>
            <View style={s.employeeFormHeaderIconWrap}>
              <Ionicons name="person-add-outline" size={20} color="#4F46E5" />
            </View>
            <View style={s.employeeFormHeaderTitleWrap}>
              <Text style={s.employeeFormHeaderTitle}>Nuevo Empleado</Text>
              <Text style={s.employeeFormHeaderSubtitle}>Crea un acceso para tu equipo</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              if (creating) return;
              onClose();
            }}
            style={s.employeeFormHeaderClose}
            disabled={creating}
          >
            <Ionicons name="close-circle-outline" size={22} color="#6B7280" />
          </Pressable>
        </LinearGradient>
      }
      footerStyle={s.employeeFormFooter}
      footer={
        <View style={s.employeeFormFooterRow}>
          <Pressable
            style={[s.employeeFormCancelButton, creating && s.buttonDisabled]}
            onPress={onClose}
            disabled={creating}
          >
            <Text style={s.employeeFormCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[s.employeeFormSaveWrap, creating && s.buttonDisabled]}
            onPress={onSubmit}
            disabled={creating}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.employeeFormSaveButton}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="person-add-outline" size={17} color="#FFFFFF" />
              )}
              <Text style={s.employeeFormSaveText}>
                {creating ? 'Creando empleado...' : 'Crear Empleado'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      <View style={s.employeeFormFields}>
        <View style={s.fieldGroup}>
          <Text style={s.inputLabel}>Nombre Completo *</Text>
          <TextInput
            value={form.full_name}
            onChangeText={(next) => onFormChange({ full_name: next })}
            placeholder="Ej: Juan Perez"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={s.input}
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.inputLabel}>Usuario *</Text>
          <TextInput
            value={form.username}
            onChangeText={(next) =>
              onFormChange({ username: next.toLowerCase().replace(/\s+/g, '') })
            }
            placeholder="juan_perez"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.helperText}>Solo letras minusculas, numeros y guion bajo.</Text>
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.inputLabel}>Contraseña *</Text>
          <TextInput
            value={form.password}
            onChangeText={(next) => onFormChange({ password: next })}
            placeholder="Minimo 6 caracteres"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.helperText}>Esta será la contraseña para iniciar sesión.</Text>
        </View>

        <View style={s.roleInfoCard}>
          <Text style={s.roleInfoText}>Rol asignado: Empleado</Text>
        </View>

        {error ? (
          <Text style={{ color: STOCKY_COLORS.errorText, fontSize: 12, fontWeight: '600' }}>
            {error}
          </Text>
        ) : null}
      </View>
    </StockyModal>
  );
}
