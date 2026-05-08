import { getThermalPaperWidthMm } from './printer.js';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate } from './receiptTemplate.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildReceiptHtml = (receipt, printerWidthMm) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Comprobante</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; color:#000 !important; border-color:#000 !important; }
  @media print {
    @page { size:${printerWidthMm}mm auto; margin:1mm; }
    html,body { width:${printerWidthMm}mm !important; margin:0; padding:0; background:#fff !important; }
  }
  body {
    width:${printerWidthMm}mm; max-width:${printerWidthMm}mm; margin:0 auto; padding:1mm;
    font-family:'Courier New',monospace; font-size:18px; line-height:1.4; font-weight:700;
    background:#fff; color:#000;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .hdr { text-align:center; border-bottom:2px dashed #000; padding-bottom:6px; margin-bottom:6px; }
  .hdr h1 { font-size:28px; font-weight:900; margin-bottom:4px; }
  .hdr p { font-size:18px; font-weight:700; margin:2px 0; }
  .row { display:flex; justify-content:space-between; margin:2px 0; font-size:17px; font-weight:700; }
  .sep { border-top:2px dashed #000; margin:8px 0; }
  .items-hdr { display:flex; justify-content:space-between; font-weight:900; border-bottom:1px solid #000; padding:4px 0; font-size:18px; }
  .item { display:flex; justify-content:space-between; margin:4px 0; padding:2px 0; border-bottom:1px dashed #ccc; }
  .item-name { flex:1; padding-right:4px; font-weight:800; }
  .item-qty { width:50px; text-align:center; font-weight:800; }
  .item-price { width:100px; text-align:right; font-weight:800; }
  .total { margin-top:8px; border-top:2px solid #000; padding-top:8px; font-size:24px; font-weight:900; display:flex; justify-content:space-between; }
  .ftr { text-align:center; margin-top:12px; padding-top:8px; border-top:2px dashed #000; font-size:15px; font-weight:800; }
</style></head>
<body>
  <div class="hdr">
    <h1>${escapeHtml(receipt.header.title)}</h1>
    <p>${escapeHtml(receipt.header.businessName)}</p>
    <p style="font-size:16px;">${escapeHtml(receipt.header.dateText)}</p>
  </div>
  ${receipt.metadata.map((row) => `
    <div class="row"><span><strong>${escapeHtml(row.label)}:</strong></span><span>${escapeHtml(row.value)}</span></div>
  `).join('')}
  <div class="sep"></div>
  <div class="items-hdr">
    <span style="flex:1">Producto</span><span class="item-qty">Cant.</span><span class="item-price">Total</span>
  </div>
  ${receipt.items.map((item) => `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-qty">x${Number(item.quantity || 0)}</div>
      <div class="item-price">${escapeHtml(item.subtotalText)}</div>
    </div>
  `).join('')}
  ${Number(receipt.totals.voluntaryTip || 0) > 0 ? `
    <div class="row"><span><strong>Propina voluntaria:</strong></span><span>${escapeHtml(receipt.totals.voluntaryTipText)}</span></div>
  ` : ''}
  <div class="total"><span>TOTAL:</span><span>${escapeHtml(receipt.totals.totalText)}</span></div>
  <div class="sep"></div>
  <div class="ftr">
    <p><strong>Método:</strong> ${escapeHtml(receipt.payment.methodText)}</p>
    <p style="margin-top:3px;">${escapeHtml(receipt.footer.message)}</p>
  </div>
</body>
</html>`;

export async function printSaleReceipt({
  sale,
  saleDetails = [],
  sellerName = 'Empleado',
  businessName = 'Sistema Stocky',
  footerMessage = 'Gracias por su compra',
  voluntaryTip = null,
}) {
  if (!sale?.id) {
    return { ok: false, error: 'No se pudo imprimir: venta sin id.' };
  }
  if (!Array.isArray(saleDetails) || saleDetails.length === 0) {
    return { ok: false, error: 'No se pudo imprimir: la venta no tiene items.' };
  }

  const printerWidthMm = getThermalPaperWidthMm();
  const receipt = buildSaleReceiptTemplate({
    sale, saleDetails, sellerName, businessName, footerMessage, voluntaryTip,
  });
  const validation = validateSaleReceiptTemplate(receipt);
  if (!validation.ok) return validation;

  const html = buildReceiptHtml(receipt, printerWidthMm);

  return new Promise((resolve) => {
    const win = window.open('', '_blank');
    if (!win) {
      resolve({ ok: false, error: 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.' });
      return;
    }

    win.document.write(html);
    win.document.close();
    win.focus();

    // Called from main window's click handler — preserves user gesture
    win.print();

    const done = () => resolve({ ok: true });
    const timer = setInterval(() => {
      if (win.closed) { clearInterval(timer); done(); }
    }, 500);
    setTimeout(() => {
      clearInterval(timer);
      if (!win.closed) try { win.close(); } catch (e) { /* ignore */ }
      done();
    }, 120000);
  });
}
