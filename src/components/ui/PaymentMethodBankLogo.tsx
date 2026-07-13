import { useState, useEffect } from 'react';
import { getPaymentMethodLogoCandidates, isBankPaymentMethod, getPaymentMethodLabel as getPaymentMethodLabelBase } from '../../utils/paymentMethodBranding';

const getPaymentMethodLabel = (method: string, t?: (key: string) => string) => {
  return getPaymentMethodLabelBase(method, t);
};

interface PaymentMethodBankLogoProps {
  method: string;
  sizeClass?: string;
  fallback?: React.ReactNode | null;
  t?: (key: string) => string;
}

export function PaymentMethodBankLogo({ method, sizeClass = 'h-4', fallback = null, t }: PaymentMethodBankLogoProps) {
  const [index, setIndex] = useState(0);
  const normalizedMethod = String(method || '').trim().toLowerCase();
  const candidates = getPaymentMethodLogoCandidates(normalizedMethod);

  useEffect(() => {
    setIndex(0);
  }, [normalizedMethod]);

  if (!isBankPaymentMethod(normalizedMethod)) {
    return fallback || <span className="text-sm">🏦</span>;
  }

  if (!Array.isArray(candidates) || candidates.length === 0 || index < 0) {
    return fallback || <span className="text-sm">🏦</span>;
  }

  return (
    <img
      src={candidates[index]}
      alt={`Logo ${getPaymentMethodLabel(normalizedMethod, t)}`}
      className={`${sizeClass} w-auto object-contain`}
      loading="lazy"
      onError={() => {
        setIndex((current) => (current + 1 < candidates.length ? current + 1 : -1));
      }}
    />
  );
}

export { getPaymentMethodLabel };
