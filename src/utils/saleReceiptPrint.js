import { getThermalPaperWidthMm } from './printer.js';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate } from './receiptTemplate.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildReceiptBody = (receipt, printerWidthMm) => `
<style id="__stocky_print_styles__">
  @page { size: ${printerWidthMm}mm auto; margin: 2mm; }
  @media print {
    html, body, #root, #__stocky_print_overlay__ * {
      color: #000 !important;
      border-color: #000 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #__stocky_print_overlay__ {
      position: static !important;
      z-index: auto !important;
    }
  }
</style>
<div style="
  width: ${printerWidthMm}mm;
  max-width: ${printerWidthMm}mm;
  margin: 0 auto;
  padding: 2mm;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  line-height: 1.6;
  font-weight: 700;
  color: #000;
  background: #fff;
">
  <div style="text-align:center; border-bottom:2px dashed #000; padding-bottom:10px; margin-bottom:10px;">
    <h1 style="font-size:28px; font-weight:900; margin:0 0 4px;">${escapeHtml(receipt.header.title)}</h1>
    <p style="font-size:18px; font-weight:700; margin:2px 0;">${escapeHtml(receipt.header.businessName)}</p>
    <p style="font-size:16px; margin:2px 0;">${escapeHtml(receipt.header.dateText)}</p>
  </div>
  ${receipt.metadata.map((row) => `
    <div style="display:flex; justify-content:space-between; margin:2px 0; font-size:17px; font-weight:700;">
      <span><strong>${escapeHtml(row.label)}:</strong></span>
      <span>${escapeHtml(row.value)}</span>
    </div>
  `).join('')}
  <div style="border-top:2px dashed #000; margin:12px 0;"></div>
  <div style="display:flex; justify-content:space-between; font-weight:900; border-bottom:1px solid #000; padding:4px 0; font-size:18px;">
    <span style="flex:1">Producto</span>
    <span style="width:50px; text-align:center;">Cant.</span>
    <span style="width:100px; text-align:right;">Total</span>
  </div>
  ${receipt.items.map((item) => `
    <div style="display:flex; justify-content:space-between; margin:6px 0; padding:3px 0; border-bottom:1px dashed #ccc;">
      <div style="flex:1; padding-right:4px; font-weight:800; font-size:18px;">${escapeHtml(item.name)}</div>
      <div style="width:50px; text-align:center; font-size:18px; font-weight:800;">x${Number(item.quantity || 0)}</div>
      <div style="width:100px; text-align:right; font-size:18px; font-weight:800;">${escapeHtml(item.subtotalText)}</div>
    </div>
  `).join('')}
  ${Number(receipt.totals.voluntaryTip || 0) > 0 ? `
    <div style="display:flex; justify-content:space-between; margin:2px 0; font-size:17px; font-weight:700;">
      <span><strong>Propina voluntaria:</strong></span>
      <span>${escapeHtml(receipt.totals.voluntaryTipText)}</span>
    </div>
  ` : ''}
  <div style="margin-top:12px; border-top:2px solid #000; padding-top:12px; font-size:24px; font-weight:900; display:flex; justify-content:space-between;">
    <span>TOTAL:</span>
    <span>${escapeHtml(receipt.totals.totalText)}</span>
  </div>
  <div style="border-top:2px dashed #000; margin:12px 0;"></div>
  <div style="text-align:center; margin-top:16px; padding-top:10px; border-top:2px dashed #000; font-size:15px; font-weight:800;">
    <p style="margin:0;"><strong>Método:</strong> ${escapeHtml(receipt.payment.methodText)}</p>
    <p style="margin:3px 0 0;">${escapeHtml(receipt.footer.message)}</p>
  </div>
</div>
`;

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

  const receiptHtml = buildReceiptBody(receipt, printerWidthMm);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = '__stocky_print_overlay__';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 2147483647; background: #fff; overflow-y: auto;
    `;
    overlay.innerHTML = receiptHtml;
    document.body.appendChild(overlay);

    // Force synchronous layout so the overlay is painted before print
    void overlay.offsetHeight;

    // Called directly within user gesture
    window.print();

    const cleanup = () => {
      const el = document.getElementById('__stocky_print_overlay__');
      if (el) el.remove();
      const style = document.getElementById('__stocky_print_styles__');
      if (style) style.remove();
      resolve({ ok: true });
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 120000);
  });
}
