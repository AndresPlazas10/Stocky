import { motion } from 'framer-motion';
/**
 * Modal para dividir la cuenta de una mesa entre múltiples sub-cuentas.
 * Permite asignar cada UNIDAD de un producto a sub-cuentas distintas.
 * Ej: 3 hamburguesas → 1 a Cuenta A, 2 a Cuenta B.
 */

import { useState, useMemo, useCallback } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Plus, Trash2, CheckCircle2, CreditCard, DollarSign } from 'lucide-react';
import { formatPrice } from '../../utils/formatters.js';

const MAX_SUB_ACCOUNTS = 10;
const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

const PAYMENT_OPTIONS = [
  { value: 'cash', label: '💵 Efectivo', icon: DollarSign },
  { value: 'card', label: '💳 Tarjeta', icon: CreditCard },
  { value: 'transfer', label: '🏦 Transferencia', icon: CreditCard },
  { value: 'mixed', label: '🔄 Mixto', icon: DollarSign },
];

const parseCopAmount = (value) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;

  const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return NaN;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  const simpleParsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(simpleParsed)) return Math.round(simpleParsed);

  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return NaN;
  const digitsParsed = Number(digitsOnly);
  return Number.isFinite(digitsParsed) ? Math.round(digitsParsed) : NaN;
};

const calcularCambio = (total, pagado) => {
  const normalizedTotal = Math.round(Number(total) || 0);
  const normalizedPaid = parseCopAmount(pagado);

  if (normalizedTotal <= 0) return { isValid: false, change: 0, breakdown: [] };
  if (!Number.isFinite(normalizedPaid) || normalizedPaid < normalizedTotal) {
    return { isValid: false, change: 0, breakdown: [] };
  }

  let remaining = normalizedPaid - normalizedTotal;
  const breakdown = [];
  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return { isValid: true, change: normalizedPaid - normalizedTotal, breakdown, paid: normalizedPaid };
};

const getOrderItemName = (item) => (
  item?.products?.name
  || item?.combos?.nombre
  || item?.combos?.name
  || 'Item'
);

/**
 * itemAssignments: { itemId: { accountId: qty } }
 * Suma de qty por item debe ser igual a item.quantity
 */
function getInitialAssignments(orderItems, defaultAccountId = 1) {
  const initial = {};
  orderItems.forEach((item) => {
    const qty = Number(item.quantity) || 1;
    initial[item.id] = { [defaultAccountId]: qty };
  });
  return initial;
}

