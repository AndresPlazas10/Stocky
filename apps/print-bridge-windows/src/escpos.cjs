const ESC = 0x1b;
const GS = 0x1d;

const PAPER_COLUMNS = {
  58: 32,
  80: 48,
  104: 64
};

const stripUnsupported = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7e\n\r]/g, '');

const line = (text = '') => Buffer.from(`${stripUnsupported(text)}\n`, 'ascii');
const command = (...bytes) => Buffer.from(bytes);

const align = (mode) => {
  if (mode === 'center') return command(ESC, 0x61, 0x01);
  if (mode === 'right') return command(ESC, 0x61, 0x02);
  return command(ESC, 0x61, 0x00);
};

const bold = (enabled) => command(ESC, 0x45, enabled ? 0x01 : 0x00);
const size = (mode) => command(GS, 0x21, mode === 'large' ? 0x11 : 0x00);
const feed = (rows = 1) => command(ESC, 0x64, Math.max(1, Math.min(8, Number(rows) || 1)));
const cut = () => command(GS, 0x56, 0x42, 0x00);

const separator = (columns, char = '-') => line(char.repeat(columns));

const wrapText = (text, width) => {
  const words = stripUnsupported(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if ((current.length + word.length + 1) <= width) {
      current = `${current} ${word}`;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const twoColumns = (left, right, columns) => {
  const cleanRight = stripUnsupported(right);
  const rightWidth = Math.min(cleanRight.length, Math.floor(columns * 0.45));
  const leftWidth = columns - rightWidth - 1;
  const leftLines = wrapText(left, leftWidth);

  return leftLines.map((leftLine, index) => {
    if (index > 0) return line(leftLine);
    const spaces = Math.max(1, columns - leftLine.length - cleanRight.length);
    return line(`${leftLine}${' '.repeat(spaces)}${cleanRight}`);
  });
};

const itemLines = (item, columns) => {
  const qty = `x${Number(item.quantity || 0)}`;
  const total = stripUnsupported(item.subtotalText || item.subtotal || '');
  const qtyTotal = `${qty} ${total}`;
  const nameWidth = Math.max(12, columns - qtyTotal.length - 1);
  const names = wrapText(item.name || 'Item', nameWidth);

  return names.map((name, index) => {
    if (index > 0) return line(name);
    const spaces = Math.max(1, columns - name.length - qtyTotal.length);
    return line(`${name}${' '.repeat(spaces)}${qtyTotal}`);
  });
};

const serializeSaleReceipt = ({ receipt, paperWidthMm }) => {
  const columns = PAPER_COLUMNS[Number(paperWidthMm)] || PAPER_COLUMNS[80];
  const chunks = [
    command(ESC, 0x40),
    command(ESC, 0x74, 0x10),
    align(receipt.header?.alignment || 'center'),
    bold(true),
    size('large'),
    line(receipt.header?.title || 'COMPROBANTE'),
    size('normal'),
    line(receipt.header?.businessName || 'Sistema Stocky'),
    bold(false),
    line(receipt.header?.dateText || ''),
    align('left'),
    separator(columns)
  ];

  (receipt.metadata || []).forEach((row) => {
    chunks.push(...twoColumns(`${row.label}:`, row.value, columns));
  });

  chunks.push(separator(columns));
  chunks.push(bold(true), line('Producto'), bold(false));
  (receipt.items || []).forEach((item) => {
    chunks.push(...itemLines(item, columns));
  });

  chunks.push(separator(columns));
  if (Number(receipt.totals?.voluntaryTip || 0) > 0) {
    chunks.push(...twoColumns('Propina voluntaria:', receipt.totals.voluntaryTipText, columns));
  }

  chunks.push(bold(true));
  chunks.push(...twoColumns('TOTAL:', receipt.totals?.totalText || '', columns));
  chunks.push(bold(false));
  chunks.push(separator(columns));
  chunks.push(...twoColumns('Metodo:', receipt.payment?.methodText || 'No especificado', columns));
  chunks.push(feed(1));
  chunks.push(align(receipt.footer?.alignment || 'center'));
  chunks.push(line(receipt.footer?.message || 'Gracias por su compra'));
  chunks.push(align('left'), feed(3), cut());

  return Buffer.concat(chunks);
};

const serializeReceipt = ({ receipt, paperWidthMm }) => {
  if (receipt?.type === 'sale') {
    return serializeSaleReceipt({ receipt, paperWidthMm });
  }

  throw new Error('Tipo de recibo no soportado');
};

module.exports = { serializeReceipt, PAPER_COLUMNS };
