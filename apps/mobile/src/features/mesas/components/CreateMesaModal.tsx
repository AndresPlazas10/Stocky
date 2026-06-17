import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { STOCKY_COLORS } from '../../../theme/tokens';

interface CreateMesaModalProps {
  visible: boolean;
  isCreatingMesa: boolean;
  newTableNumber: string;
  mesaPreviewName: string;
  isKeyboardVisible: boolean;
  onChangeNumber: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateMesaModal({
  visible,
  isCreatingMesa,
  newTableNumber,
  mesaPreviewName,
  isKeyboardVisible,
  onChangeNumber,
  onSubmit,
  onCancel,
}: CreateMesaModalProps) {
  return (
    <StockyModal
      visible={visible}
      title="Agregar Mesa"
      backdropVariant="blur"
      layout="centered"
      centeredOffsetY={106}
      modalAnimationType="fade"
      onClose={() => {
        if (!isCreatingMesa) onCancel();
      }}
      footer={
        <View style={styles.footerRow}>
          <Pressable style={styles.cancelButton} onPress={onCancel} disabled={isCreatingMesa}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (isKeyboardVisible) {
                Keyboard.dismiss();
                return;
              }
              onSubmit();
            }}
            disabled={isCreatingMesa}
            style={styles.primaryWrap}
          >
            <LinearGradient
              colors={isCreatingMesa ? ['#7D8AA7', '#9CA3AF'] : ['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.primaryButton, isCreatingMesa && styles.disabled]}
            >
              <Ionicons name="add" size={16} color={STOCKY_COLORS.white} />
              <Text style={styles.primaryText}>{isCreatingMesa ? 'Creando...' : 'Agregar'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Ionicons name="layers-outline" size={24} color={STOCKY_COLORS.white} />
          </LinearGradient>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Nueva mesa</Text>
          </View>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewIcon}>
            <Ionicons name="layers-outline" size={30} color="#00A63E" />
          </View>
          <Text style={styles.previewTitle}>{mesaPreviewName}</Text>
          <View style={styles.previewStatus}>
            <View style={styles.previewDot} />
            <Text style={styles.previewStatusText}>Disponible</Text>
          </View>
        </View>

        <Text style={styles.label}>Identificador</Text>
      </View>
      <View style={styles.inputShell}>
        <Ionicons name="pricetag-outline" size={18} color="#64748B" />
        <TextInput
          value={newTableNumber}
          onChangeText={onChangeNumber}
          placeholder="Identificador de mesa"
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={styles.inputField}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  primaryWrap: {
    flex: 1,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: STOCKY_COLORS.white,
  },
  disabled: {
    opacity: 0.7,
  },
  body: {
    marginBottom: 14,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  previewCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  previewIcon: {
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
  },
  previewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  previewStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    gap: 10,
  },
  inputField: {
    flex: 1,
    minHeight: 48,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