export default function SplitBillModal({ orderItems = [], onConfirm, onCancel }) {
  const [accounts, setAccounts] = useState([
    { id: 1, name: 'Cuenta 1', paymentMethod: 'cash', amountReceived: '' },
  ]);
  const _motionLintUsage = motion;
  const [itemAssignments, setItemAssignments] = useState(() =>
    getInitialAssignments(orderItems, 1)
  );

  const addAccount = () => {
    if (accounts.length >= MAX_SUB_ACCOUNTS) return;
    const nextId = Math.max(...accounts.map((a) => a.id), 0) + 1;
    setAccounts((prev) => [
      ...prev,
      { id: nextId, name: `Cuenta ${nextId}`, paymentMethod: 'cash', amountReceived: '' },
    ]);
  };

  const atAccountLimit = accounts.length >= MAX_SUB_ACCOUNTS;

  const removeAccount = (accountId) => {
    if (accounts.length <= 1) return;
    const remaining = accounts.filter((a) => a.id !== accountId);
    const reassignTo = remaining[0]?.id ?? 1;
    setAccounts(remaining);
    setItemAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((itemId) => {
        const byAccount = next[itemId] || {};
        const qtyToReassign = byAccount[accountId] || 0;
        delete byAccount[accountId];
        byAccount[reassignTo] = (byAccount[reassignTo] || 0) + qtyToReassign;
        next[itemId] = byAccount;
      });
      return next;
    });
  };

  const updateAccountPayment = (accountId, paymentMethod) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, paymentMethod } : a))
    );
  };

  const updateAccountAmountReceived = (accountId, amountReceived) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, amountReceived } : a))
    );
  };

  const setItemQuantityForAccount = (itemId, accountId, qty) => {
    const numQty = Math.max(0, Math.floor(Number(qty)) || 0);
    setItemAssignments((prev) => {
      const byAccount = { ...(prev[itemId] || {}) };
      byAccount[accountId] = numQty;
      return { ...prev, [itemId]: byAccount };
    });
  };

  const subAccounts = useMemo(() => {
    return accounts.map((acc) => {
      const items = [];
      orderItems.forEach((item) => {
        const byAccount = itemAssignments[item.id] || {};
        const qty = byAccount[acc.id] || 0;
        if (qty > 0) {
          const price = parseFloat(item.price) || 0;
          items.push({
            ...item,
            quantity: qty,
            subtotal: qty * price,
          });
        }
      });
      const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
      const normalizedTotal = Math.round(total);
      const cashInput = acc.amountReceived === '' ? String(normalizedTotal) : acc.amountReceived;
      const cashInfo = acc.paymentMethod === 'cash'
        ? calcularCambio(normalizedTotal, cashInput)
        : { isValid: true, change: 0, breakdown: [], paid: null };

      return {
        ...acc,
        items,
        total,
        amountReceivedResolved: acc.paymentMethod === 'cash' && cashInfo.isValid ? cashInfo.paid : null,
        changeAmount: acc.paymentMethod === 'cash' && cashInfo.isValid ? cashInfo.change : 0,
        changeBreakdown: acc.paymentMethod === 'cash' && cashInfo.isValid ? cashInfo.breakdown : [],
        cashInfo
      };
    });
  }, [accounts, orderItems, itemAssignments]);

  const getAssignedSum = useCallback((itemId) => {
    const byAccount = itemAssignments[itemId] || {};
    return Object.values(byAccount).reduce((s, q) => s + q, 0);
  }, [itemAssignments]);

  const validationErrors = useMemo(() => {
    const errors = [];
    orderItems.forEach((item) => {
      const total = Number(item.quantity) || 1;
      const assigned = getAssignedSum(item.id);
      if (assigned !== total) {
        errors.push({
          itemId: item.id,
          expected: total,
          assigned,
        });
      }
    });
    return errors;
  }, [orderItems, getAssignedSum]);

  const hasCashValidationErrors = subAccounts.some((sa) =>
    sa.paymentMethod === 'cash'
    && sa.items.length > 0
    && !sa.cashInfo?.isValid
  );

  const canConfirm =
    subAccounts.some((sa) => sa.items.length > 0)
    && validationErrors.length === 0
    && !hasCashValidationErrors;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const validSubAccounts = subAccounts.filter((sa) => sa.items.length > 0);
    onConfirm({
      subAccounts: validSubAccounts.map((sa) => ({
        name: sa.name,
        paymentMethod: sa.paymentMethod,
        items: sa.items,
        total: sa.total,
        amountReceived: sa.paymentMethod === 'cash' ? sa.amountReceivedResolved : null,
        changeBreakdown: sa.paymentMethod === 'cash' ? sa.changeBreakdown : [],
      })),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[65] p-4 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full my-6 sm:my-8 max-h-[92vh] overflow-hidden flex flex-col max-w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[85vw]"
      >
        <Card className="border-0 flex flex-col flex-1 min-h-0">
          <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50 shrink-0 px-6 sm:px-8 pt-6 pb-5">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl sm:text-2xl font-bold text-primary-900">
                  💳 Dividir cuenta
                </CardTitle>
                <p className="text-sm sm:text-base text-primary-600 mt-2 leading-relaxed">
                  Asigna cantidades a cada sub-cuenta. Si un producto tiene varias unidades, puedes repartirlas entre cuentas.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); onCancel(); }}
                className="h-11 w-11 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 overflow-y-auto flex-1">
            {/* Unified container: sub-accounts + product distribution */}
            <div className="rounded-2xl border-2 border-accent-200 bg-accent-50/20 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh] min-h-[200px]">
                <table className="w-full border-collapse">
                  {/* Header row: account columns align with product assignment columns */}
                  <thead>
                    <tr className="border-b-2 border-accent-200 bg-accent-50/50">
                      <th className="p-3 text-left text-sm font-semibold text-primary-700 min-w-[180px] max-w-[260px] align-top">
                        Producto
                      </th>
                      {subAccounts.map((acc) => (
                        <th
                          key={acc.id}
                          className="p-3 min-w-[90px] max-w-[140px] align-top"
                        >
                          <div className="flex flex-col gap-2 p-3 rounded-xl border-2 border-accent-200 bg-white">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-xs font-semibold text-primary-900 truncate"
                                aria-label={`Cuenta ${acc.id}`}
                              >
                                {acc.name}
                              </span>
                              {accounts.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeAccount(acc.id)}
                                  className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 shrink-0 -mr-1"
                                  aria-label="Eliminar cuenta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <select
                              value={acc.paymentMethod}
                              onChange={(e) => updateAccountPayment(acc.id, e.target.value)}
                              className="h-8 px-2 rounded-lg border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 text-xs font-medium w-full"
                            >
                              {PAYMENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <span className="text-sm font-bold text-primary-900">
                              {formatPrice(acc.total)}
                            </span>
                            {acc.paymentMethod === 'cash' && (
                              <>
                                <Input
                                  type="number"
                                  min={0}
                                  step={50}
                                  value={acc.amountReceived}
                                  onChange={(e) => updateAccountAmountReceived(acc.id, e.target.value)}
                                  placeholder="Recibido"
                                  className="h-8 w-full text-xs border-accent-300"
                                  aria-label={`Monto recibido ${acc.name}`}
                                />
                                {acc.items.length > 0 && (() => {
                                  const sa = subAccounts.find((s) => s.id === acc.id);
                                  if (!sa) return null;
                                  return (
                                    <span className={`text-[11px] font-semibold ${sa.cashInfo?.isValid ? 'text-green-700' : 'text-red-600'}`}>
                                      {sa.cashInfo?.isValid ? `Cambio: ${formatPrice(sa.changeAmount)}` : 'Pago insuficiente'}
                                    </span>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="p-3 align-top w-[100px]">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addAccount}
                          disabled={atAccountLimit}
                          className="border-2 border-dashed border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-50 disabled:cursor-not-allowed h-full min-h-[90px] w-full flex flex-col items-center justify-center gap-1"
                          title={atAccountLimit ? `Máximo ${MAX_SUB_ACCOUNTS} sub-cuentas` : 'Agregar cuenta'}
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-xs font-medium">Agregar</span>
                          <span className="text-[10px] text-primary-500">{accounts.length}/{MAX_SUB_ACCOUNTS}</span>
                        </Button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => {
                      const totalQty = Number(item.quantity) || 1;
                      const assignedSum = getAssignedSum(item.id);
                      const hasError = assignedSum !== totalQty;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-accent-200 last:border-b-0 ${
                            hasError ? 'bg-amber-50/50' : 'hover:bg-accent-50/30'
                          }`}
                        >
                          <td className="p-4 align-top border-r border-accent-200 min-w-[180px] max-w-[260px]">
                            <p className="font-semibold text-primary-900 text-sm break-words">
                              {getOrderItemName(item)}
                            </p>
                            <p className="text-xs text-accent-600 mt-0.5">
                              {totalQty} × {formatPrice(item.price)} = {formatPrice(item.subtotal)}
                            </p>
                            {hasError && (
                              <p className="text-xs text-amber-700 font-medium mt-2">
                                Suma: {assignedSum}/{totalQty}
                              </p>
                            )}
                          </td>
                          <>
                            {accounts.map((acc) => (
                              <td
                                key={acc.id}
                                className="p-3 align-top min-w-[72px] max-w-[100px]"
                              >
                                <Input
                                  type="number"
                                  min={0}
                                  max={totalQty}
                                  value={itemAssignments[item.id]?.[acc.id] ?? 0}
                                  onChange={(e) =>
                                    setItemQuantityForAccount(item.id, acc.id, e.target.value)
                                  }
                                  className="h-10 w-full min-w-0 text-center border-accent-300 text-sm font-semibold"
                                  aria-label={`Cantidad para ${acc.name}`}
                                />
                              </td>
                            ))}
                            <td className="p-0 w-[100px]" aria-hidden />
                          </>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>

          {/* Acciones */}
          <div className="border-t-2 border-accent-200 bg-accent-50/30 px-6 sm:px-8 py-5 sm:py-6 shrink-0 space-y-4">
            <div className="flex flex-row gap-4 sm:gap-6">
              <Button
                variant="outline"
                onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); onCancel(); }}
                className="flex-1 h-12 sm:h-14 text-base border-2 border-accent-300 text-accent-700 hover:bg-accent-50 min-h-[48px]"
              >
                Cancelar
              </Button>
              <Button
                onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); handleConfirm && handleConfirm(); }}
                disabled={!canConfirm}
                className="flex-1 h-12 sm:h-14 text-base gradient-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Confirmar ventas
              </Button>
            </div>
            {validationErrors.length > 0 && (
              <p className="text-sm text-amber-700 text-center font-medium">
                Corrige las cantidades: la suma por producto debe coincidir con el total.
              </p>
            )}
            {!canConfirm && validationErrors.length === 0 && (
              <p className="text-sm text-amber-700 text-center font-medium">
                {hasCashValidationErrors
                  ? 'Hay sub-cuentas en efectivo con pago insuficiente.'
                  : 'Asigna al menos un producto a alguna sub-cuenta.'}
              </p>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
