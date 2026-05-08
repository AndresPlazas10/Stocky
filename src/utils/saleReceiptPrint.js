import { getThermalPaperWidthMm } from './printer.js';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate } from './receiptTemplate.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

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

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.zIndex = '99999';
    iframe.style.background = '#fff';
    iframe.name = 'stocky-print-frame';

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Comprobante #${sale.id}</title>
            <style>
              @page {
                size: ${printerWidthMm}mm auto;
                margin: 2mm;
              }
              * {
                color: #000 !important;
                border-color: #000 !important;
                box-sizing: border-box;
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 16px;
                line-height: 1.45;
                width: ${printerWidthMm}mm;
                max-width: ${printerWidthMm}mm;
                margin: 0;
                padding: 0;
                background: #fff;
                color: #000;
                font-weight: 700;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .receipt { width: 100%; padding: 2mm; }
              .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
              .header h1 { font-size: 22px; margin: 0 0 4px 0; font-weight: bold; }
              .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 15px; font-weight: 700; gap: 8px; }
              .separator { border-top: 1px dashed #000; margin: 8px 0; }
              .items-header { display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #000; padding: 4px 0; font-size: 15px; }
              .item { display: flex; justify-content: space-between; margin: 4px 0; font-size: 15px; font-weight: 700; }
              .item-name { flex: 1; padding-right: 4px; }
              .item-qty { width: 46px; text-align: center; font-variant-numeric: tabular-nums; }
              .item-price { width: 90px; text-align: right; font-variant-numeric: tabular-nums; }
              .total { margin-top: 10px; border-top: 2px solid #000; padding-top: 8px; font-size: 21px; font-weight: bold; display: flex; justify-content: space-between; }
              .footer { text-align: center; margin-top: 12px; padding-top: 8px; border-top: 2px dashed #000; font-size: 13px; font-weight: 700; }
            </style>
          </head>
          <body onload="window.print()" onafterprint="setTimeout(function(){ var f = document.getElementById('__stocky_print_frame__'); if(f) f.remove(); }, 200)">
            <div class="receipt">
              <div class="header">
                <h1>${escapeHtml(receipt.header.title)}</h1>
                <p>${escapeHtml(receipt.header.businessName)}</p>
                <p>${escapeHtml(receipt.header.dateText)}</p>
              </div>
              ${receipt.metadata.map((row) => `
                <div class="row"><span><strong>${escapeHtml(row.label)}:</strong></span><span>${escapeHtml(row.value)}</span></div>
              `).join('')}
              <div class="separator"></div>
              <div class="items-header">
                <span style="flex:1">Producto</span>
                <span class="item-qty">Cant.</span>
                <span class="item-price">Total</span>
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
                <span>TOTAL:</span>
                <span>${escapeHtml(receipt.totals.totalText)}</span>
              </div>
              <div class="footer">
                <p><strong>Método:</strong> ${escapeHtml(receipt.payment.methodText)}</p>
                <p>${escapeHtml(receipt.footer.message)}</p>
              </div>
            </div>
          </body>
          </html>
        `);
        doc.close();
        resolve({ ok: true });
      } catch (err) {
        iframe.remove();
        resolve({ ok: false, error: 'Error al preparar la impresión.' });
      }
    };

    document.body.appendChild(iframe);
  });
}
