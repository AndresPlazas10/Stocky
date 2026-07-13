import type { MesaOrderItem } from '../services/mesaOrderService';
import type { VentaDetailRecord, VentaRecord } from '../services/ventasService';
import type { ReceiptLabels } from './receiptLabels';

const DEFAULT_PRINTER_WIDTH_MM = 80;
const PRINT_FONT_SIZES = {
  body: 18,
  header: 28,
  row: 18,
  item: 20,
  total: 26,
  footer: 16,
  qty: 86,
  price: 110,
} as const;

function formatDateTimeTicket(
  timestamp: string | Date | null | undefined,
  invalidDateLabel: string,
) {
  if (!timestamp) return invalidDateLabel;
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return invalidDateLabel;
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
    return invalidDateLabel;
  }
}

function formatPrice(value: number | null | undefined, includeCurrency = true) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return includeCurrency ? '$0' : '0';
  }

  const numValue = Number(value);
  const [integerPart, decimalPart] = numValue.toFixed(2).split('.');

  let formattedInteger = integerPart;
  if (integerPart.length > 6) {
    const millions = integerPart.slice(0, -6);
    const remainder = integerPart.slice(-6);
    const formattedMillions = millions.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const formattedRemainder = remainder.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    formattedInteger = `${formattedMillions}'${formattedRemainder}`;
  } else {
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  let formattedNumber = formattedInteger;
  if (decimalPart !== '00') {
    formattedNumber = `${formattedInteger},${decimalPart}`;
  }

  return includeCurrency ? `$${formattedNumber}` : formattedNumber;
}

function getPaymentMethodLabel(method: string | null | undefined, notSpecifiedLabel: string) {
  const map: Record<string, string> = {
    cash: '💵 Efectivo',
    card: '💳 Tarjeta',
    transfer: '🏦 Transferencia',
    mixed: '🔀 Mixto',
    nequi: '🏦 Nequi',
    bancolombia: '🏦 Bancolombia',
    banco_bogota: '🏦 Banco de Bogotá',
    nu: '🏦 Nu',
    davivienda: '🏦 Davivienda',
    daviplata: '🏦 Daviplata',
    spei: '🏦 SPEI',
    oxxo: '🏪 OXXO',
    yape: '📱 Yape',
    plin: '📱 Plin',
    mercadopago: '💳 Mercado Pago',
    venmo: '💙 Venmo',
    cashapp: '💚 Cash App',
    zelle: '💎 Zelle',
  };
  return map[String(method || '')] || String(method || notSpecifiedLabel);
}

function getSaleDetailDisplayName(detail: VentaDetailRecord) {
  return detail?.products?.name || detail?.combos?.nombre || 'Item';
}

