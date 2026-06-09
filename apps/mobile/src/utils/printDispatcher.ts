import * as Print from 'expo-print';
import { buildSaleReceiptHtml } from '../utils/printTemplates';
import { buildSaleEscPos, type SaleReceipt } from '../services/escposService';
import { getSavedPrinter, printBytes } from '../services/bluetoothPrinterService';
import { getThermalPaperWidthMm } from '../utils/printer';
import type { VentaDetailRecord, VentaRecord } from '../services/ventasService';

function buildReceiptForEscPos(opts: {
  sale: VentaRecord;
  saleDetails: VentaDetailRecord[];
  customerName?: string;
  businessName?: string;
}): SaleReceipt {
  const { sale, saleDetails, customerName, businessName } = opts;
  const items = Array.isArray(saleDetails) ? saleDetails : [];

  const fmtPrice = (v: number) => `$${v.toLocaleString('es-CO')}`;
  const fmtDate = (ts: string | Date) => {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let h = d.getHours();
    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12 || 12;
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${h}:${mins} ${ampm}`;
  };
  const methodLabel = (m?: string | null) => {
    const map: Record<string, string> = {
      cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia',
      mixed: 'Mixto', nequi: 'Nequi', bancolombia: 'Bancolombia',
      banco_bogota: 'Banco de Bogota', nu: 'Nu', davivienda: 'Davivienda',
    };
    return map[String(m || '')] || m || 'No especificado';
  };

  return {
    type: 'sale',
    version: 1,
    header: {
      title: 'COMPROBANTE',
      businessName: String(businessName || 'Sistema Stocky'),
      dateText: fmtDate(sale.created_at || new Date()),
      alignment: 'center',
    },
    metadata: [
      { label: 'Comprobante', value: `CPV-${String(sale.id).substring(0, 8).toUpperCase()}` },
      { label: 'Vendedor', value: String(sale.seller_name || 'Empleado') },
      { label: 'Cliente', value: String(customerName || 'Venta general') },
    ],
    items: items.map((item) => {
      const qty = Number(item?.quantity || 0);
      const unit = Number(item?.unit_price || 0);
      const sub = Number(item?.subtotal || qty * unit || 0);
      return {
        name: item?.products?.name || item?.combos?.nombre || 'Item',
        quantity: qty,
        unitPrice: unit,
        subtotal: sub,
        subtotalText: fmtPrice(sub),
      };
    }),
    totals: {
      total: Number(sale.total || 0),
      totalText: fmtPrice(Number(sale.total || 0)),
    },
    payment: {
      method: String(sale.payment_method || 'cash'),
      methodText: methodLabel(sale.payment_method),
    },
    footer: {
      message: 'Gracias por su compra',
      alignment: 'center',
    },
  };
}

export async function printSaleReceipt(
  saleRecord: VentaRecord,
  saleDetails: VentaDetailRecord[],
  opts?: { customerName?: string; businessName?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!Array.isArray(saleDetails) || saleDetails.length === 0) {
    return { ok: false, error: 'La venta no tiene items para imprimir.' };
  }

  const savedPrinter = await getSavedPrinter();
  if (savedPrinter) {
    const receipt = buildReceiptForEscPos({
      sale: saleRecord,
      saleDetails,
      customerName: opts?.customerName,
      businessName: opts?.businessName,
    });
    const paperWidthMm = await getThermalPaperWidthMm();
    const escposData = buildSaleEscPos(receipt, paperWidthMm);
    const ok = await printBytes(savedPrinter.address, escposData);
    if (ok) return { ok: true };
    return { ok: false, error: 'No se pudo enviar a la impresora. Verifica la conexion Bluetooth.' };
  }

  try {
    const printerWidthMm = await getThermalPaperWidthMm();
    const html = buildSaleReceiptHtml({
      sale: saleRecord,
      saleDetails,
      sellerName: saleRecord.seller_name,
      printerWidthMm,
      customerName: opts?.customerName,
      businessName: opts?.businessName,
    });
    await Print.printAsync({ html });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al imprimir.' };
  }
}
