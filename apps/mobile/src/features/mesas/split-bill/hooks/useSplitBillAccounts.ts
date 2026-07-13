import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MesaOrderItem } from '../../../../services/mesaOrderService';
import { useBusinessConfig } from '../../../../contexts/BusinessConfigContext';
import {
  createInitialAccount,
  createSubAccounts,
  getInitialAssignments,
  MAX_SUB_ACCOUNTS,
  type AccountState,
  type ItemAssignments,
} from '../splitBillUtils';

interface UseSplitBillAccountsParams {
  visible: boolean;
  orderItems: MesaOrderItem[];
}

export function useSplitBillAccounts({ visible, orderItems }: UseSplitBillAccountsParams) {
  const { t } = useTranslation('mesas');
  const config = useBusinessConfig();
  const [accounts, setAccounts] = useState<AccountState[]>([createInitialAccount()]);
  const [itemAssignments, setItemAssignments] = useState<ItemAssignments>(
    getInitialAssignments(orderItems),
  );

  useEffect(() => {
    if (!visible) return;
    setAccounts([createInitialAccount()]); // eslint-disable-line react-hooks/set-state-in-effect -- reset al abrir split bill
    setItemAssignments(getInitialAssignments(orderItems)); // eslint-disable-line react-hooks/set-state-in-effect -- reset al abrir split bill
  }, [visible, orderItems]);

  const addAccount = () => {
    if (accounts.length >= MAX_SUB_ACCOUNTS) return;
    const nextId = Math.max(...accounts.map((account) => account.id), 0) + 1;
    setAccounts((prev) => [
      ...prev,
      {
        ...createInitialAccount(),
        id: nextId,
        name: `${t('splitBill.accountName', { number: nextId, defaultValue: `Cuenta ${nextId}` })}`,
      },
    ]);
  };

  const removeAccount = (accountId: number) => {
    if (accounts.length <= 1) return;
    const remaining = accounts.filter((account) => account.id !== accountId);
    const reassignTo = remaining[0]?.id ?? 1;
    setAccounts(remaining);

    setItemAssignments((prev) => {
      const next: ItemAssignments = { ...prev };
      Object.keys(next).forEach((itemId) => {
        const byAccount = { ...(next[itemId] || {}) };
        const qtyToReassign = Number(byAccount[accountId] || 0);
        delete byAccount[accountId];
        byAccount[reassignTo] = Number(byAccount[reassignTo] || 0) + qtyToReassign;
        next[itemId] = byAccount;
      });
      return next;
    });
  };

  const updateAccountPaymentMethod = (
    accountId: number,
    paymentMethod: AccountState['paymentMethod'],
  ) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, paymentMethod } : acc)),
    );
  };

  const getItemExpectedQuantity = (itemId: string) => {
    const sourceItem = orderItems.find((row) => row.id === itemId);
    return Math.max(0, Math.floor(Number(sourceItem?.quantity || 0)));
  };

  const adjustItemQuantityForAccount = (itemId: string, accountId: number, delta: number) => {
    setItemAssignments((prev) => {
      const byAccount = { ...(prev[itemId] || {}) };
      const currentQty = Math.max(0, Math.floor(Number(byAccount[accountId] || 0)));
      const expected = getItemExpectedQuantity(itemId);
      const assignedOtherAccounts = Object.entries(byAccount).reduce((sum, [key, value]) => {
        if (Number(key) === accountId) return sum;
        return sum + Math.max(0, Math.floor(Number(value || 0)));
      }, 0);
      const maxAllowedForAccount = Math.max(0, expected - assignedOtherAccounts);
      const nextQty = Math.max(0, Math.min(currentQty + delta, maxAllowedForAccount));

      if (nextQty <= 0) {
        delete byAccount[accountId];
      } else {
        byAccount[accountId] = nextQty;
      }

      return { ...prev, [itemId]: byAccount };
    });
  };

  const subAccounts = useMemo(() => {
    return createSubAccounts(accounts, orderItems, itemAssignments, config.country.code);
  }, [accounts, itemAssignments, orderItems, config.country.code]);

  const validationErrors = useMemo(() => {
    return orderItems
      .map((item) => {
        const expected = Number(item.quantity || 0);
        const assigned = Object.values(itemAssignments[item.id] || {}).reduce(
          (sum, value) => sum + Number(value || 0),
          0,
        );
        if (assigned !== expected) {
          return { itemId: item.id, expected, assigned };
        }
        return null;
      })
      .filter(Boolean) as { itemId: string; expected: number; assigned: number }[];
  }, [itemAssignments, orderItems]);

  const hasCashValidationErrors = useMemo(() => {
    return subAccounts.some(
      (sub) => sub.paymentMethod === 'cash' && sub.items.length > 0 && !sub.cashInfo.isValid,
    );
  }, [subAccounts]);

  const canConfirm = useMemo(() => {
    return (
      subAccounts.some((sub) => sub.items.length > 0) &&
      validationErrors.length === 0 &&
      !hasCashValidationErrors
    );
  }, [subAccounts, validationErrors.length, hasCashValidationErrors]);

  return {
    accounts,
    itemAssignments,
    subAccounts,
    validationErrors,
    canConfirm,
    addAccount,
    removeAccount,
    updateAccountPaymentMethod,
    adjustItemQuantityForAccount,
    getItemExpectedQuantity,
  };
}
