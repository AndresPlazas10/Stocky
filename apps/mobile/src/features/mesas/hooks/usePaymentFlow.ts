import { useCallback } from 'react';

type UsePaymentFlowParams = {
  isClosingOrder: boolean;
  releasingEmptyOrder: boolean;
  orderTotal: number;
  amountReceived: string;
  setShowCloseOrderChoiceModal: (v: boolean) => void;
  setShowPaymentModal: (v: boolean) => void;
  setShowPaymentMethodMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSplitBillModal: (v: boolean) => void;
  setShowOrderModal: (v: boolean) => void;
  setPaymentMethod: (m: 'cash' | 'card' | 'transfer') => void;
  setAmountReceived: (v: string) => void;
};

export function usePaymentFlow({
  isClosingOrder,
  releasingEmptyOrder,
  orderTotal,
  amountReceived,
  setShowCloseOrderChoiceModal,
  setShowPaymentModal,
  setShowPaymentMethodMenu,
  setShowSplitBillModal,
  setShowOrderModal,
  setPaymentMethod,
  setAmountReceived,
}: UsePaymentFlowParams) {
  const handleSplitBill = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowPaymentMethodMenu(false);
    setShowSplitBillModal(true);
  }, [
    setShowCloseOrderChoiceModal,
    setShowPaymentMethodMenu,
    setShowPaymentModal,
    setShowSplitBillModal,
  ]);

  const handleCloseCloseOrderChoice = useCallback(() => {
    if (isClosingOrder || releasingEmptyOrder) return;
    setShowCloseOrderChoiceModal(false);
    setShowOrderModal(true);
  }, [isClosingOrder, releasingEmptyOrder, setShowCloseOrderChoiceModal, setShowOrderModal]);

  const handleClosePayment = useCallback(() => {
    if (!isClosingOrder) {
      setShowPaymentMethodMenu(false);
      setShowPaymentModal(false);
      setShowCloseOrderChoiceModal(true);
    }
  }, [isClosingOrder, setShowPaymentMethodMenu, setShowPaymentModal, setShowCloseOrderChoiceModal]);

  const handleTogglePaymentMenu = useCallback(() => {
    setShowPaymentMethodMenu((prev) => !prev);
  }, [setShowPaymentMethodMenu]);

  const handlePaymentMethodChange = useCallback(
    (method: string) => {
      setPaymentMethod(method as 'cash' | 'card' | 'transfer');
      if (method === 'cash' && String(amountReceived || '').trim() === '') {
        setAmountReceived(String(Math.round(orderTotal || 0)));
      }
    },
    [amountReceived, orderTotal, setAmountReceived, setPaymentMethod],
  );

  const handleBackFromSplitBill = useCallback(() => {
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(true);
  }, [setShowSplitBillModal, setShowCloseOrderChoiceModal]);

  const handleCloseSplitBill = useCallback(() => {
    if (isClosingOrder) return;
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(false);
    setShowOrderModal(true);
  }, [isClosingOrder, setShowSplitBillModal, setShowCloseOrderChoiceModal, setShowOrderModal]);

  return {
    handleSplitBill,
    handleCloseCloseOrderChoice,
    handleClosePayment,
    handleTogglePaymentMenu,
    handlePaymentMethodChange,
    handleBackFromSplitBill,
    handleCloseSplitBill,
  };
}
