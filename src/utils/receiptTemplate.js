import { formatDateTimeTicket, formatPrice } from './formatters';

const getPaymentMethodLabel = (method) => {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  if (method === 'nequi') return 'Nequi';
  if (method === 'bancolombia') return 'Bancolombia';
  if (method === 'banco_bogota') return 'Banco de Bogota';
  if (method === 'nu') return 'Nu';
  if (method === 'davivienda') return 'Davivienda';
  if (method === 'daviplata') return 'Daviplata';
  if (method === 'spei') return 'SPEI';
  if (method === 'oxxo') return 'OXXO';
  if (method === 'yape') return 'Yape';
  if (method === 'plin') return 'Plin';
  if (method === 'mercadopago') return 'Mercado Pago';
  if (method === 'venmo') return 'Venmo';
  if (method === 'cashapp') return 'Cash App';
  if (method === 'zelle') return 'Zelle';
  return String(method || 'No especificado');
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
  labels,
}) => {
  const l = labels || {
    title: 'COMPROBANTE DE VENTA',
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
      dateText: formatDateTimeTicket(sale?.created_at || new Date()),
      alignment: 'center',
    },
    metadata: [
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
      methodText: getPaymentMethodLabel(sale?.payment_method),
    },
    footer: {
      message: String(footerMessage || l.footer),
      alignment: 'center',
    },
    itemsHeader: `${l.productHeader}       ${l.quantityAbbreviation}      ${l.total}`,
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
