import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Search, Plus, AlertCircle, User, CreditCard, DollarSign, CheckCircle2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import PaymentMethodSelect from '@/components/ui/PaymentMethodSelect';
import { SALE_ITEM_TYPE } from './ventasConstants';

interface SaleCreateModalProps {
  isOpen: boolean;
  cart: any[];
  total: number;
  searchProduct: string;
  saleModalPanel: string;
  selectedCustomer: string;
  paymentMethod: string;
  isSubmitting: boolean;
  comboStockShortages: any[];
  simpleStockShortages: any[];
  totalFilteredCatalog: number;
  visibleFilteredCatalog: any[];
  hasMoreFilteredCatalog: boolean;
  filteredCatalogSentinelRef: React.RefObject<HTMLDivElement | null>;
  loadMoreFilteredCatalog: () => void;
  visibleCartItems: any[];
  hasMoreCartItems: boolean;
  totalCartItems: number;
  cartSentinelRef: React.RefObject<HTMLDivElement | null>;
  loadMoreCartItems: () => void;
  addToCart: (item: any) => void;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, qty: number) => void;
  fmtPrice: (val: any, includeCurrency?: boolean) => string;
  t: (key: string, options?: any) => string;
  country: any;
  customers: any[];
  onClose: () => void;
  onSearchChange: (v: string) => void;
  onSetSaleModalPanel: (v: string) => void;
  onSelectedCustomerChange: (v: string) => void;
  onPaymentMethodChange: (v: string) => void;
  onProcessSale: () => void;
}

