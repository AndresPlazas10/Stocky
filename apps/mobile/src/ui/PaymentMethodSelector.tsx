import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPaymentMethodTheme, isBankPaymentMethod } from '../utils/paymentMethods';
import { getBankLogoSource } from '../utils/paymentMethodBranding';

type PaymentMethodValue = string;

type Props = {
  value: PaymentMethodValue;
  onChange: (method: PaymentMethodValue) => void;
  blockInteractions?: boolean;
  onBlockedInteraction?: () => void;
};

const OPTIONS: { value: PaymentMethodValue; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mixed', label: 'Mixto' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'banco_bogota', label: 'Banco de Bogotá' },
  { value: 'nu', label: 'Nu' },
  { value: 'davivienda', label: 'Davivienda' },
];

export function PaymentMethodSelector({
  value,
  onChange,
  blockInteractions,
  onBlockedInteraction,
}: Props) {
  return (
    <View style={styles.grid}>
      {OPTIONS.map((option) => {
        const selected = String(value || '').toLowerCase() === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => {
              if (blockInteractions) {
                onBlockedInteraction?.();
                return;
              }
              onChange(option.value);
            }}
          >
            <View style={styles.content}>
              {isBankPaymentMethod(option.value) ? (
                <Image
                  source={getBankLogoSource(option.value)!}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name={getPaymentMethodTheme(option.value).icon}
                  size={14}
                  color={selected ? '#1D4ED8' : '#475569'}
                />
              )}
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    flexBasis: '30%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  content: {
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    width: 32,
    height: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  labelSelected: {
    color: '#1D4ED8',
  },
});
