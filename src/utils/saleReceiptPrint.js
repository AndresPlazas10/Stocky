import { getThermalPaperWidthMm } from './printer.js';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate } from './receiptTemplate.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildReceiptBody = (receipt, printerWidthMm) => `
<style>
  @page { size: ${printerWidthMm}mm auto; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${printerWidthMm}mm; max-width: ${printerWidthMm}mm;
    margin: 0 auto; padding: 2mm;
    font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.45;
    font-weight: 700; color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hdr { text-align:center; border-bottom:2px dashed #000; padding-bottom:8px; margin-bottom:8px; }
  .hdr h1 { font-size:22px; font-weight:bold; margin-bottom:2px; }
  .hdr p { font-size:15px; margin:1px 0; }
  .row { display:flex; justify-content:space-between; margin:2px 0; font-size:15px; font-weight:700; }
  .sep { border-top:1px dashed #000; margin:8px 0; }
  .items-hdr { display:flex; justify-content:space-between; font-weight:bold; border-bottom:1px solid #000; padding:4px 0; font-size:15px; }
  .item { display:flex; justify-content:space-between; margin:4px 0; font-size:15px; font-weight:700; }
  .item-name { flex:1; padding-right:4px; }
  .item-qty { width:46px; text-align:center; }
  .item-price { width:90px; text-align:right; }
  .total { margin-top:10px; border-top:2px solid #000; padding-top:8px; font-size:21px; font-weight:bold; display:flex; justify-content:space-between; }
  .ftr { text-align:center; margin-top:12px; padding-top:8px; border-top:2px dashed #000; font-size:13px; font-weight:700; }
</style>
<div class="hdr">
  <h1>${escapeHtml(receipt.header.title)}</h1>
  <p>${escapeHtml(receipt.header.businessName)}</p>
  <p style="font-size:14px;">${escapeHtml(receipt.header.dateText)}</p>
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
<div class="total">
  <span>TOTAL:</span><span>${escapeHtml(receipt.totals.totalText)}</span>
</div>
<div class="sep"></div>
<div class="ftr">
  <p><strong>Método:</strong> ${escapeHtml(receipt.payment.methodText)}</p>
  <p style="margin-top:2px;">${escapeHtml(receipt.footer.message)}</p>
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
    const originalTitle = document.title;
    const originalBody = document.body.innerHTML;
    const bodyChildren = Array.from(document.body.childNodes);

    // Replace entire body with receipt-only content
    document.body.innerHTML = receiptHtml;
    document.title = 'Comprobante #' + sale.id;

    // Force layout before printing
    void document.body.offsetHeight;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      // Restore original body
      document.body.innerHTML = '';
      bodyChildren.forEach((child) => document.body.appendChild(child));
      document.title = originalTitle;
      resolve({ ok: true });
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => { cleanup(); }, 120000);

    window.print();
  });
}
