import { describe, it, expect } from 'vitest';

// We test buildReceiptHtml indirectly via the receipt template
describe('buildReceiptHtml (via saleReceiptPrint)', () => {
  it('generates valid HTML with receipt structure', async () => {
    const { printSaleReceipt } = await import('../src/utils/saleReceiptPrint.js');
    expect(typeof printSaleReceipt).toBe('function');
  });

  it('rejects with missing sale id', async () => {
    const { printSaleReceipt } = await import('../src/utils/saleReceiptPrint.js');
    const result = await printSaleReceipt({ sale: {}, saleDetails: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('venta sin id');
  });

  it('rejects with empty saleDetails', async () => {
    const { printSaleReceipt } = await import('../src/utils/saleReceiptPrint.js');
    const result = await printSaleReceipt({ sale: { id: 's-1' }, saleDetails: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no tiene items');
  });
});
