import type { MesaOrderItem } from '../../../services/mesaOrderService';

export function buildOrderSignature(items: MesaOrderItem[], notes: string): string {
  const itemSignature = (Array.isArray(items) ? items : [])
    .map((item) => {
      const productId = String(item?.product_id || '').trim();
      const comboId = String(item?.combo_id || '').trim();
      const identity = productId || comboId;
      const quantity = Number.isFinite(Number(item?.quantity)) ? Number(item?.quantity) : 0;
      return `${identity}:${quantity}`;
    })
    .sort()
    .join('|');
  return `${itemSignature}::${String(notes || '').trim()}`;
}
