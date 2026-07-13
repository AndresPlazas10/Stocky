import i18next from 'i18next';
import { COMBO_STATUS, type ComboRecord, type ComboStatus } from '../../services/combosService';

export type ComboStatusFilter = 'all' | ComboStatus;

export type ComboFormItemState = {
  productoId: string;
  cantidad: string;
};

export type ComboFormState = {
  nombre: string;
  precioVenta: string;
  descripcion: string;
  estado: ComboStatus;
  items: ComboFormItemState[];
};

export const EMPTY_FORM_ITEM: ComboFormItemState = {
  productoId: '',
  cantidad: '1',
};

export function createInitialForm(): ComboFormState {
  return {
    nombre: '',
    precioVenta: '',
    descripcion: '',
    estado: COMBO_STATUS.ACTIVE,
    items: [{ ...EMPTY_FORM_ITEM }],
  };
}

export function normalizeRole(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function normalizeStatus(value: unknown): ComboStatus {
  return String(value || '')
    .trim()
    .toLowerCase() === COMBO_STATUS.INACTIVE
    ? COMBO_STATUS.INACTIVE
    : COMBO_STATUS.ACTIVE;
}

export function parseComboMoneyText(value: string): number {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, '');
  if (!raw) return NaN;
  if (raw.includes(',')) {
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ''));
  }
  return Number(raw.replace(/,/g, ''));
}

export function formatComboStatusLabel(status: ComboStatus): string {
  return status === COMBO_STATUS.ACTIVE
    ? i18next.t('combos.status.active')
    : i18next.t('combos.status.inactive');
}

export function buildComboCompositionText(combo: ComboRecord): string {
  const items = Array.isArray(combo.combo_items) ? combo.combo_items : [];
  if (items.length === 0) return i18next.t('combos.card.noProducts');

  const text = items
    .map((item) => `${item.cantidad} x ${item.product?.name || i18next.t('form.product')}`)
    .join(', ');

  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}
