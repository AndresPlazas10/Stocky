import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, User, Mail, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSaleDetailDisplayName } from './ventasHelpers';

interface InvoiceModalProps {
  isOpen: boolean;
  selectedSale: any;
  invoiceCustomerName: string;
  invoiceCustomerEmail: string;
  invoiceCustomerIdNumber: string;
  generatingInvoice: boolean;
  fmtPrice: (value: any, includeCurrency?: boolean) => string;
  fmtDateOnly: (timestamp: any) => string;
  t: (key: string, options?: any) => string;
  onClose: () => void;
  onCustomerNameChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onCustomerIdNumberChange: (v: string) => void;
  onSend: () => void;
}

export function InvoiceModal({
  isOpen,
  selectedSale,
  invoiceCustomerName,
  invoiceCustomerEmail,
  invoiceCustomerIdNumber,
  generatingInvoice,
  fmtPrice,
  fmtDateOnly,
  t,
  onClose,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerIdNumberChange,
  onSend,
}: InvoiceModalProps) {
  return (
    <AnimatePresence>
      {isOpen && selectedSale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <Card className="bg-white shadow-2xl rounded-2xl border-none">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-6 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{t('ventas:email.title')}</h2>
                    <p className="text-gray-100 mt-1">
                      {t('ventas:email.description', { date: selectedSale?.created_at ? fmtDateOnly(selectedSale.created_at) : t('ventas:labels.dateNotAvailable'), total: fmtPrice(selectedSale.total) })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t('ventas:email.customerName')} *
                  </label>
                  <Input
                    type="text"
                    value={invoiceCustomerName}
                    onChange={(e) => onCustomerNameChange(e.target.value)}
                    placeholder={t('ventas:email.customerNamePlaceholder')}
                    required
                    className="h-11 rounded-xl border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('ventas:email.customerEmail')} *
                  </label>
                  <Input
                    type="email"
                    value={invoiceCustomerEmail}
                    onChange={(e) => onCustomerEmailChange(e.target.value)}
                    placeholder={t('ventas:email.emailPlaceholder')}
                    required
                    className="h-11 rounded-xl border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('ventas:email.emailHelp')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('ventas:email.nitOptional')}
                  </label>
                  <Input
                    type="text"
                    value={invoiceCustomerIdNumber}
                    onChange={(e) => onCustomerIdNumberChange(e.target.value)}
                    placeholder="123456789-0"
                    className="h-11 rounded-xl border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>

                {selectedSale.sale_details && selectedSale.sale_details.length > 0 && (
                  <div className="mt-6">
                    <p className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      {t('ventas:email.products')}
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                            <th className="px-4 py-3 text-center font-semibold text-gray-700">Cant.</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Precio</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSale.sale_details.map((detail: any, index: number) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-800">{getSaleDetailDisplayName(detail, t)}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{detail.quantity}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{fmtPrice(detail.unit_price)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                {fmtPrice(detail.quantity * detail.unit_price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 shadow-md rounded-xl mt-6">
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-800 mb-2">{t('ventas:email.summary')}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">{t('ventas:labels.totalLabel')}</span>
                      <span className="text-2xl font-bold text-gray-900">{fmtPrice(selectedSale.total)}</span>
                    </div>
                  </div>
                </Card>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={onClose}
                    disabled={generatingInvoice}
                    className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                  >
                    {t('buttons.cancel', { ns: 'common' })}
                  </Button>
                  <Button
                    onClick={onSend}
                    disabled={generatingInvoice || !invoiceCustomerName || !invoiceCustomerEmail}
                    className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generatingInvoice ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        {t('ventas:email.sending')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {t('ventas:email.sendReceipt')}
                      </>
                    )}
                  </Button>
                </div>
                
                <p className="text-gray-500 text-xs text-center mt-4 italic">
                  {t('ventas:email.disclaimer')}
                </p>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
