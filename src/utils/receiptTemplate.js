import { formatDateTimeTicket, formatPrice } from './formatters.js';

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
  sellerName = 'Empleado',
  businessName = 'Sistema Stocky',
  footerMessage = 'Gracias por su compra',
  voluntaryTip = null,
}) => {
  const subtotal = Number(sale?.total || 0);
  const tipAmount = voluntaryTip?.enabled ? Number(voluntaryTip?.amount || 0) : 0;
  const total = subtotal + tipAmount;

  return {
    type: 'sale',
    version: 1,
    requiredSections: ['items', 'totals'],
    header: {
      title: 'COMPROBANTE DE VENTA',
      businessName: String(businessName || 'Sistema Stocky'),
      dateText: formatDateTimeTicket(sale?.created_at || new Date()),
      alignment: 'center',
    },
    metadata: [
      { label: 'Comprobante', value: `CPV-${String(sale?.id || '').substring(0, 8).toUpperCase()}` },
      { label: 'Vendedor', value: String(sellerName || 'Empleado') },
      { label: 'Cliente', value: 'Venta general' },
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
      message: String(footerMessage || 'Gracias por su compra'),
      alignment: 'center',
    },
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
