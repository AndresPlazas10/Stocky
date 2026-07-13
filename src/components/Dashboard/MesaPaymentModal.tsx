import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import PaymentMethodSelect from '../ui/PaymentMethodSelect.jsx';
import { formatPrice } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { useTranslation } from 'react-i18next';
import type { MesaPaymentModalProps } from '@/types/components';

export function MesaPaymentModal({
  isOpen,
  orderTotal,
  cambioPago,
  paymentMethod,
  onPaymentMethodChange,
  selectedCustomer,
  onCustomerChange,
  clientes,
  amountReceived,
  onAmountReceivedChange,
  amountReceivedError,
  setAmountReceivedError,
  insufficientItems,
  insufficientComboComponents,
  hasInsufficientComboStock,
  isCashPaymentInvalid,
  isClosingOrder,
  onCancel,
  onConfirm,
  calcularCambio,
}: MesaPaymentModalProps) {
  const { t } = useTranslation(['mesas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-3 sm:p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full my-2 sm:my-4"
          >
            <Card className="border-0">
              <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                <CardTitle className="text-xl sm:text-2xl font-bold text-primary-900">
                  💳 {t('mesas:labels.confirmPayment')}
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1 bg-accent-50 rounded-2xl border-2 border-accent-200 p-4 sm:p-5">
                    <p className="text-xs uppercase tracking-wide text-primary-600 mb-1">{t('mesas:labels.totalToPay')}</p>
                    <h3 className="text-3xl sm:text-4xl font-bold text-primary-900">
                      {fmtPrice(orderTotal)}
                    </h3>
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-primary-600">{t('mesas:labels.change')}</span>
                        <span className={`font-bold ${paymentMethod === 'cash' && cambioPago?.isValid ? 'text-green-700' : 'text-primary-900'}`}>
                          {paymentMethod === 'cash' && cambioPago?.isValid ? fmtPrice(cambioPago.change) : fmtPrice(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1 space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                        {t('mesas:labels.paymentMethod')}
                      </label>
                      <PaymentMethodSelect
                        value={paymentMethod}
                        onChange={(nextMethod: string) => {
                          onPaymentMethodChange(nextMethod);
                          if (nextMethod !== 'cash') {
                            setAmountReceivedError('');
                          }
                        }}
                        allowedMethods={config.country.paymentMethods}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                        {t('form.customerOptional', { ns: 'common' })}
                      </label>
                      <select
                        value={selectedCustomer}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCustomerChange(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                      >
                        <option value="">{t('form.generalSale', { ns: 'common' })}</option>
                        {clientes.map(cliente => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.full_name} - {cliente.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                        {t('mesas:labels.amountReceived')}
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="50"
                        value={amountReceived}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const nextValue = e.target.value;
                          onAmountReceivedChange(nextValue);

                          if (paymentMethod !== 'cash') {
                            setAmountReceivedError('');
                            return;
                          }

                          if (nextValue === '') {
                            setAmountReceivedError(t('mesas:errors.amountRequired'));
                            return;
                          }

                          const validation = calcularCambio(orderTotal, nextValue, config.currency);
                          if (!validation.isValid) {
                            if (validation.reason === 'insufficient') {
                              setAmountReceivedError(t('mesas:labels.insufficientAmount'));
                              return;
                            }
                            setAmountReceivedError(t('mesas:errors.invalidAmount'));
                            return;
                          }

                          setAmountReceivedError('');
                        }}
                        className={`h-11 border-2 ${amountReceivedError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-accent-300 focus:border-primary-500 focus:ring-primary-200'} transition-all`}
                        placeholder={config.currency === 'COP' ? 'Ej: 100000' : config.currency === 'USD' ? 'Eg: 100.00' : `Eg: 100 ${config.currency}`}
                      />
                      {amountReceivedError && paymentMethod === 'cash' && (
                        <p className="mt-1.5 text-xs text-red-600">{amountReceivedError}</p>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-1 rounded-xl border border-accent-200 bg-white p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-primary-600">{t('labels.breakdown', { ns: 'common' })}</p>
                    {paymentMethod === 'cash' && cambioPago?.isValid && cambioPago.change > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
                        {cambioPago.breakdown.map(({ denomination, count }) => (
                          <p key={denomination} className="text-sm text-primary-700">
                            {count} x {fmtPrice(denomination)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-primary-600">{t('mesas:labels.noChange')}</p>
                    )}
                  </div>
                </div>

                {insufficientItems.length > 0 && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">{t('errors.insufficientStock', { ns: 'common' })} ({insufficientItems.length})</p>
                        <p className="text-xs text-red-700">{t('mesas:errors.fixBeforeClose')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {insufficientItems.map(it => (
                        <div key={it.id || `${it.product_id}-${it.quantity}`} className="text-xs text-red-700">
                          <strong className="text-primary-900">{it.product_name}</strong>
                          <div>{t('labels.available', { ns: 'common' })}: {it.available_stock} / {t('labels.quantity', { ns: 'common' })}: {it.quantity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insufficientComboComponents.length > 0 && (
                  <div className="p-3 rounded-lg border border-red-300 bg-red-50 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-700" />
                      <div>
                        <p className="text-sm font-semibold text-red-900">{t('mesas:errors.insufficientComboStock')} ({insufficientComboComponents.length})</p>
                        <p className="text-xs text-red-800">{t('mesas:errors.fixComboBeforeClose')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {insufficientComboComponents.map((item) => (
                        <div key={item.product_id} className="text-xs text-red-800">
                          <strong className="text-primary-900">{item.product_name}</strong>
                          <div>{t('labels.available', { ns: 'common' })}: {item.available_stock} / {t('form.required', { ns: 'common' })}: {item.required_quantity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isClosingOrder}
                    className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-50"
                  >
                    {t('buttons.cancel', { ns: 'common' })}
                  </Button>
                  <Button
                    onClick={onConfirm}
                    disabled={
                      isClosingOrder
                      || insufficientItems.length > 0
                      || hasInsufficientComboStock
                      || (paymentMethod === 'cash' && (amountReceived === '' || isCashPaymentInvalid))
                    }
                    className="flex-1 h-12 gradient-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClosingOrder ? (
                      <>
                        <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('status.processing', { ns: 'common' })}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        {t('mesas:labels.confirmPayment')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
