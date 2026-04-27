import { formatDateTimeTicket, formatPrice } from './formatters.js';
import { getThermalPaperWidthMm } from './printer.js';

const getPaymentMethodLabel = (method) => {
  if (method === 'cash') return '💵 Efectivo';
  if (method === 'card') return '💳 Tarjeta';
  if (method === 'transfer') return '🏦 Transferencia';
  if (method === 'mixed') return '🔀 Mixto';
  if (method === 'nequi') return '🏦 Nequi';
  if (method === 'bancolombia') return '🏦 Bancolombia';
  if (method === 'banco_bogota') return '🏦 Banco de Bogotá';
  if (method === 'nu') return '🏦 Nu';
  if (method === 'davivienda') return '🏦 Davivienda';
  return String(method || 'No especificado');
};

const getSaleDetailDisplayName = (detail) => (
  detail?.products?.name
  || detail?.combos?.nombre
  || detail?.combos?.name
  || detail?.product_name
  || 'Item'
);

export function printSaleReceipt({ sale, saleDetails = [], sellerName = 'Empleado' }) {
  if (!sale?.id) {
    return { ok: false, error: 'No se pudo imprimir: venta sin id.' };
  }

  if (!Array.isArray(saleDetails) || saleDetails.length === 0) {
    return { ok: false, error: 'No se pudo imprimir: la venta no tiene items.' };
  }

  const printerWidthMm = getThermalPaperWidthMm();
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comprobante #${sale.id}</title>
      <style>
        @media print {
          @page {
            size: ${printerWidthMm}mm auto;
            margin: 2mm;
          }
          html, body {
            width: ${printerWidthMm}mm !important;
            margin: 0;
            padding: 0;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        * {
          color: #000 !important;
          border-color: #000 !important;
        }

        body {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          line-height: 1.45;
          width: ${printerWidthMm}mm;
          max-width: ${printerWidthMm}mm;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-weight: 700;
        }

        .receipt {
          width: 100%;
          padding: 2mm;
          box-sizing: border-box;
        }

        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }

        .header h1 {
          font-size: 22px;
          margin: 0 0 4px 0;
          font-weight: bold;
        }

        .row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: 15px;
          font-weight: 700;
          gap: 8px;
        }

        .separator {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .items-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          border-bottom: 1px solid #000;
          padding: 4px 0;
          font-size: 15px;
        }

        .item {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 15px;
          font-weight: 700;
        }

        .item-name { flex: 1; padding-right: 4px; }
        .item-qty { width: 46px; text-align: center; font-variant-numeric: tabular-nums; }
        .item-price { width: 90px; text-align: right; font-variant-numeric: tabular-nums; }

        .total {
          margin-top: 10px;
          border-top: 2px solid #000;
          padding-top: 8px;
          font-size: 21px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
        }

        .footer {
          text-align: center;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 2px dashed #000;
          font-size: 13px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>COMPROBANTE DE VENTA</h1>
          <p>Sistema Stocky</p>
          <p>${formatDateTimeTicket(sale.created_at || new Date())}</p>
        </div>

        <div class="row"><span><strong>Comprobante:</strong></span><span>CPV-${String(sale.id).substring(0, 8).toUpperCase()}</span></div>
        <div class="row"><span><strong>Vendedor:</strong></span><span>${String(sellerName || 'Empleado')}</span></div>
        <div class="row"><span><strong>Cliente:</strong></span><span>Venta general</span></div>

        <div class="separator"></div>

        <div class="items-header">
          <span style="flex:1">Producto</span>
          <span class="item-qty">Cant.</span>
          <span class="item-price">Total</span>
        </div>

        ${saleDetails.map((item) => `
          <div class="item">
            <div class="item-name">${getSaleDetailDisplayName(item)}</div>
            <div class="item-qty">x${Number(item?.quantity || 0)}</div>
            <div class="item-price">${formatPrice(item?.subtotal ?? ((Number(item?.quantity || 0) * Number(item?.unit_price || 0)) || 0))}</div>
          </div>
        `).join('')}

        <div class="total">
          <span>TOTAL:</span>
          <span>${formatPrice(Number(sale.total || 0))}</span>
        </div>

        <div class="footer">
          <p><strong>Método:</strong> ${getPaymentMethodLabel(sale.payment_method)}</p>
          <p>¡Gracias por su compra!</p>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 100);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=300,height=700');
  if (!printWindow) {
    return { ok: false, error: 'No se pudo abrir la ventana de impresión.' };
  }

  printWindow.document.write(printContent);
  printWindow.document.close();
  return { ok: true };
}
