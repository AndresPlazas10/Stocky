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
<head>
  <meta charset="UTF-8">
  <title>Comprobante</title>
  <style>
    * {
      color: #000 !important;
      border-color: #000 !important;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      @page {
        size: ${printerWidthMm}mm auto;
        margin: 2mm;
      }
      html, body {
        width: ${printerWidthMm}mm !important;
        margin: 0;
        padding: 0;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      line-height: 1.65;
      font-weight: 700;
      color: #000 !important;
      width: ${printerWidthMm}mm;
      max-width: ${printerWidthMm}mm;
      margin: 0 auto;
      padding: 2mm;
      background: #fff;
    }
    .header { text-align:center; border-bottom:2px dashed #000; padding-bottom:10px; margin-bottom:10px; }
    .header h1 { font-size:30px; margin:0 0 5px; font-weight:900; }
    .header p { margin:2px 0; font-size:18px; font-weight:700; }
    .row { display:flex; justify-content:space-between; margin:2px 0; font-size:17px; font-weight:700; }
    .sep { border-top:2px dashed #000; margin:10px 0; }
    .items-hdr { display:flex; justify-content:space-between; font-weight:900; border-bottom:1px solid #000; padding:4px 0; font-size:18px; }
    .item { display:flex; justify-content:space-between; margin:6px 0; padding:3px 0; border-bottom:1px dashed #ccc; }
    .item-name { flex:1; padding-right:4px; font-weight:800; font-size:18px; }
    .item-qty { width:50px; text-align:center; font-size:18px; font-weight:800; }
    .item-price { width:100px; text-align:right; font-size:18px; font-weight:800; }
    .total { margin-top:10px; border-top:2px solid #000; padding-top:10px; font-size:24px; font-weight:900; display:flex; justify-content:space-between; }
    .ftr { text-align:center; margin-top:20px; padding-top:10px; border-top:2px dashed #000; font-size:15px; font-weight:800; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(receipt.header.title)}</h1>
    <p>${escapeHtml(receipt.header.businessName)}</p>
    <p>${escapeHtml(receipt.header.dateText)}</p>
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
    <p style="margin-top:3px;">${escapeHtml(receipt.footer.message)}</p>
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 100);
    };
  </script>
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

  const printContent = buildReceiptHtml(receipt, printerWidthMm);

  return new Promise((resolve) => {
    // Try popup first (works on desktop + most Android)
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      resolve({ ok: true });
      return;
    }

    // Fallback: hidden iframe with srcdoc (matches kitchen order pattern)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try { iframe.remove(); } catch (e) { /* ignore */ }
      resolve({ ok: true });
    };

    iframe.onload = () => {
      try {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) throw new Error('No frame window');
        frameWindow.focus();
        frameWindow.print();
        setTimeout(cleanup, 800);
      } catch (err) {
        cleanup();
        resolve({ ok: false, error: err.message || 'Error de impresion' });
      }
    };

    iframe.onerror = () => {
      cleanup();
      resolve({ ok: false, error: 'Error al cargar el recibo para impresion' });
    };

    iframe.srcdoc = printContent;
    document.body.appendChild(iframe);

    setTimeout(() => { cleanup(); }, 60000);
  });
}
