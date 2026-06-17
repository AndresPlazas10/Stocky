import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';

interface CloseOrderChoiceModalProps {
  visible: boolean;
  orderTotal: number;
  isClosingOrder: boolean;
  releasingEmptyOrder: boolean;
  onClose: () => void;
  onPayAllTogether: () => void;
  onSplitBill: () => void;
}

export function CloseOrderChoiceModal({
  visible,
  orderTotal,
  isClosingOrder,
  releasingEmptyOrder,
  onClose,
  onPayAllTogether,
  onSplitBill,
}: CloseOrderChoiceModalProps) {
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={8}
      modalAnimationType="fade"
      sheetStyle={styles.sheet}
      headerSlot={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="card-outline" size={24} color="#111827" />
            <Text style={styles.title}>¿Cómo cerrar la orden?</Text>
          </View>
          <Text style={styles.totalText}>
            Total: <StockyMoneyText value={orderTotal} style={styles.totalText} />
          </Text>
        </View>
      }
      contentContainerStyle={styles.content}
      onClose={() => {
        if (isClosingOrder || releasingEmptyOrder) return;
        onClose();
      }}
    >
      <Pressable
        style={[styles.primaryButton, (isClosingOrder || releasingEmptyOrder) && styles.disabled]}
        onPress={onPayAllTogether}
        disabled={isClosingOrder || releasingEmptyOrder}
      >
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryGradient}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#C4B5FD" />
          <Text style={styles.primaryText}>Pagar todo junto</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, (isClosingOrder || releasingEmptyOrder) && styles.disabled]}
        onPress={onSplitBill}
        disabled={isClosingOrder || releasingEmptyOrder}
      >
        <Ionicons name="layers-outline" size={23} color="#111827" />
        <Text style={styles.secondaryText}>Dividir cuenta</Text>
      </Pressable>

      <Pressable
        style={styles.cancelButton}
        onPress={onClose}
        disabled={isClosingOrder || releasingEmptyOrder}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: 26,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  disabled: {
    opacity: 0.7,
  },
});
