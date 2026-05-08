import { useState, useEffect } from 'react';
import { getPaymentMethodLogoCandidates, isBankPaymentMethod } from '../utils/paymentMethodBranding.js';

const getPaymentMethodLabel = (method) => {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  if (method === 'nequi') return 'Nequi';
  if (method === 'bancolombia') return 'Bancolombia';
  if (method === 'banco_bogota') return 'Banco de Bogotá';
  if (method === 'nu') return 'Nu';
  if (method === 'davivienda') return 'Davivienda';
  return method || '-';
};

export function PaymentMethodBankLogo({ method, sizeClass = 'h-4', fallback = null }) {
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
      alt={`Logo ${getPaymentMethodLabel(normalizedMethod)}`}
      className={`${sizeClass} w-auto object-contain`}
      loading="lazy"
      onError={() => {
        setIndex((current) => (current + 1 < candidates.length ? current + 1 : -1));
      }}
    />
  );
}

export { getPaymentMethodLabel };
