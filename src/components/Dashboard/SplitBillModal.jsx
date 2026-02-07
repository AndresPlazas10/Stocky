/**
 * Modal para dividir la cuenta de una mesa entre múltiples sub-cuentas.
 * Cada ítem se asigna a una sola sub-cuenta. Cada sub-cuenta tiene su propio
 * método de pago (efectivo, tarjeta, transferencia, mixto).
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Plus, Trash2, CheckCircle2, CreditCard, DollarSign } from 'lucide-react';
import { formatPrice } from '../../utils/formatters.js';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: '💵 Efectivo', icon: DollarSign },
  { value: 'card', label: '💳 Tarjeta', icon: CreditCard },
  { value: 'transfer', label: '🏦 Transferencia', icon: CreditCard },
  { value: 'mixed', label: '🔄 Mixto', icon: DollarSign },
];

/**
 * @param {Object} props
 * @param {Array} props.orderItems - Items de la orden (order_items con products)
 * @param {Function} props.onConfirm - onConfirm({ subAccounts: [{ name, paymentMethod, items, total }] })
 * @param {Function} props.onCancel
 * @param {Function} props.onPayAll - Pagar todo junto (flujo original)
 */
export default function SplitBillModal({ orderItems = [], onConfirm, onCancel, onPayAll }) {
  const [accounts, setAccounts] = useState([
    { id: 1, name: 'Cuenta 1', paymentMethod: 'cash' },
  ]);
  const [itemAssignments, setItemAssignments] = useState(() => {
    const initial = {};
    orderItems.forEach((item) => {
      initial[item.id] = 1;
    });
    return initial;
  });

  const addAccount = () => {
    const nextId = Math.max(...accounts.map((a) => a.id), 0) + 1;
    setAccounts((prev) => [
      ...prev,
      { id: nextId, name: `Cuenta ${nextId}`, paymentMethod: 'cash' },
    ]);
  };

  const removeAccount = (accountId) => {
    if (accounts.length <= 1) return;
    const remaining = accounts.filter((a) => a.id !== accountId);
    const reassignTo = remaining[0]?.id ?? 1;
    setAccounts(remaining);
    setItemAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((itemId) => {
        if (next[itemId] === accountId) next[itemId] = reassignTo;
      });
      return next;
    });
  };

  const updateAccountName = (accountId, name) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, name: name || a.name } : a))
    );
  };

  const updateAccountPayment = (accountId, paymentMethod) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, paymentMethod } : a))
    );
  };

  const assignItemToAccount = (itemId, accountId) => {
    setItemAssignments((prev) => ({ ...prev, [itemId]: accountId }));
  };

  const subAccounts = useMemo(() => {
    return accounts.map((acc) => {
      const items = orderItems.filter((item) => itemAssignments[item.id] === acc.id);
      const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
      return {
        ...acc,
        items,
        total,
      };
    }, [accounts, orderItems, itemAssignments]);
  }, [accounts, orderItems, itemAssignments]);

  const canConfirm = subAccounts.some((sa) => sa.items.length > 0);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const validSubAccounts = subAccounts.filter((sa) => sa.items.length > 0);
    onConfirm({
      subAccounts: validSubAccounts.map((sa) => ({
        name: sa.name,
        paymentMethod: sa.paymentMethod,
        items: sa.items,
        total: sa.total,
      })),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[65] p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-hidden flex flex-col"
      >
        <Card className="border-0 flex flex-col flex-1 min-h-0">
          <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50 shrink-0">
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl font-bold text-primary-900">
                💳 Dividir cuenta
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-10 w-10 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-sm text-primary-600 mt-1">
              Asigna cada producto a una sub-cuenta. Cada sub-cuenta se puede pagar por separado.
            </p>
          </CardHeader>

          <CardContent className="pt-6 overflow-y-auto flex-1 space-y-6">
            {/* Sub-cuentas */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-primary-700">Sub-cuentas</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAccount}
                  className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-9"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar cuenta
                </Button>
              </div>

              <div className="space-y-3">
                {subAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-4 rounded-2xl border-2 border-accent-200 bg-accent-50/30 space-y-3"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <Input
                        value={acc.name}
                        onChange={(e) => updateAccountName(acc.id, e.target.value)}
                        className="h-10 w-36 border-accent-300 font-semibold"
                        placeholder="Nombre cuenta"
                      />
                      <select
                        value={acc.paymentMethod}
                        onChange={(e) => updateAccountPayment(acc.id, e.target.value)}
                        className="h-10 px-4 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 text-sm font-medium"
                      >
                        {PAYMENT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-lg font-bold text-primary-900">
                        {formatPrice(acc.total)}
                      </span>
                      {accounts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAccount(acc.id)}
                          className="h-9 px-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {acc.items.length > 0 && (
                      <div className="text-xs text-primary-600">
                        {acc.items.length} producto(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Items a asignar */}
            <div>
              <h3 className="text-sm font-semibold text-primary-700 mb-3">Asignar productos</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-accent-200 bg-white hover:bg-accent-50/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary-900 truncate">
                        {item.products?.name || 'Producto'}
                      </p>
                      <p className="text-sm text-accent-600">
                        {item.quantity} × {formatPrice(item.price)} = {formatPrice(item.subtotal)}
                      </p>
                    </div>
                    <select
                      value={itemAssignments[item.id] ?? 1}
                      onChange={(e) => assignItemToAccount(item.id, Number(e.target.value))}
                      className="h-9 px-3 rounded-lg border-2 border-accent-300 focus:border-primary-500 text-sm font-medium shrink-0"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>

          {/* Acciones */}
          <div className="border-t-2 border-accent-200 bg-accent-50/30 p-4 shrink-0 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={onPayAll}
                className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
              >
                Pagar todo junto
              </Button>
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 h-12 gradient-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Confirmar ventas
              </Button>
            </div>
            {!canConfirm && (
              <p className="text-xs text-amber-700 text-center">
                Asigna al menos un producto a alguna sub-cuenta.
              </p>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
