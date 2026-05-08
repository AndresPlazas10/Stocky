import { getThermalPaperWidthMm } from '../utils/printer.js';
import { formatDateTimeTicket, formatPrice } from '../utils/formatters.js';

const buildKitchenOrderHtml = (itemsParaCocina, tableNumber, status, orderTotal) => {
  const printerWidthMm = getThermalPaperWidthMm();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Orden Mesa ${tableNumber}</title>
  <style>
    * { color:#000!important; -webkit-text-fill-color:#000!important; text-shadow:none!important; box-shadow:none!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @media print {
      @page { size:${printerWidthMm}mm auto; margin:1mm; }
      html,body { width:${printerWidthMm}mm!important; height:auto!important; margin:0; padding:0; }
      .receipt { break-inside:avoid; page-break-inside:avoid; }
    }
    body { font-family:'Courier New',monospace; font-size:18px; line-height:1.4; font-weight:700; color:#000!important; width:${printerWidthMm}mm; max-width:${printerWidthMm}mm; box-sizing:border-box; margin:0; padding:0; background:#fff; }
    .receipt { display:block; width:100%; margin:0; padding:1mm; box-sizing:border-box; }
    .header { text-align:center; border-bottom:2px dashed #000; padding-bottom:6px; margin-bottom:6px; color:#000; }
    .header h1 { font-size:30px; margin:0 0 3px 0; font-weight:900; letter-spacing:0.5px; }
    .header p { margin:1px 0; font-size:18px; font-weight:700; }
    .info { margin:6px 0; font-size:20px; font-weight:700; }
    .info strong { font-weight:900; }
    .items { margin:10px 0; }
    .item { display:flex; justify-content:space-between; margin:4px 0; padding:2px 0; border-bottom:1px dashed #ccc; }
    .item-name { flex:1; font-weight:900; font-size:21px; line-height:1.35; color:#000; }
    .item-qty { width:88px; text-align:right; font-size:21px; font-weight:900; font-variant-numeric:tabular-nums; color:#000; }
    .total { display:none; }
    .footer { text-align:center; margin-top:12px; padding-top:6px; border-top:2px dashed #000; font-size:15px; font-weight:800; }
    .separator { border-top:2px dashed #000; margin:8px 0; }
  </style>
</head>
<body>
  <div class="receipt">
  <div class="header">
    <h1>ORDEN DE COCINA</h1>
    <p>Mesa #${tableNumber}</p>
    <p>${formatDateTimeTicket(new Date())}</p>
  </div>
  <div class="info">
    <p><strong>Estado:</strong> ${status === 'occupied' ? 'Ocupada' : 'Disponible'}</p>
    <p><strong>Productos:</strong> ${itemsParaCocina.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} item${itemsParaCocina.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) !== 1 ? 's' : ''}</p>
  </div>
  <div class="separator"></div>
  <div class="items">
    ${itemsParaCocina.map(item => `
      <div class="item">
        <div class="item-name">${String(item?.products?.name || item?.combos?.nombre || item?.name || 'Item')}</div>
        <div class="item-qty">x${item.quantity}</div>
      </div>
    `).join('')}
  </div>
  <div class="total">TOTAL: ${formatPrice(orderTotal)}</div>
  <div class="footer">
    <p>*** ORDEN PARA COCINA ***</p>
    <p>Sistema Stocky</p>
  </div>
  </div>
</body>
</html>`;
};

export function printKitchenOrder({ itemsParaCocina, tableNumber, status, orderTotal, onError }) {
  const printContent = buildKitchenOrderHtml(itemsParaCocina, tableNumber, status, orderTotal);

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
