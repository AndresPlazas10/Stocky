import { describe, it, expect } from 'vitest';
import { buildSaleReceiptTemplate, validateSaleReceiptTemplate } from '../src/utils/receiptTemplate.js';

const makeSale = (overrides = {}) => ({
  id: 'sale-123',
  business_id: 'biz-1',
  user_id: 'user-1',
  seller_name: 'Admin',
  payment_method: 'cash',
  total: 15000,
  created_at: '2026-05-08T10:00:00Z',
  ...overrides,
});

const makeDetail = (overrides = {}) => ({
  id: 'detail-1',
  sale_id: 'sale-123',
  product_id: 'prod-1',
  quantity: 2,
  unit_price: 5000,
  subtotal: 10000,
  products: { name: 'Producto A' },
  ...overrides,
});

describe('buildSaleReceiptTemplate', () => {
  it('builds a receipt with required sections', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail()],
      sellerName: 'Admin',
      businessName: 'Mi Tienda',
      customerName: 'Juan Pérez',
    });

    expect(receipt.type).toBe('sale');
    expect(receipt.header.businessName).toBe('Mi Tienda');
    expect(receipt.metadata).toHaveLength(2); // Vendedor, Cliente
    expect(receipt.items).toHaveLength(1);
    expect(receipt.totals.total).toBe(15000);
  });

  it('uses customer name in metadata', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail()],
      customerName: 'María García',
    });

    const clienteMeta = receipt.metadata.find(m => m.label === 'Cliente');
    expect(clienteMeta.value).toBe('María García');
  });

  it('defaults customer to Venta general', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail()],
    });

    const clienteMeta = receipt.metadata.find(m => m.label === 'Cliente');
    expect(clienteMeta.value).toBe('Venta general');
  });

  it('includes voluntary tip in totals', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale({ total: 10000 }),
      saleDetails: [makeDetail()],
      voluntaryTip: { enabled: true, amount: 2000 },
    });

    expect(receipt.totals.voluntaryTip).toBe(2000);
    expect(receipt.totals.total).toBe(12000);
  });

  it('formats payment method label', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale({ payment_method: 'card' }),
      saleDetails: [makeDetail()],
    });

    expect(receipt.payment.methodText).toBe('Tarjeta');
  });

  it('falls back to Sistema Stocky for businessName', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail()],
    });

    expect(receipt.header.businessName).toBe('Sistema Stocky');
  });

  it('generates item name from products.name', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail({ products: { name: 'Café' } })],
    });

    expect(receipt.items[0].name).toBe('Café');
  });

  it('generates item name from combos.nombre', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail({ products: null, combos: { nombre: 'Combo Burger' }, product_id: null })],
    });

    expect(receipt.items[0].name).toBe('Combo Burger');
  });
});

describe('validateSaleReceiptTemplate', () => {
  it('returns ok for valid receipt', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [makeDetail()],
    });

    expect(validateSaleReceiptTemplate(receipt).ok).toBe(true);
  });

  it('fails for null/undefined receipt', () => {
    expect(validateSaleReceiptTemplate(null).ok).toBe(false);
  });

  it('fails with empty items', () => {
    const receipt = buildSaleReceiptTemplate({
      sale: makeSale(),
      saleDetails: [],
    });

    expect(validateSaleReceiptTemplate(receipt).ok).toBe(false);
  });

  it('fails without totals', () => {
    const receipt = { type: 'sale', items: [{ name: 'X' }] };
    expect(validateSaleReceiptTemplate(receipt).ok).toBe(false);
  });
});
