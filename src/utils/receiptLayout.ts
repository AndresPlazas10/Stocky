export interface TicketLine {
  text: string;
  bold?: boolean;
  double?: boolean;
  align?: 'left' | 'center' | 'right';
}

export const TICKET_LINE_HEIGHT = 1.35;
export const TICKET_LINE_HEIGHT_MM = 8;
export const TICKET_DOUBLE_LINE_HEIGHT_MM = TICKET_LINE_HEIGHT_MM * 2;
export const TICKET_VERTICAL_SCALE = 1;
export const TICKET_REGULAR_WEIGHT = 600;
export const TICKET_WIDTH_SAFETY_MM = 10;
export const TICKET_PAGE_HEIGHT_SAFETY_MM = 8;
export const TICKET_FONT_STACK = "'Lucida Console', 'Consolas', 'Courier New', monospace";
export const TICKET_CHAR_ADVANCE = 0.65;

const PX_PER_MM = 96 / 25.4;

export function getBaseFontPx(printerWidthMm: number): number {
  const columns = getReceiptColumns(printerWidthMm);
  const effectiveWidthMm = getTicketPrintableWidthMm(printerWidthMm);
  return Number(((effectiveWidthMm * PX_PER_MM) / (columns * TICKET_CHAR_ADVANCE)).toFixed(1));
}

export function getTicketPrintableHeightMm(pageHeightMm: number): number {
  return Math.max(30, Number(pageHeightMm) - TICKET_PAGE_HEIGHT_SAFETY_MM);
}

export function estimateTicketHeightMm(lines: TicketLine[], printerWidthMm: number): number {
  let heightMm = 0;
  for (const line of lines) {
    heightMm += line.double ? TICKET_DOUBLE_LINE_HEIGHT_MM : TICKET_LINE_HEIGHT_MM;
  }
  return Number((heightMm + 4).toFixed(1));
}

export const TICKET_MAX_PAGE_HEIGHT_MM = 3276;

export function getTicketPrintableWidthMm(paperWidthMm: number): number {
  // El driver termico de Windows expone el area imprimible menor al papel
  // (notacion estandar 58(48), 80(72), 104(96)). Para 58mm el area real medida
  // es ~55mm, por lo que la seguridad es solo 3mm frente al borde del papel.
  const safety = paperWidthMm <= 58 ? 3 : paperWidthMm <= 80 ? 8 : 8;
  return Math.max(30, paperWidthMm - safety);
}

export function getReceiptColumns(paperWidthMm: number): number {
  // Columnas calibradas para mantener la fuente ~11.8-12px en cualquier ancho
  // (misma metrica TICKET_CHAR_ADVANCE = 0.65).
  return paperWidthMm <= 58 ? 27 : paperWidthMm <= 80 ? 35 : 47;
}

const ITEM_QTY_COLUMNS = 5;

function getItemColumnWidths(columns: number): { nameCols: number; qtyCols: number; totalCols: number } {
  const totalCols = Math.max(8, Math.floor(columns / 2.6));
  const qtyCols = ITEM_QTY_COLUMNS;
  const nameCols = Math.max(6, columns - qtyCols - totalCols);
  return { nameCols, qtyCols, totalCols };
}