export function SaleCreateModal({
  isOpen,
  cart,
  total,
  searchProduct,
  saleModalPanel,
  selectedCustomer,
  paymentMethod,
  isSubmitting,
  comboStockShortages,
  simpleStockShortages,
  totalFilteredCatalog,
  visibleFilteredCatalog,
  hasMoreFilteredCatalog,
  filteredCatalogSentinelRef,
  loadMoreFilteredCatalog,
  visibleCartItems,
  hasMoreCartItems,
  totalCartItems,
  cartSentinelRef,
  loadMoreCartItems,
  addToCart,
  removeFromCart,
  updateQuantity,
  fmtPrice,
  t,
  country,
  customers,
  onClose,
  onSearchChange,
  onSetSaleModalPanel,
  onSelectedCustomerChange,
  onPaymentMethodChange,
  onProcessSale,
}: SaleCreateModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[1260px] max-h-[95vh] overflow-hidden rounded-3xl border border-accent-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gradient-primary p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-white">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold leading-tight">{t('buttons.newSale')}</h2>
                  <p className="text-xs sm:text-sm text-white/80">{t('labels.products')}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/15 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="xl:hidden border-b border-accent-100 bg-white px-3 py-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onSetSaleModalPanel('catalog')}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${saleModalPanel === 'catalog' ? 'gradient-primary text-white shadow-sm' : 'bg-accent-50 text-accent-600'}`}>
                  {t('ventas:labels.products')}
                </button>
                <button type="button" onClick={() => onSetSaleModalPanel('cart')}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${saleModalPanel === 'cart' ? 'gradient-primary text-white shadow-sm' : 'bg-accent-50 text-accent-600'}`}>
                  {t('ventas:labels.cartTab')} ({cart.length})
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-5 xl:p-6 overflow-y-auto max-h-[calc(95vh-136px)] xl:max-h-[calc(95vh-88px)]">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card className={`rounded-2xl border border-accent-200 bg-white shadow-sm ${saleModalPanel === 'cart' ? 'hidden xl:block' : ''}`}>
                  <CardHeader className="pb-4 border-b border-accent-100">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl text-accent-600">{t('ventas:labels.productsAndCombos')}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{t('ventas:labels.exploreAndAdd')}</p>
                      </div>
                      <Badge className="w-fit bg-accent-100 text-accent-700 border border-accent-200">{totalFilteredCatalog} resultados</Badge>
                    </div>
                    <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input type="text" className="pl-9 h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD]"
                        placeholder={t('labels.searchProduct')} value={searchProduct} onChange={(e) => onSearchChange(e.target.value)} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5">
                    {totalFilteredCatalog === 0 ? (
                      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">{t('ventas:labels.noItemsAvailable')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 xl:max-h-[56vh] xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        {visibleFilteredCatalog.map((catalogItem) => (
                          <motion.button key={`${catalogItem.item_type}:${catalogItem.item_id}`} type="button"
                            whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => addToCart(catalogItem)}
                            className="text-left rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-3.5 transition hover:border-primary-300 hover:shadow-md">
                            <div className="min-w-0">
                              <p className="font-bold text-accent-600 text-base truncate" title={catalogItem.name}>{catalogItem.name}</p>
                              <p className="text-xs text-gray-500 mt-1 truncate" title={catalogItem.code}>{t('ventas:labels.code')} {catalogItem.code || 'N/A'}</p>
                              {catalogItem.item_type === SALE_ITEM_TYPE.COMBO ? (
                                <Badge className="mt-2 bg-gray-100 text-gray-800 border border-gray-200">{t('ventas:labels.combo')} ({catalogItem.combo_items?.length || 0} {t('ventas:labels.productsSuffix')})</Badge>
                              ) : catalogItem.manage_stock === false ? (
                                <Badge className="mt-2 bg-slate-100 text-slate-700 border border-slate-200">{t('ventas:labels.noStockControl')}</Badge>
                              ) : (
                                <Badge className={`mt-2 border ${catalogItem.stock > 10 ? 'bg-green-100 text-green-800 border-green-200' : catalogItem.stock > 0 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                  {t('ventas:labels.stock')} {catalogItem.stock}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                              <p className="text-lg font-bold text-secondary-600">{fmtPrice(catalogItem.sale_price)}</p>
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-100 text-accent-700"><Plus className="w-4 h-4" /></span>
                            </div>
                          </motion.button>
                        ))}
                        {hasMoreFilteredCatalog && (
                          <div className="sm:col-span-2 2xl:col-span-3 mt-1 flex flex-col items-center gap-2">
                            <p className="text-xs text-gray-500">{t('ventas:labels.showing')} {visibleFilteredCatalog.length} {t('ventas:labels.of')} {totalFilteredCatalog}</p>
                            <div ref={filteredCatalogSentinelRef} className="h-2 w-full" aria-hidden="true" />
                            <Button type="button" onClick={loadMoreFilteredCatalog} variant="outline" className="w-full sm:w-auto rounded-xl">{t('ventas:labels.loadMoreCatalog')}</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={`rounded-2xl border border-accent-200 bg-white shadow-sm ${saleModalPanel === 'catalog' ? 'hidden xl:block' : ''} xl:sticky xl:top-0 xl:h-fit`}>
                  <CardHeader className="pb-4 border-b border-accent-100">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-xl text-accent-600">{t('labels.cart')}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{cart.length} {t('labels.items')}</p>
                      </div>
                      <Badge className="bg-accent-50 text-accent-700 border border-accent-200">{fmtPrice(total)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5">
                    <div className="space-y-4 mb-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><User className="w-4 h-4" />{t('ventas:labels.customer')} ({t('ventas:labels.optional')})</label>
                        <select value={selectedCustomer} onChange={(e) => onSelectedCustomerChange(e.target.value)}
                          className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#66A5AD] focus:ring-[#66A5AD] transition-all duration-300">
                          <option value="">{t('form.generalSale', { ns: 'common' })}</option>
                          {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4" />{t('labels.paymentMethod')}</label>
                        <PaymentMethodSelect value={paymentMethod} onChange={onPaymentMethodChange} allowedMethods={country?.paymentMethods} className="w-full" />
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">{t('ventas:labels.itemsInCart')}</p>
                      <div className="space-y-2 xl:max-h-[30vh] xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        {cart.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                            <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="font-medium">{t('labels.noItems')}</p>
                            <p className="text-sm mt-1">{t('labels.selectProducts')}</p>
                          </div>
                        ) : (
                          visibleCartItems.map((item) => (
                            <motion.div key={item.item_key} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.2 }}>
                              <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 rounded-xl shadow-none">
                                <div className="p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-accent-600 truncate">{item.name}</p>
                                      <p className="text-xs text-gray-500 truncate">{item.code}</p>
                                      {item.item_type === SALE_ITEM_TYPE.COMBO && <Badge className="mt-1 bg-gray-100 text-gray-700 border border-gray-200">Combo</Badge>}
                                    </div>
                                    <Button type="button" onClick={() => removeFromCart(item.item_key)}
                                      className="h-7 w-7 p-0 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg border-none"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1 w-fit">
                                      <button type="button" onClick={() => updateQuantity(item.item_key, item.quantity - 1)}
                                        className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors">-</button>
                                      <input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.item_key, parseInt(e.target.value, 10) || 0)}
                                        min="1" className="w-12 text-center border-none focus:outline-none focus:ring-0 font-bold text-accent-600 bg-transparent" />
                                      <button type="button" onClick={() => updateQuantity(item.item_key, item.quantity + 1)}
                                        className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors">+</button>
                                    </div>
                                    <p className="text-lg font-bold text-secondary-600">{fmtPrice(item.subtotal)}</p>
                                  </div>
                                </div>
                              </Card>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>

                    {comboStockShortages.length > 0 && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-600" /><p className="text-sm font-semibold text-red-800">{t('ventas:labels.insufficientComboStock')}</p></div>
                        <div className="space-y-1 text-xs text-red-700">{comboStockShortages.map((item) => <p key={item.product_id}>{item.product_name}: {t('ventas:labels.available')} {item.available_stock} / {t('ventas:labels.required')} {item.required_quantity}</p>)}</div>
                      </div>
                    )}
                    {simpleStockShortages.length > 0 && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-600" /><p className="text-sm font-semibold text-red-800">{t('ventas:labels.insufficientProductStock')}</p></div>
                        <div className="space-y-1 text-xs text-red-700">{simpleStockShortages.map((item) => <p key={`simple-shortage-${item.product_id}`}>{item.product_name}: {t('ventas:labels.available')} {item.available_stock} / {t('ventas:labels.required')} {item.required_quantity}</p>)}</div>
                      </div>
                    )}

                    <Card className="gradient-primary text-white shadow-md rounded-xl border-none mb-3">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2"><DollarSign className="w-5 h-5" /><span className="text-sm sm:text-base font-semibold">{t('ventas:labels.totalLabel')}</span></div>
                        <span className="text-2xl sm:text-3xl font-bold">{fmtPrice(total)}</span>
                      </div>
                    </Card>

                    <Button onClick={onProcessSale}
                      disabled={cart.length === 0 || isSubmitting || comboStockShortages.length > 0 || simpleStockShortages.length > 0}
                      className="w-full h-11 sm:h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {isSubmitting ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>{t('ventas:labels.processing')}</>) : (<><CheckCircle2 className="w-5 h-5" />{t('ventas:buttons.completeSale')}</>)}
                    </Button>
                    {(hasMoreCartItems || cart.length > (visibleCartItems?.length || 0)) && (
                      <div className="mt-3 flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-500">{t('ventas:labels.showing')} {visibleCartItems.length} {t('ventas:labels.of')} {totalCartItems}</p>
                        <div ref={cartSentinelRef} className="h-2 w-full" aria-hidden="true" />
                        <Button type="button" onClick={loadMoreCartItems} variant="outline" className="w-full rounded-xl">{t('ventas:labels.loadMoreCart')}</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
