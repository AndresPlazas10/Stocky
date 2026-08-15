import { getThermalPaperWidthMm } from './printer.js';
import { formatTicketDateNumeric } from './receiptLayout';
import {
  buildTicketHtml,
  fullSeparator,
  getReceiptColumns,
  TICKET_MAX_PAGE_HEIGHT_MM,
  thinSeparator,
  twoColumnLines,
  type TicketLine,
} from './receiptLayout.js';

interface KitchenItem {
  quantity?: number;
  products?: { name?: string } | null;
  combos?: { nombre?: string } | null;
  name?: string;
}

export const KITCHEN_LABELS = {
  kitchenTitle: 'ORDEN DE COCINA',
  kitchenTable: 'Mesa #',
  itemsLabel: 'Productos',
  productsHeader: 'Productos',
  quantityHeader: 'Cantidad',
  kitchenFooter: '*** ORDEN PARA COCINA ***',
  kitchenSystem: 'Sistema Stocky',
};

export function buildKitchenOrderHtml(
  itemsParaCocina: KitchenItem[],
  tableNumber: number | string,
  orderTotal: number,
  printerWidthMm: number,
  labels: Partial<typeof KITCHEN_LABELS> = {},
  timezone: string = 'America/Bogota',
  pageHeightMm?: number,
): string {
  const l = { ...KITCHEN_LABELS, ...labels };
  const columns = getReceiptColumns(printerWidthMm);
  const lines: TicketLine[] = [];
  const spacer = (n: number = 1) => { for (let i = 0; i < n; i += 1) lines.push({ text: '' }); };

  const items = Array.isArray(itemsParaCocina) ? itemsParaCocina : [];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);

  spacer(1);
  lines.push({ text: l.kitchenTitle, align: 'center', bold: true, double: true });
  spacer(1);
  lines.push({ text: `${l.kitchenTable}${String(tableNumber)}`, align: 'center', bold: true });
  spacer(1);
  lines.push({ text: formatTicketDateNumeric(new Date(), timezone), align: 'center' });
  spacer(1);
  lines.push({ text: fullSeparator(columns) });
  spacer(1);

  lines.push({ text: `${l.itemsLabel}: ${totalUnits}` });
  spacer(1);
  lines.push({ text: thinSeparator(columns) });
  spacer(1);

  twoColumnLines(l.productsHeader, l.quantityHeader, columns).forEach((line) => lines.push({ text: line, bold: true }));
  spacer(1);

  items.forEach((item) => {
    const name = item?.products?.name || item?.combos?.nombre || item?.name || 'Item';
    twoColumnLines(name, `x${Number(item?.quantity || 0)}`, columns).forEach((line) => lines.push({ text: line, bold: true }));
    spacer(1);
  });

  spacer(1);
  lines.push({ text: fullSeparator(columns) });
  spacer(2);

  lines.push({ text: l.kitchenFooter, align: 'center', bold: true });
  spacer(4);

  const effectivePageHeightMm = pageHeightMm ?? TICKET_MAX_PAGE_HEIGHT_MM;
  return buildTicketHtml(lines, printerWidthMm, effectivePageHeightMm);
}

export async function printKitchenOrder({
  itemsParaCocina,
  tableNumber,
  status,
  orderTotal,
  onError,
  timezone = 'America/Bogota',
  labels = {} as Partial<typeof KITCHEN_LABELS>,
}: {
  itemsParaCocina: KitchenItem[];
  tableNumber: number | string;
  status: 'occupied' | 'available';
  orderTotal: number;
  onError?: (msg: string | null) => void;
  timezone?: string;
  labels?: Partial<typeof KITCHEN_LABELS>;
}) {
  const printerWidthMm = getThermalPaperWidthMm();
  const printContent = buildKitchenOrderHtml(itemsParaCocina, tableNumber, orderTotal, printerWidthMm, labels, timezone);

  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  if (onError) {
    onError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
    setTimeout(() => onError(null), 3000);
  }
}