export function wrapText(text: string, width: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
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

export const fullSeparator = (columns: number): string => '='.repeat(columns);

export const thinSeparator = (columns: number): string => '-'.repeat(columns);

export function twoColumnLines(left: string, right: string, columns: number): string[] {
  const cleanRight = String(right ?? '');
  const rightWidth = Math.min(cleanRight.length, Math.floor(columns * 0.45));
  const leftWidth = Math.max(1, columns - rightWidth - 1);
  const leftLines = wrapText(left, leftWidth);

  return leftLines.map((line, index) => (
    index === 0
      ? line.padEnd(columns - cleanRight.length, ' ') + cleanRight
      : line
  ));
}

export function threeColumnLine(left: string, center: string, right: string, columns: number): string {
  const { nameCols, qtyCols, totalCols } = getItemColumnWidths(columns);
  const leftCol = left.padStart(Math.floor((nameCols + left.length) / 2)).padEnd(nameCols);
  const centerCol = center.padStart(Math.floor((qtyCols + center.length) / 2)).padEnd(qtyCols);
  const rightCol = right.padStart(Math.floor((totalCols + right.length) / 2)).padEnd(totalCols);
  return leftCol + centerCol + rightCol;
}

export function itemLines(
  item: { name?: string; quantity?: number; subtotalText?: string },
  columns: number,
): string[] {
  const qty = Number(item?.quantity || 0);
  const total = String(item?.subtotalText ?? '');
  const name = String(item?.name || 'Item');
  const { nameCols, qtyCols, totalCols } = getItemColumnWidths(columns);
  const qtyStr = 'x' + qty;
  const nameLines = wrapText(name, nameCols);

  return nameLines.map((line, index) => {
    const nameCol = line.padEnd(nameCols);
    const qtyCol = index === 0
      ? qtyStr.padStart(Math.floor((qtyCols + qtyStr.length) / 2)).padEnd(qtyCols)
      : ' '.repeat(qtyCols);
    const totalCol = index === 0 ? total.padStart(totalCols) : '';
    return nameCol + qtyCol + totalCol;
  });
}

export function formatTicketDateNumeric(
  timestamp: string | Date | number | null | undefined,
  timezone: string = 'America/Bogota',
): string {
  if (!timestamp) return 'Fecha inválida';
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Fecha inválida';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const rawPeriod = getPart('dayPeriod').toLowerCase();
    const dayPeriod = rawPeriod.includes('a') ? 'a.m.' : 'p.m.';
    return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return 'Fecha inválida';
  }
}

export function buildTicketCss(printerWidthMm: number, pageHeightMm: number): string {
  return `  * { margin:0; padding:0; box-sizing:border-box; color:#000 !important; border-color:#000 !important; }
  @media print {
    @page { size:${printerWidthMm}mm ${pageHeightMm}mm; margin:0; }
    html,body { width:${printerWidthMm}mm !important; height:100% !important; margin:0; padding:0; overflow:hidden; background:#fff !important; }
  }`;
}

export function buildTicketHtml(lines: TicketLine[], printerWidthMm: number, pageHeightMm: number = TICKET_MAX_PAGE_HEIGHT_MM): string {
  const effectiveWidthMm = getTicketPrintableWidthMm(printerWidthMm);
  const baseFontPx = getBaseFontPx(printerWidthMm);
  const escaped = (value: string) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const body = lines.map((line) => {
    const alignCss = line.align === 'center' ? 'text-align:center;' : line.align === 'right' ? 'text-align:right;' : 'text-align:left;';
    const boldCss = line.bold ? `font-weight:700;` : `font-weight:${TICKET_REGULAR_WEIGHT};`;
    const designFontPx = line.double ? baseFontPx * 2 : baseFontPx;
    const maxFontPx = (effectiveWidthMm * PX_PER_MM) / (Math.max(line.text.length, 1) * TICKET_CHAR_ADVANCE);
    const sizePx = Math.min(designFontPx, maxFontPx);
    const sizeCss = `font-size:${sizePx.toFixed(1)}px;`;
    const lineHeightMm = line.double ? TICKET_DOUBLE_LINE_HEIGHT_MM : TICKET_LINE_HEIGHT_MM;
    const lineHeightCss = `height:${lineHeightMm}mm;line-height:${lineHeightMm}mm;`;
    return `<div style="${alignCss}${boldCss}${sizeCss}${lineHeightCss}">${escaped(line.text)}</div>`;
  }).join('\n');

  const scaleCss = TICKET_VERTICAL_SCALE !== 1
    ? `.ticket { transform:scaleY(${TICKET_VERTICAL_SCALE}); transform-origin:top center; }`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Comprobante</title>
<style>
${buildTicketCss(printerWidthMm, pageHeightMm)}
  body {
    width:${effectiveWidthMm}mm; max-width:${effectiveWidthMm}mm; margin:0; padding:1mm 0;
    font-family:${TICKET_FONT_STACK}; font-size:${baseFontPx}px; line-height:${TICKET_LINE_HEIGHT}; color:#000; background:#fff;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .ticket { width:100%; padding:1mm 0; box-sizing:border-box; break-inside:avoid; page-break-inside:avoid; }
  .ticket div { white-space:pre; overflow:hidden; }
${scaleCss}
</style></head>
<body>
  <div class="ticket">
${body}
  </div>
</body>
</html>`;
}
