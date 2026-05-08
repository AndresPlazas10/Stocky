import { getThermalPaperWidthMm } from './printer.js';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate } from './receiptTemplate.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildReceiptHtml = (receipt, printerWidthMm) => `
  <div id="stocky-print-layer" style="
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99999; background: #fff; overflow: auto;
    font-family: 'Courier New', monospace; color: #000;
  ">
    <style>
      @page { size: ${printerWidthMm}mm auto; margin: 2mm; }
      @media print {
        body, html { background: #fff !important; }
        #stocky-print-layer { position: static !important; }
      }
    </style>
    <div style="
      width: ${printerWidthMm}mm; max-width: ${printerWidthMm}mm;
      margin: 0 auto; padding: 2mm; box-sizing: border-box;
      font-size: 16px; line-height: 1.45; font-weight: 700;
      color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact;
    ">
      <div style="text-align:center; border-bottom:2px dashed #000; padding-bottom:8px; margin-bottom:8px;">
        <h1 style="font-size:22px; margin:0 0 4px; font-weight:bold;">${escapeHtml(receipt.header.title)}</h1>
        <p style="margin:0; font-size:15px;">${escapeHtml(receipt.header.businessName)}</p>
        <p style="margin:2px 0 0; font-size:14px;">${escapeHtml(receipt.header.dateText)}</p>
      </div>
      ${receipt.metadata.map((row) => `
        <div style="display:flex; justify-content:space-between; margin:2px 0; font-size:15px; font-weight:700;">
          <span><strong>${escapeHtml(row.label)}:</strong></span>
          <span>${escapeHtml(row.value)}</span>
        </div>
      `).join('')}
      <div style="border-top:1px dashed #000; margin:8px 0;"></div>
      <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom:1px solid #000; padding:4px 0; font-size:15px;">
        <span style="flex:1">Producto</span>
        <span style="width:46px; text-align:center;">Cant.</span>
        <span style="width:90px; text-align:right;">Total</span>
      </div>
      ${receipt.items.map((item) => `
        <div style="display:flex; justify-content:space-between; margin:4px 0; font-size:15px; font-weight:700;">
          <div style="flex:1; padding-right:4px;">${escapeHtml(item.name)}</div>
          <div style="width:46px; text-align:center;">x${Number(item.quantity || 0)}</div>
          <div style="width:90px; text-align:right;">${escapeHtml(item.subtotalText)}</div>
        </div>
      `).join('')}
      ${Number(receipt.totals.voluntaryTip || 0) > 0 ? `
        <div style="display:flex; justify-content:space-between; margin:2px 0; font-size:15px; font-weight:700;">
          <span><strong>Propina voluntaria:</strong></span>
          <span>${escapeHtml(receipt.totals.voluntaryTipText)}</span>
        </div>
      ` : ''}
      <div style="margin-top:10px; border-top:2px solid #000; padding-top:8px; font-size:21px; font-weight:bold; display:flex; justify-content:space-between;">
        <span>TOTAL:</span>
        <span>${escapeHtml(receipt.totals.totalText)}</span>
      </div>
      <div style="border-top:1px dashed #000; margin:8px 0;"></div>
      <div style="text-align:center; margin-top:12px; padding-top:8px; border-top:2px dashed #000; font-size:13px; font-weight:700;">
        <p style="margin:0;"><strong>Método:</strong> ${escapeHtml(receipt.payment.methodText)}</p>
        <p style="margin:2px 0 0;">${escapeHtml(receipt.footer.message)}</p>
      </div>
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
    sale,
    saleDetails,
    sellerName,
    businessName,
    footerMessage,
    voluntaryTip,
  });
  const validation = validateSaleReceiptTemplate(receipt);

  if (!validation.ok) {
    return validation;
  }

  const html = buildReceiptHtml(receipt, printerWidthMm);

  return new Promise((resolve) => {
    const root = document.getElementById('root');
    const prevDisplay = root ? root.style.display : '';

    if (root) root.style.display = 'none';

    const container = document.createElement('div');
    container.innerHTML = html;
    const layer = container.firstElementChild;
    document.body.appendChild(layer);

    // Force layout
    void layer.offsetHeight;

    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      if (root) root.style.display = prevDisplay;
      resolve({ ok: true });
    };

    if (typeof window.onafterprint !== 'undefined') {
      window.onafterprint = () => {
        window.onafterprint = null;
        cleanup();
      };
    }

    // Safety timeout in case onafterprint never fires
    setTimeout(() => {
      if (!cleaned) cleanup();
    }, 120000);

    // Called directly within user gesture context
    window.print();
  });
}
