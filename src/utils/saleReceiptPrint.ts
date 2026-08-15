import { getThermalPaperWidthMm } from './printer.js';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate, type ReceiptTemplateLabels } from './receiptTemplate.js';
import {
  buildTicketHtml,
  formatTicketDateNumeric,
  fullSeparator,
  getReceiptColumns,
  itemLines,
  TICKET_MAX_PAGE_HEIGHT_MM,
  thinSeparator,
  threeColumnLine,
  twoColumnLines,
  type TicketLine,
} from './receiptLayout.js';
import { logger } from '@/utils/logger';

export const STOCKY_URL = 'www.stockypos.app';

export type SaleReceiptPrintResult =
  | { ok: false; error: string }
  | { ok: true };

export async function printSaleReceipt({
  sale,
  saleDetails = [],
  sellerName = 'Empleado',
  businessName = 'Sistema Stocky',
  footerMessage = 'Gracias por su compra',
  voluntaryTip = null,
  customerName = 'Venta general',
  timezone = 'America/Bogota',
  labels = {} as Partial<ReceiptTemplateLabels>,
  paymentMethodLabels = undefined as Record<string, string> | undefined,
}): Promise<SaleReceiptPrintResult> {
  if (!sale?.id) {
    return { ok: false, error: 'No se pudo imprimir: venta sin id.' };
  }
  if (!Array.isArray(saleDetails) || saleDetails.length === 0) {
    return { ok: false, error: 'No se pudo imprimir: la venta no tiene items.' };
  }

  const printerWidthMm = getThermalPaperWidthMm();
  const receipt = buildSaleReceiptTemplate({
    sale, saleDetails, sellerName, businessName, footerMessage, voluntaryTip, customerName,
    timezone,
    labels: { ...labels, paymentMethodLabels },
  });
  const validation = validateSaleReceiptTemplate(receipt);
  if (!validation.ok) {
    return { ok: false, error: validation.error || 'Recibo de venta invalido.' };
  }

  const html = buildSaleReceiptHtml(receipt, printerWidthMm);

  return new Promise((resolve) => {
    const win = window.open('', '_blank');
    if (!win) {
      resolve({ ok: false, error: 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.' });
      return;
    }

    win.document.write(html);
    win.document.close();
    win.focus();

    win.print();

    const done = () => resolve({ ok: true });
    const timer = setInterval(() => {
      if (win.closed) { clearInterval(timer); done(); }
    }, 500);
    setTimeout(() => {
      clearInterval(timer);
      if (!win.closed) try { win.close(); } catch (_e) { logger.warn('utils:saleReceiptPrint:winClose failed', _e); }
      done();
    }, 120000);
  });
}

export function buildSaleReceiptHtml(receipt: any, printerWidthMm: number, pageHeightMm?: number): string {
  const columns = getReceiptColumns(printerWidthMm);
  const lines: TicketLine[] = [];
  const spacer = (n: number = 1) => { for (let i = 0; i < n; i += 1) lines.push({ text: '' }); };

  spacer(1);
  lines.push({ text: receipt.header.title, align: 'center', bold: true, double: true });
  spacer(1);
  lines.push({ text: receipt.header.businessName, align: 'center' });
  spacer(1);
  lines.push({ text: receipt.header.dateText, align: 'center' });
  spacer(2);
  lines.push({ text: fullSeparator(columns) });
  spacer(2);

  (receipt.metadata || []).forEach((row: { label: string; value: string }) => {
    twoColumnLines(`${row.label}:`, row.value, columns).forEach((line) => lines.push({ text: line }));
    spacer(1);
  });

  spacer(2);
  lines.push({ text: thinSeparator(columns) });
  spacer(2);

  lines.push({
    text: threeColumnLine(receipt.productHeader, receipt.quantityAbbreviation, receipt.total, columns),
    bold: true,
  });
  spacer(1);

  (receipt.items || []).forEach((item: any) => {
    itemLines(item, columns).forEach((line) => lines.push({ text: line }));
    spacer(1);
  });

  spacer(1);
  lines.push({ text: thinSeparator(columns) });
  spacer(2);

  if (Number(receipt.totals?.voluntaryTip || 0) > 0) {
    twoColumnLines(`${receipt.tipLabel}:`, receipt.totals.voluntaryTipText, columns).forEach((line) => lines.push({ text: line }));
    spacer(1);
  }

  lines.push({ text: `${receipt.totalLabel}: ${receipt.totals.totalText}`, bold: true, double: true });
  spacer(2);
  lines.push({ text: fullSeparator(columns) });
  spacer(2);

  twoColumnLines(`${receipt.methodLabel}:`, receipt.payment.methodText, columns).forEach((line) => lines.push({ text: line }));
  spacer(3);

  lines.push({ text: receipt.footer.message, align: 'center', bold: true });
  spacer(1);
  lines.push({ text: STOCKY_URL, align: 'center' });
  spacer(4);

  const effectivePageHeightMm = pageHeightMm ?? TICKET_MAX_PAGE_HEIGHT_MM;
  return buildTicketHtml(lines, printerWidthMm, effectivePageHeightMm);
}

export { formatTicketDateNumeric };
