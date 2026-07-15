import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
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
              <Text style={s.employeeFormHeaderTitle}>{t('empleados.newEmployee')}</Text>
              <Text style={s.employeeFormHeaderSubtitle}>{t('empleados.formSubtitle')}</Text>
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
            <Text style={s.employeeFormCancelText}>{t('empleados.cancel')}</Text>
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
                {creating ? t('empleados.creatingEmployee') : t('empleados.createEmployee')}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      <View style={s.employeeFormFields}>
        <View style={s.fieldGroup}>
          <Text style={s.inputLabel}>{t('empleados.fields.fullName')}</Text>
          <TextInput
            value={form.full_name}
            onChangeText={(next) => onFormChange({ full_name: next })}
            placeholder={t('empleados.fields.fullNamePlaceholder')}
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={s.input}
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.inputLabel}>{t('empleados.fields.username')}</Text>
          <TextInput
            value={form.username}
            onChangeText={(next) =>
              onFormChange({ username: next.toLowerCase().replace(/\s+/g, '') })
            }
            placeholder={t('empleados.fields.usernamePlaceholder')}
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.helperText}>{t('empleados.fields.usernameHelper')}</Text>
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.inputLabel}>{t('empleados.fields.password')}</Text>
          <TextInput
            value={form.password}
            onChangeText={(next) => onFormChange({ password: next })}
            placeholder={t('empleados.fields.passwordPlaceholder')}
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.helperText}>{t('empleados.fields.passwordHelper')}</Text>
        </View>

        <View style={s.roleInfoCard}>
          <Text style={s.roleInfoText}>{t('empleados.roleAssigned')}</Text>
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
