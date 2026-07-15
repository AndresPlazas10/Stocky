import i18next from 'i18next';
import { buildSaleEscPos, type SaleReceipt } from '../services/escposService';
import { getSavedPrinter, connectPrintDisconnect } from '../services/bluetoothPrinterService';
import { getThermalPaperWidthMm, isAutoCutEnabled } from '../utils/printer';
import type { VentaDetailRecord, VentaRecord } from '../services/ventasService';
import { buildReceiptLabels, type ReceiptLabels } from '../utils/receiptLabels';

function buildReceiptForEscPos(opts: {
  sale: VentaRecord;
  saleDetails: VentaDetailRecord[];
  customerName?: string;
  businessName?: string;
  timezone?: string;
  labels: ReceiptLabels;
}): SaleReceipt {
  const { sale, saleDetails, customerName, businessName, labels } = opts;
  const items = Array.isArray(saleDetails) ? saleDetails : [];

  const fmtPrice = (v: number) => `$${v.toLocaleString('es-CO')}`;
  const fmtDate = (ts: string | Date) => {
    const d = new Date(ts);
    const tz = opts.timezone || 'America/Bogota';
    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    const getPart = (type: string) => dateParts.find(p => p.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const rawPeriod = getPart('dayPeriod').toLowerCase();
    const dayPeriod = rawPeriod.includes('a') ? 'a.m.' : 'p.m.';
    return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
  };
  const methodLabel = (m?: string | null) => {
    const key = String(m || '').trim().toLowerCase();
    const translated = i18next.t(`common:paymentMethods.${key}`, { defaultValue: '' });
    if (translated) return translated;

    const fallback: Record<string, string> = {
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
    return fallback[key] || m || labels.notSpecified;
  };

  return {
    type: 'sale',
    version: 1,
    header: {
      title: labels.title,
      businessName: String(businessName || labels.kitchenSystem),
      dateText: fmtDate(sale.created_at || new Date()),
      alignment: 'center',
    },
    metadata: [
      {
        label: labels.receiptNumber,
        value: `CPV-${String(sale.id).substring(0, 8).toUpperCase()}`,
      },
      { label: labels.seller, value: String(sale.seller_name || labels.sellerDefault) },
      { label: labels.customer, value: String(customerName || labels.customerDefault) },
    ],
    items: items.map((item) => {
      const qty = Number(item?.quantity || 0);
      const unit = Number(item?.unit_price || 0);
      const sub = Number(item?.subtotal || qty * unit || 0);
      return {
        name: item?.products?.name || item?.combos?.nombre || 'Item',
        quantity: qty,
        unitPrice: unit,
        subtotal: sub,
        subtotalText: fmtPrice(sub),
      };
    }),
    totals: {
      total: Number(sale.total || 0),
      totalText: fmtPrice(Number(sale.total || 0)),
    },
    payment: {
      method: String(sale.payment_method || 'cash'),
      methodText: methodLabel(sale.payment_method),
    },
    footer: {
      message: labels.footer,
      alignment: 'center',
    },
    itemsHeader: `${labels.productHeader}       ${labels.quantityAbbreviation}      ${labels.total}`,
    productHeader: labels.productHeader,
    quantityAbbreviation: labels.quantityAbbreviation,
    total: labels.total,
    tipLabel: labels.tip,
    totalLabel: labels.total,
    methodLabel: labels.method,
    notSpecified: labels.notSpecified,
  };
}

export async function printSaleReceipt(
  saleRecord: VentaRecord,
  saleDetails: VentaDetailRecord[],
  opts?: {
    customerName?: string;
    businessName?: string;
    timezone?: string;
    t?: (key: string, opts?: { defaultValue?: string }) => string;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!Array.isArray(saleDetails) || saleDetails.length === 0) {
    const labels = opts?.t ? buildReceiptLabels(opts.t) : null;
    return { ok: false, error: labels?.printError || 'La venta no tiene items para imprimir.' };
  }

  const labels = opts?.t
    ? buildReceiptLabels(opts.t)
    : buildReceiptLabels((key: string) => {
        const fallbacks: Record<string, string> = {
          'mesas:receipt.title': 'COMPROBANTE DE VENTA',
          'mesas:receipt.receiptNumber': 'Comprobante',
          'mesas:receipt.seller': 'Vendedor',
          'mesas:receipt.sellerDefault': 'Empleado',
          'mesas:receipt.customer': 'Cliente',
          'mesas:receipt.customerDefault': 'Venta general',
          'mesas:receipt.productHeader': 'Producto',
          'mesas:receipt.quantityAbbreviation': 'Cant.',
          'mesas:receipt.total': 'TOTAL',
          'mesas:receipt.tip': 'Propina',
          'mesas:receipt.method': 'Método',
          'mesas:receipt.notSpecified': 'No especificado',
          'mesas:receipt.footer': '¡Gracias por su compra!',
          'mesas:receipt.invalidDate': 'Fecha inválida',
          'mesas:receipt.kitchenTitle': 'ORDEN DE COCINA',
          'mesas:receipt.kitchenTable': 'Mesa #',
          'mesas:receipt.kitchenFooter': '*** ORDEN PARA COCINA ***',
          'mesas:receipt.kitchenSystem': 'Sistema Stocky',
          'mesas:receipt.statusOccupied': 'Ocupada',
          'mesas:receipt.statusAvailable': 'Disponible',
          'mesas:receipt.itemsLabel': 'Productos',
          'mesas:receipt.productsHeader': 'Productos',
          'mesas:receipt.quantityHeader': 'Cantidad',
          'mesas:receipt.printError': 'La venta no tiene items para imprimir.',
          'mesas:receipt.printerError':
            'No se pudo enviar a la impresora. Verifica la conexión Bluetooth.',
        };
        return fallbacks[key] || key;
      });

  const savedPrinter = await getSavedPrinter();
  if (!savedPrinter) {
    return {
      ok: false,
      error: 'No hay una impresora conectada. Ve a Configuración > Impresión para conectar una.',
    };
  }

  const receipt = buildReceiptForEscPos({
    sale: saleRecord,
    saleDetails,
    customerName: opts?.customerName,
    businessName: opts?.businessName,
    timezone: opts?.timezone,
    labels,
  });
  const paperWidthMm = await getThermalPaperWidthMm();
  const autoCut = await isAutoCutEnabled();
  const escposData = buildSaleEscPos(receipt, paperWidthMm, autoCut);
  const result = await connectPrintDisconnect(savedPrinter.address, escposData);
  if (result.ok) return { ok: true };
  return {
    ok: false,
    error: 'error' in result ? result.error : labels.printerError,
  };
}
