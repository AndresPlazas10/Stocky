import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MesaOrderFooter } from '../src/components/Dashboard/MesaOrderFooter.jsx';

const defaultProps = {
  orderTotal: 15000,
  orderItemsCount: 3,
  onSave: vi.fn(),
  onPrintKitchen: vi.fn(),
  onCloseOrder: vi.fn(),
};

describe('MesaOrderFooter', () => {
  it('renders total amount', () => {
    render(<MesaOrderFooter {...defaultProps} />);
    expect(screen.getByText('$ 15.000 COP')).toBeTruthy();
  });

  it('calls onSave when Guardar clicked', async () => {
    const onSave = vi.fn();
    render(<MesaOrderFooter {...defaultProps} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onPrintKitchen when clicked', async () => {
    const onPrint = vi.fn();
    render(<MesaOrderFooter {...defaultProps} onPrintKitchen={onPrint} />);
    await userEvent.click(screen.getByRole('button', { name: /imprimir para cocina/i }));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('calls onCloseOrder when clicked', async () => {
    const onClose = vi.fn();
    render(<MesaOrderFooter {...defaultProps} onCloseOrder={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /cerrar orden/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables print and close buttons when empty order', () => {
    render(<MesaOrderFooter {...defaultProps} orderTotal={0} orderItemsCount={0} />);
    expect(screen.getByRole('button', { name: /imprimir para cocina/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cerrar orden/i })).toBeDisabled();
  });
});
