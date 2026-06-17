import { useEffect, useState } from 'react';
import type { PaymentMethod } from '../../../utils/paymentMethods';

export function useVentaPayment(cartTotal: number) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [isAmountReceivedManual, setIsAmountReceivedManual] = useState(false);

  useEffect(() => {
    if (paymentMethod !== 'cash') return;
    if (isAmountReceivedManual) return;
    if (cartTotal <= 0) {
      if (amountReceived !== '') setAmountReceived(''); // eslint-disable-line react-hooks/set-state-in-effect -- sincronización de monto recibido con total
      return;
    }
    const suggested = `${Math.round(Number(cartTotal || 0))}`;
    if (amountReceived !== suggested) {
      setAmountReceived(suggested); // eslint-disable-line react-hooks/set-state-in-effect -- sincronización de monto recibido con total
    }
  }, [amountReceived, cartTotal, isAmountReceivedManual, paymentMethod]);

  const handleAmountReceivedChange = (value: string) => {
    setIsAmountReceivedManual(true);
    setAmountReceived(value);
  };

  const resetPayment = () => {
    setPaymentMethod('cash');
    setAmountReceived('');
    setIsAmountReceivedManual(false);
  };

  return {
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived: handleAmountReceivedChange,
    resetPayment,
  };
}
