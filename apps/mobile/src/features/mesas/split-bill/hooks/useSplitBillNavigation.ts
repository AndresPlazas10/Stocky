import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MesaOrderItem } from '../../../../services/mesaOrderService';
import type { SplitSubAccount } from '../../../../services/mesaCheckoutService';

interface UseSplitBillNavigationParams {
  accountsCount: number;
  submitting: boolean;
  canConfirm: boolean;
  subAccounts: {
    id: number;
    items: SplitSubAccount['items'];
    total: number;
    paymentMethod: string;
    cashInfo: {
      isValid: boolean;
      paid: number | null;
      change: number;
      breakdown: { denomination: number; count: number }[];
    };
  }[];
  onBack: () => void;
  onConfirm: (payload: { subAccounts: SplitSubAccount[] }) => void;
}

export function useSplitBillNavigation({
  accountsCount,
  submitting,
  canConfirm,
  subAccounts,
  onBack,
  onConfirm,
}: UseSplitBillNavigationParams) {
  const { t } = useTranslation('mesas');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);

  useEffect(() => {
    setCurrentStep(1); // eslint-disable-line react-hooks/set-state-in-effect -- reset de navegación al cambiar cuentas
    setCurrentAccountIndex(0); // eslint-disable-line react-hooks/set-state-in-effect -- reset de navegación al cambiar cuentas
    setIsPaymentMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- reset de navegación al cambiar cuentas
  }, [accountsCount]);

  useEffect(() => {
    setCurrentAccountIndex((prev) => Math.min(prev, Math.max(0, accountsCount - 1))); // eslint-disable-line react-hooks/set-state-in-effect -- clamp de índice al cambiar cuentas
  }, [accountsCount]);

  useEffect(() => {
    setIsPaymentMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- cerrar menú al cambiar paso/cuenta
  }, [currentStep, currentAccountIndex]);

  const currentAccount = useMemo(
    () => subAccounts[currentAccountIndex] || subAccounts[0] || null,
    [currentAccountIndex, subAccounts],
  );

  const isLastAccountStep = currentAccountIndex >= accountsCount - 1;
  const isCurrentCashInvalid = Boolean(
    currentAccount &&
    currentAccount.paymentMethod === 'cash' &&
    currentAccount.items.length > 0 &&
    !currentAccount.cashInfo.isValid,
  );
  const hasCurrentAccountItems = (currentAccount?.items.length || 0) > 0;

  const handleConfirm = () => {
    if (!canConfirm || submitting) return;

    const validSubAccounts = subAccounts
      .filter((sub) => sub.items.length > 0)
      .map((sub) => ({
        name: sub.id.toString(),
        paymentMethod: sub.paymentMethod as any,
        items: sub.items,
        total: sub.total,
        amountReceived: sub.paymentMethod === 'cash' ? sub.cashInfo.paid : null,
        changeBreakdown: sub.paymentMethod === 'cash' ? sub.cashInfo.breakdown : [],
      }));

    onConfirm({ subAccounts: validSubAccounts });
  };

  const handlePrimaryAction = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
      setCurrentAccountIndex(0);
      return;
    }

    if (!currentAccount || isCurrentCashInvalid || !hasCurrentAccountItems || submitting) return;

    if (!isLastAccountStep) {
      setCurrentAccountIndex((prev) => Math.min(prev + 1, accountsCount - 1));
      return;
    }

    handleConfirm();
  };

  const handleSecondaryAction = () => {
    if (currentStep === 1) {
      onBack();
      return;
    }

    if (currentAccountIndex > 0) {
      setCurrentAccountIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    setCurrentStep(1);
  };

  const primaryButtonLabel =
    currentStep === 1
      ? t('buttons.startSplit')
      : isLastAccountStep
        ? submitting
          ? t('buttons.processing')
          : t('buttons.finishSale')
        : t('buttons.nextAccount');
  const secondaryButtonLabel = currentStep === 1 ? t('buttons.back') : t('buttons.backShort');
  const isPrimaryDisabled =
    currentStep === 1
      ? false
      : submitting ||
        !currentAccount ||
        isCurrentCashInvalid ||
        !hasCurrentAccountItems ||
        (isLastAccountStep && !canConfirm);

  return {
    currentStep,
    currentAccountIndex,
    currentAccount,
    isLastAccountStep,
    isPaymentMenuOpen,
    setIsPaymentMenuOpen,
    primaryButtonLabel,
    secondaryButtonLabel,
    isPrimaryDisabled,
    handlePrimaryAction,
    handleSecondaryAction,
  };
}