export function buildSaleReceiptHtml({
  sale,
  saleDetails,
  sellerName,
  printerWidthMm = DEFAULT_PRINTER_WIDTH_MM,
  customerName,
  businessName,
  labels,
}: {
  sale: VentaRecord;
  saleDetails: VentaDetailRecord[];
  sellerName?: string | null;
  printerWidthMm?: number;
  customerName?: string;
  businessName?: string;
  labels: ReceiptLabels;
}) {
  const safeSeller = String(sellerName || labels.sellerDefault);
  const printableItems = Array.isArray(saleDetails) ? saleDetails : [];
  const safeCustomer = String(customerName || labels.customerDefault);
  const safeBusiness = String(businessName || labels.kitchenSystem);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${labels.receiptNumber} #${sale.id}</title>
      <style>
        * {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          text-shadow: none !important;
          box-shadow: none !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media print {
          @page {
            size: ${printerWidthMm}mm auto;
            margin: 0;
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
          font-size: ${PRINT_FONT_SIZES.body}px;
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
          padding: 1mm 0;
          box-sizing: border-box;
        }

        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }

        .header h1 {
          font-size: ${PRINT_FONT_SIZES.header}px;
          margin: 0 0 4px 0;
          font-weight: bold;
        }

        .row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: ${PRINT_FONT_SIZES.row}px;
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
          font-size: ${PRINT_FONT_SIZES.row}px;
        }

        .item {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: ${PRINT_FONT_SIZES.item}px;
          font-weight: 700;
        }

        .item-name { flex: 1; padding-right: 4px; }
        .item-qty { width: ${PRINT_FONT_SIZES.qty}px; text-align: center; font-variant-numeric: tabular-nums; }
        .item-price { width: ${PRINT_FONT_SIZES.price}px; text-align: right; font-variant-numeric: tabular-nums; }

        .total {
          margin-top: 10px;
          border-top: 2px solid #000;
          padding-top: 8px;
          font-size: ${PRINT_FONT_SIZES.total}px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
        }

        .footer {
          text-align: center;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 2px dashed #000;
          font-size: ${PRINT_FONT_SIZES.footer}px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>${labels.title}</h1>
          <p>${safeBusiness}</p>
          <p>${formatDateTimeTicket(sale.created_at || new Date(), labels.invalidDate)}</p>
        </div>

        <div class="row"><span><strong>${labels.receiptNumber}:</strong></span><span>CPV-${String(sale.id).substring(0, 8).toUpperCase()}</span></div>
        <div class="row"><span><strong>${labels.seller}:</strong></span><span>${safeSeller}</span></div>
        <div class="row"><span><strong>${labels.customer}:</strong></span><span>${safeCustomer}</span></div>

        <div class="separator"></div>

        <div class="items-header">
          <span style="flex:1">${labels.productHeader}</span>
          <span class="item-qty">${labels.quantityAbbreviation}</span>
          <span class="item-price">${labels.total}</span>
        </div>

        ${printableItems
          .map(
            (item) => `
          <div class="item">
            <div class="item-name">${getSaleDetailDisplayName(item)}</div>
            <div class="item-qty">x${Number(item?.quantity || 0)}</div>
            <div class="item-price">${formatPrice(item?.subtotal ?? (Number(item?.quantity || 0) * Number(item?.unit_price || 0) || 0))}</div>
          </div>
        `,
          )
          .join('')}

        <div class="total">
          <span>${labels.total}:</span>
          <span>${formatPrice(Number(sale.total || 0))}</span>
        </div>

        <div class="footer">
          <p><strong>${labels.method}:</strong> ${getPaymentMethodLabel(sale.payment_method, labels.notSpecified)}</p>
          <p>${labels.footer}</p>
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
  labels,
}: {
  mesaNumber: string | number;
  mesaStatus: 'occupied' | 'available' | string | null | undefined;
  items: MesaOrderItem[];
  createdAt?: string | Date | null;
  printerWidthMm?: number;
  labels: ReceiptLabels;
}) {
  const statusLabel = mesaStatus === 'occupied' ? labels.statusOccupied : labels.statusAvailable;
  const totalUnits = sumOrderItemsQuantity(items);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${labels.kitchenTable}${mesaNumber}</title>
      <style>
        @media print {
          @page {
            size: ${printerWidthMm}mm auto;
            margin: 0;
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
          font-size: ${PRINT_FONT_SIZES.body + 2}px;
          line-height: 1.65;
          font-weight: 700;
          color: #000 !important;
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
          padding: 1mm 0;
          box-sizing: border-box;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
          color: #000;
        }
        
        .header h1 {
          font-size: ${PRINT_FONT_SIZES.header + 6}px;
          margin: 0 0 5px 0;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        
        .header p {
          margin: 2px 0;
          font-size: ${PRINT_FONT_SIZES.row + 2}px;
          font-weight: 700;
        }
        
        .info {
          margin: 10px 0;
          font-size: ${PRINT_FONT_SIZES.item + 3}px;
          font-weight: 700;
        }
        
        .info strong {
          font-weight: 900;
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
          font-weight: 900;
          font-size: ${PRINT_FONT_SIZES.item + 4}px;
          line-height: 1.35;
          color: #000;
        }
        
        .item-qty {
          width: ${PRINT_FONT_SIZES.qty + 10}px;
          text-align: right;
          font-size: ${PRINT_FONT_SIZES.item + 4}px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          color: #000;
        }
        
        .total {
          display: none;
        }
        
        .footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 10px;
          border-top: 2px dashed #000;
          font-size: ${PRINT_FONT_SIZES.footer + 2}px;
          font-weight: 800;
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
        <h1>${labels.kitchenTitle}</h1>
        <p>${labels.kitchenTable}${mesaNumber}</p>
        <p>${formatDateTimeTicket(createdAt || new Date(), labels.invalidDate)}</p>
      </div>
      
      <div class="info">
        <p><strong>${labels.statusOccupied === statusLabel ? labels.statusOccupied : labels.statusAvailable}:</strong> ${statusLabel}</p>
        <p><strong>${labels.itemsLabel}:</strong> ${totalUnits} item${totalUnits !== 1 ? 's' : ''}</p>
      </div>
      
      <div class="separator"></div>
      
      <div class="items">
        ${(Array.isArray(items) ? items : [])
          .map(
            (item) => `
          <div class="item">
            <div class="item-name">${item?.products?.name || item?.combos?.nombre || 'Item'}</div>
            <div class="item-qty">x${Number(item?.quantity || 0)}</div>
          </div>
        `,
          )
          .join('')}
      </div>
      
      <div class="total">
        ${labels.total}: 0
      </div>
      
      <div class="footer">
        <p>${labels.kitchenFooter}</p>
        <p>${labels.kitchenSystem}</p>
      </div>
      </div>
    </body>
    </html>
  `;
}
