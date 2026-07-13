import { useCallback } from 'react';
import { useBusinessConfig } from '../contexts/BusinessConfigContext';

export function useFormatPrice() {
  const { locale, currency, currencySymbol, decimals } = useBusinessConfig();

  const formatPrice = useCallback(
    (value: number | null | undefined, includeCurrency = true): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return includeCurrency ? `${currencySymbol}0` : '0';
      }

      try {
        return new Intl.NumberFormat(locale, {
          style: includeCurrency ? 'currency' : 'decimal',
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      } catch {
        return `${currencySymbol}${value.toFixed(decimals)}`;
      }
    },
    [locale, currency, currencySymbol, decimals],
  );

  return { formatPrice };
}
