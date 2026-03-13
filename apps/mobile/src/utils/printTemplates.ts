import type { MesaOrderItem } from '../services/mesaOrderService';
import type { VentaDetailRecord, VentaRecord } from '../services/ventasService';

const DEFAULT_PRINTER_WIDTH_MM = 80;

function formatDateTimeTicket(timestamp: string | Date | null | undefined) {
  if (!timestamp) return 'Fecha inválida';
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Fecha inválida';
    const datePart = date.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Bogota',
    });
    const timePart = date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    });
    return `${datePart} - ${timePart}`;
  } catch {
    return 'Fecha inválida';
  }
}

function formatPrice(value: number | null | undefined, includeCurrency = true) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return includeCurrency ? '0 COP' : '0';
  }

  const numValue = Number(value);
  const [integerPart, decimalPart] = numValue.toFixed(2).split('.');

  let formattedInteger = integerPart;
  if (integerPart.length > 6) {
    const millions = integerPart.slice(0, -6);
    const remainder = integerPart.slice(-6);
    const formattedMillions = millions.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const formattedRemainder = remainder.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    formattedInteger = `${formattedMillions}'${formattedRemainder}`;
  } else {
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  let formattedNumber = formattedInteger;
  if (decimalPart !== '00') {
    formattedNumber = `${formattedInteger},${decimalPart}`;
  }

  return includeCurrency ? `${formattedNumber} COP` : formattedNumber;
}

function getPaymentMethodLabel(method?: string | null) {
  if (method === 'cash') return '💵 Efectivo';
  if (method === 'card') return '💳 Tarjeta';
  if (method === 'transfer') return '🏦 Transferencia';
  if (method === 'mixed') return '🔀 Mixto';
  return String(method || 'No especificado');
}

function getSaleDetailDisplayName(detail: VentaDetailRecord) {
  return detail?.products?.name || detail?.combos?.nombre || 'Item';
}

export function buildSaleReceiptHtml({
  sale,
  saleDetails,
  sellerName,
  printerWidthMm = DEFAULT_PRINTER_WIDTH_MM,
}: {
  sale: VentaRecord;
  saleDetails: VentaDetailRecord[];
  sellerName?: string | null;
  printerWidthMm?: number;
}) {
  const safeSeller = String(sellerName || 'Empleado');
  const printableItems = Array.isArray(saleDetails) ? saleDetails : [];

  return `
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
          font-size: 12px;
          line-height: 1.35;
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
          font-size: 16px;
          margin: 0 0 4px 0;
          font-weight: bold;
        }

        .row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: 11px;
          font-weight: 700;
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
          font-size: 11px;
        }

        .item {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 11px;
          font-weight: 700;
        }

        .item-name { flex: 1; padding-right: 4px; }
        .item-qty { width: 36px; text-align: center; }
        .item-price { width: 72px; text-align: right; }

        .total {
          margin-top: 10px;
          border-top: 2px solid #000;
          padding-top: 8px;
          font-size: 16px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
        }

        .footer {
          text-align: center;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 2px dashed #000;
          font-size: 10px;
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
        <div class="row"><span><strong>Vendedor:</strong></span><span>${safeSeller}</span></div>
        <div class="row"><span><strong>Cliente:</strong></span><span>Venta general</span></div>

        <div class="separator"></div>

        <div class="items-header">
          <span style="flex:1">Producto</span>
          <span class="item-qty">Cant.</span>
          <span class="item-price">Total</span>
        </div>

        ${printableItems.map((item) => `
          <div class="item">
            <div class="item-name">${getSaleDetailDisplayName(item)}</div>
            <div class="item-qty">x${Number(item?.quantity || 0)}</div>
            <div class="item-price">${formatPrice(item?.subtotal ?? (Number(item?.quantity || 0) * Number(item?.unit_price || 0) || 0))}</div>
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
    </body>
    </html>
  `;
}

function sumOrderItemsQuantity(items: MesaOrderItem[]) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Number(item?.quantity || 0)),
    0,
  );
}

export function buildKitchenOrderHtml({
  mesaNumber,
  mesaStatus,
  items,
  createdAt,
  printerWidthMm = DEFAULT_PRINTER_WIDTH_MM,
}: {
  mesaNumber: string | number;
  mesaStatus: 'occupied' | 'available' | string | null | undefined;
  items: MesaOrderItem[];
  createdAt?: string | Date | null;
  printerWidthMm?: number;
}) {
  const statusLabel = mesaStatus === 'occupied' ? 'Ocupada' : 'Disponible';
  const totalUnits = sumOrderItemsQuantity(items);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orden Mesa ${mesaNumber}</title>
      <style>
        @media print {
          @page {
            size: ${printerWidthMm}mm auto;
            margin: 2mm;
          }
          html, body {
            width: ${printerWidthMm}mm !important;
            height: auto !important;
            margin: 0;
            padding: 0;
          }
          .receipt {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          width: ${printerWidthMm}mm;
          max-width: ${printerWidthMm}mm;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          background: #fff;
        }

        .receipt {
          display: block;
          width: 100%;
          margin: 0;
          padding: 2mm;
          box-sizing: border-box;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        
        .header h1 {
          font-size: 20px;
          margin: 0 0 5px 0;
          font-weight: bold;
        }
        
        .header p {
          margin: 2px 0;
          font-size: 11px;
        }
        
        .info {
          margin: 10px 0;
          font-size: 13px;
        }
        
        .info strong {
          font-weight: bold;
        }
        
        .items {
          margin: 15px 0;
        }
        
        .item {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          padding: 5px 0;
          border-bottom: 1px dashed #ccc;
        }
        
        .item-name {
          flex: 1;
          font-weight: bold;
          font-size: 13px;
        }
        
        .item-qty {
          width: 60px;
          text-align: right;
          font-size: 13px;
          font-weight: bold;
        }
        
        .total {
          display: none;
        }
        
        .footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 10px;
          border-top: 2px dashed #000;
          font-size: 11px;
        }
        
        .separator {
          border-top: 2px dashed #000;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
      <div class="header">
        <h1>ORDEN DE COCINA</h1>
        <p>Mesa #${mesaNumber}</p>
        <p>${formatDateTimeTicket(createdAt || new Date())}</p>
      </div>
      
      <div class="info">
        <p><strong>Estado:</strong> ${statusLabel}</p>
        <p><strong>Productos:</strong> ${totalUnits} item${totalUnits !== 1 ? 's' : ''}</p>
      </div>
      
      <div class="separator"></div>
      
      <div class="items">
        ${(Array.isArray(items) ? items : []).map((item) => `
          <div class="item">
            <div class="item-name">${item?.products?.name || item?.combos?.nombre || 'Item'}</div>
            <div class="item-qty">x${Number(item?.quantity || 0)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="total">
        TOTAL: 0
      </div>
      
      <div class="footer">
        <p>*** ORDEN PARA COCINA ***</p>
        <p>Sistema Stocky</p>
      </div>
      </div>
    </body>
    </html>
  `;
}
