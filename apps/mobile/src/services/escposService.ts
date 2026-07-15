import type { ReceiptLabels } from '../utils/receiptLabels';

export function cleanText(value: string | null | undefined): string {
  if (!value) return '';
  const normalized = value.normalize('NFD');
  return normalized
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

export function buildSaleEscPos(
  receipt: SaleReceipt,
  paperWidthMm: number,
  autoCut = false,
): Uint8Array {
  const columns = paperWidthMm <= 58 ? 32 : paperWidthMm <= 80 ? 48 : 64;
  const out = new ByteStream();

  cmd(out, 0x1b, 0x40);
  cmd(out, 0x1b, 0x74, 0x10);
  cmd(out, 0x1b, 0x33, 60);

  const header = receipt.header;
  const headerAlign = header?.alignment === 'center' ? 1 : header?.alignment === 'right' ? 2 : 0;

  feed(out, 1);
  align(out, headerAlign);
  bold(out, true);
  size(out, true);
  writeLine(out, cleanText(header?.title || 'COMPROBANTE'));
  size(out, false);
  bold(out, false);
  feed(out, 1);

  writeLine(out, cleanText(header?.businessName || 'Sistema Stocky'));

  const dateText = cleanText(header?.dateText || '');
  if (dateText) {
    feed(out, 1);
    writeLine(out, dateText);
  }

  feed(out, 2);
  align(out, 0);
  fullSeparator(out, columns);
  feed(out, 2);

  const metadata = receipt.metadata;
  if (metadata) {
    for (const row of metadata) {
      if (!row) continue;
      twoColumns(out, cleanText(row.label) + ':', cleanText(row.value), columns);
      feed(out, 1);
    }
  }

  feed(out, 2);
  thinSeparator(out, columns);
  feed(out, 2);

  bold(out, true);
  align(out, 0);
  threeColumns(
    out,
    cleanText(receipt.productHeader || 'Producto'),
    cleanText(receipt.quantityAbbreviation || 'Cant.'),
    cleanText(receipt.total || 'Total'),
    columns,
  );
  bold(out, false);
  feed(out, 1);

  const items = receipt.items;
  if (items) {
    for (const item of items) {
      if (!item) continue;
      itemLines(out, item, columns);
      feed(out, 1);
    }
  }

  feed(out, 1);
  thinSeparator(out, columns);
  feed(out, 2);

  const totals = receipt.totals;
  if (totals) {
    if (totals.voluntaryTip && totals.voluntaryTip > 0) {
      twoColumns(
        out,
        cleanText(receipt.tipLabel || 'Propina') + ':',
        cleanText(totals.voluntaryTipText || String(totals.voluntaryTip)),
        columns,
      );
      feed(out, 1);
    }

    bold(out, true);
    size(out, true);
    const totalText = (receipt.totalLabel || 'TOTAL') + ': ' + cleanText(totals.totalText || '');
    writeLine(out, totalText);
    size(out, false);
    bold(out, false);
  }

  feed(out, 2);
  fullSeparator(out, columns);
  feed(out, 2);

  const payment = receipt.payment;
  const methodText = cleanText(payment?.methodText || receipt.notSpecified || 'No especificado');
  twoColumns(out, (receipt.methodLabel || 'Metodo') + ':', methodText, columns);

  feed(out, 3);

  const footer = receipt.footer;
  const footerAlign = footer?.alignment === 'center' ? 1 : footer?.alignment === 'right' ? 2 : 0;
  align(out, footerAlign);
  bold(out, true);
  writeLine(out, cleanText(footer?.message || 'Gracias por su compra'));
  bold(out, false);

  align(out, 0);
  feed(out, 4);
  if (autoCut) {
    cmd(out, 0x1d, 0x56, 0x42, 0x00);
  }

  return out.toBytes();
}

class ByteStream {
  private chunks: number[] = [];
  write(...bytes: number[]) {
    for (const b of bytes) this.chunks.push(b);
  }
  toBytes(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

function cmd(out: ByteStream, ...bytes: number[]) {
  out.write(...bytes);
}

function align(out: ByteStream, mode: number) {
  cmd(out, 0x1b, 0x61, mode);
}

function bold(out: ByteStream, enabled: boolean) {
  cmd(out, 0x1b, 0x45, enabled ? 1 : 0);
}

function size(out: ByteStream, large: boolean) {
  cmd(out, 0x1d, 0x21, large ? 0x11 : 0x00);
}

function feed(out: ByteStream, lines: number) {
  cmd(out, 0x1b, 0x64, Math.max(1, lines));
}

function writeLine(out: ByteStream, text: string) {
  for (const c of text + '\n') out.write(c.charCodeAt(0));
}

function fullSeparator(out: ByteStream, columns: number) {
  writeLine(out, '='.repeat(columns));
}

function thinSeparator(out: ByteStream, columns: number) {
  writeLine(out, '-'.repeat(columns));
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + word.length + 1 <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function twoColumns(out: ByteStream, left: string, right: string, columns: number) {
  const cleanRight = cleanText(right);
  const rightWidth = Math.min(cleanRight.length, Math.floor(columns * 0.45));
  const leftWidth = Math.max(1, columns - rightWidth - 1);
  const leftLines = wrapText(left, leftWidth);

  for (let i = 0; i < leftLines.length; i++) {
    if (i > 0) {
      writeLine(out, leftLines[i]);
    } else {
      const line = leftLines[i].padEnd(columns - cleanRight.length, ' ') + cleanRight;
      writeLine(out, line);
    }
  }
}

interface ReceiptItem {
  quantity?: number;
  subtotalText?: string;
  subtotal?: number;
  name?: string;
}

function threeColumns(out: ByteStream, left: string, center: string, right: string, columns: number) {
  const colWidth = Math.floor(columns / 3);
  const leftCol = left.padStart(Math.floor((colWidth + left.length) / 2)).padEnd(colWidth);
  const centerCol = center.padStart(Math.floor((colWidth + center.length) / 2)).padEnd(colWidth);
  const rightCol = right.padStart(Math.floor((colWidth + right.length) / 2));
  writeLine(out, leftCol + centerCol + rightCol);
}

function itemLines(out: ByteStream, item: ReceiptItem, columns: number) {
  const qty = item.quantity || 0;
  const total = cleanText(item.subtotalText || String(item.subtotal || 0));
  const name = cleanText(item.name || 'Item');
  const colWidth = Math.floor(columns / 3);
  const qtyStr = 'x' + qty;

  const nameLines = wrapText(name, colWidth);
  for (let i = 0; i < nameLines.length; i++) {
    const nameCol = nameLines[i].padEnd(colWidth);
    const qtyCol = i === 0
      ? qtyStr.padStart(Math.floor((colWidth + qtyStr.length) / 2)).padEnd(colWidth)
      : ' '.repeat(colWidth);
    const totalCol = i === 0 ? total : '';
    writeLine(out, nameCol + qtyCol + totalCol);
  }
}

export interface SaleReceipt {
  type?: string;
  version?: number;
  header?: {
    title?: string;
    businessName?: string;
    dateText?: string;
    alignment?: 'left' | 'center' | 'right';
  };
  metadata?: ({ label: string; value: string } | null)[];
  items?: ({
    name?: string;
    quantity?: number;
    unitPrice?: number;
    subtotal?: number;
    subtotalText?: string;
  } | null)[];
  totals?: {
    subtotal?: number;
    subtotalText?: string;
    voluntaryTip?: number;
    voluntaryTipText?: string;
    total?: number;
    totalText?: string;
  };
  payment?: {
    method?: string;
    methodText?: string;
  };
  footer?: {
    message?: string;
    alignment?: 'left' | 'center' | 'right';
  };
  itemsHeader?: string;
  productHeader?: string;
  quantityAbbreviation?: string;
  total?: string;
  tipLabel?: string;
  totalLabel?: string;
  methodLabel?: string;
  notSpecified?: string;
}

export function buildKitchenEscPos(opts: {
  mesaNumber: string | number;
  items: { name: string; quantity: number }[];
  createdAt?: string;
  businessName?: string;
  paperWidthMm: number;
  autoCut?: boolean;
  timezone?: string;
  labels: ReceiptLabels;
}): Uint8Array {
  const columns = opts.paperWidthMm <= 58 ? 32 : opts.paperWidthMm <= 80 ? 48 : 64;
  const out = new ByteStream();
  const { labels } = opts;

  cmd(out, 0x1b, 0x40);
  cmd(out, 0x1b, 0x74, 0x10);
  cmd(out, 0x1b, 0x33, 60);

  feed(out, 1);
  align(out, 1);
  bold(out, true);
  size(out, true);
  writeLine(out, cleanText(labels.kitchenTitle));
  size(out, false);
  bold(out, false);
  feed(out, 1);

  bold(out, true);
  writeLine(out, cleanText(labels.kitchenTable) + String(opts.mesaNumber));
  bold(out, false);
  feed(out, 1);

  const now = opts.createdAt ? new Date(opts.createdAt) : new Date();
  const tz = opts.timezone || 'America/Bogota';
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now);

  const getPart = (type: string) => dateParts.find(p => p.type === type)?.value || '';
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const rawPeriod = getPart('dayPeriod').toLowerCase();
  const dayPeriod = rawPeriod.includes('a') ? 'a.m.' : 'p.m.';
  writeLine(out, `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`);

  feed(out, 1);
  align(out, 0);
  fullSeparator(out, columns);
  feed(out, 1);

  const totalUnits = opts.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  writeLine(out, cleanText(labels.itemsLabel) + ': ' + totalUnits);
  feed(out, 1);
  thinSeparator(out, columns);
  feed(out, 1);

  bold(out, true);
  twoColumns(out, cleanText(labels.productsHeader), cleanText(labels.quantityHeader), columns);
  bold(out, false);
  feed(out, 1);

  for (const item of opts.items) {
    if (!item || !item.name) continue;
    bold(out, true);
    twoColumns(out, cleanText(item.name), 'x' + (item.quantity || 0), columns);
    bold(out, false);
    feed(out, 1);
  }

  feed(out, 1);
  fullSeparator(out, columns);
  feed(out, 2);

  align(out, 1);
  bold(out, true);
  writeLine(out, cleanText(labels.kitchenFooter));
  bold(out, false);

  align(out, 0);
  feed(out, 4);
  if (opts.autoCut) {
    cmd(out, 0x1d, 0x56, 0x42, 0x00);
  }
  return out.toBytes();
}
