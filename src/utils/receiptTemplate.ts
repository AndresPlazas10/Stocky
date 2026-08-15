import { formatTicketDateNumeric } from './receiptLayout';

const DEFAULT_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mixed: 'Mixto',
  nequi: 'Nequi',
  bancolombia: 'Bancolombia',
  banco_bogota: 'Banco de Bogota',
  nu: 'Nu',
  davivienda: 'Davivienda',
  daviplata: 'Daviplata',
  spei: 'SPEI',
  oxxo: 'OXXO',
  yape: 'Yape',
  plin: 'Plin',
  mercadopago: 'Mercado Pago',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  zelle: 'Zelle',
};

export interface ReceiptTemplateLabels {
  title?: string;
  receiptNumber?: string;
  seller?: string;
  sellerDefault?: string;
  customer?: string;
  customerDefault?: string;
  productHeader?: string;
  quantityAbbreviation?: string;
  total?: string;
  tip?: string;
  method?: string;
  notSpecified?: string;
  footer?: string;
  invalidDate?: string;
  paymentMethodLabels?: Record<string, string>;
}

const getPaymentMethodLabel = (method: string | null | undefined, labels?: Record<string, string>): string => {
  const key = String(method || '').trim().toLowerCase();
  const fromLabels = labels?.[key];
  if (fromLabels) return fromLabels;
  return DEFAULT_PAYMENT_METHOD_LABELS[key] || String(method || 'No especificado');
};

const getSaleDetailDisplayName = (detail) => (
  detail?.products?.name
  || detail?.combos?.nombre
  || detail?.combos?.name
  || detail?.product_name
  || 'Item'
);

export const buildSaleReceiptTemplate = ({
  sale,
  saleDetails = [],
  sellerName,
  businessName,
  footerMessage,
  voluntaryTip = null,
  customerName,
  timezone = 'America/Bogota',
  labels = {} as ReceiptTemplateLabels,
}) => {
  const l = {
    title: 'COMPROBANTE',
    receiptNumber: 'Comprobante',
    seller: 'Vendedor',
    sellerDefault: 'Empleado',
    customer: 'Cliente',
    customerDefault: 'Venta general',
    productHeader: 'Producto',
    quantityAbbreviation: 'Cant.',
    total: 'TOTAL',
    tip: 'Propina',
    method: 'Método',
    notSpecified: 'No especificado',
    footer: '¡Gracias por su compra!',
    kitchenSystem: 'Sistema Stocky',
    invalidDate: 'Fecha inválida',
    ...labels,
  };

  const subtotal = Number(sale?.total || 0);
  const tipAmount = voluntaryTip?.enabled ? Number(voluntaryTip?.amount || 0) : 0;
  const total = subtotal + tipAmount;

  return {
    type: 'sale',
    version: 1,
    requiredSections: ['items', 'totals'],
    header: {
      title: l.title,
      businessName: String(businessName || l.kitchenSystem),
      dateText: formatTicketDateNumeric(sale?.created_at || new Date(), timezone),
      alignment: 'center',
    },
    metadata: [
      { label: l.receiptNumber, value: `CPV-${String(sale?.id || '').substring(0, 8).toUpperCase()}` },
      { label: l.seller, value: String(sellerName || l.sellerDefault) },
      { label: l.customer, value: String(customerName || l.customerDefault) },
    ],
    items: saleDetails.map((item) => {
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.unit_price || 0);
      const lineTotal = Number(item?.subtotal ?? (quantity * unitPrice));

      return {
        name: getSaleDetailDisplayName(item),
        quantity,
        unitPrice,
        subtotal: lineTotal,
        subtotalText: formatPrice(lineTotal),
      };
    }),
    totals: {
      subtotal,
      subtotalText: formatPrice(subtotal),
      voluntaryTip: tipAmount,
      voluntaryTipText: formatPrice(tipAmount),
      total,
      totalText: formatPrice(total),
    },
    payment: {
      method: sale?.payment_method || '',
      methodText: getPaymentMethodLabel(sale?.payment_method, labels.paymentMethodLabels),
    },
    footer: {
      message: String(footerMessage || l.footer),
      alignment: 'center',
    },
    itemsHeader: `${l.productHeader}       ${l.quantityAbbreviation}      ${l.total}`,
    productHeader: l.productHeader,
    quantityAbbreviation: l.quantityAbbreviation,
    total: l.total,
    tipLabel: l.tip,
    totalLabel: l.total,
    methodLabel: l.method,
    notSpecified: l.notSpecified,
  };
};

export const validateSaleReceiptTemplate = (receipt) => {
  if (!receipt || receipt.type !== 'sale') {
    return { ok: false, error: 'Recibo de venta invalido.' };
  }

  if (!Array.isArray(receipt.items) || receipt.items.length === 0) {
    return { ok: false, error: 'El recibo no tiene items obligatorios.' };
  }

  if (!receipt.totals || !Number.isFinite(Number(receipt.totals.total))) {
    return { ok: false, error: 'El recibo no tiene total obligatorio.' };
  }

  return { ok: true };
};

export function formatPrice(value: number | null | undefined, includeCurrency = true): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return includeCurrency ? '$0' : '0';
  }

  const numValue = Number(value);
  const [integerPart, decimalPart] = numValue.toFixed(2).split('.');

  let formattedInteger = integerPart;
  if (integerPart.length > 6) {
    const millions = integerPart.slice(0, -6);
    const remainder = integerPart.slice(-6);
    const formattedMillions = millions.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const formattedRemainder = remainder.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    formattedInteger = `${formattedMillions}'${formattedRemainder}`;
  } else {
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  let formattedNumber = formattedInteger;
  if (decimalPart !== '00') {
    formattedNumber = `${formattedInteger},${decimalPart}`;
  }

  return includeCurrency ? `$${formattedNumber}` : formattedNumber;
}
