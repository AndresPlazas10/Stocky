import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { getPaymentMethodTheme, isBankPaymentMethod } from '../utils/paymentMethods';
import { getBankLogoSource } from '../utils/paymentMethodBranding';
import { useBusinessConfig } from '../contexts/BusinessConfigContext';

type PaymentMethodValue = string;

type Props = {
  value: PaymentMethodValue;
  onChange: (method: PaymentMethodValue) => void;
  blockInteractions?: boolean;
  onBlockedInteraction?: () => void;
};

export function PaymentMethodSelector({
  value,
  onChange,
  blockInteractions,
  onBlockedInteraction,
}: Props) {
  const { t } = useTranslation();
  const config = useBusinessConfig();

  const options = useMemo(() => {
    const availableMethods = config.country.paymentMethods;
    return availableMethods.map((method) => ({
      value: method,
      label: t(`paymentMethods.${method}`),
    }));
  }, [config.country.paymentMethods, t]);

  return (
    <View style={styles.grid}>
      {options.map((option) => {
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
