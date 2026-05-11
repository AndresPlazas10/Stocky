import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrintReceiptConfirmModal } from '../src/components/ui/PrintReceiptConfirmModal.jsx';

describe('PrintReceiptConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PrintReceiptConfirmModal
        isOpen={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('renders modal when open', () => {
    render(
      <PrintReceiptConfirmModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/Imprimir comprobante/i)).toBeTruthy();
  });

  it('shows customer name input', () => {
    render(
      <PrintReceiptConfirmModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        customerName="Juan Pérez"
      />
    );
    const input = screen.getByDisplayValue('Juan Pérez');
    expect(input).toBeTruthy();
    expect(input).toHaveProperty('placeholder', 'Venta general');
  });

  it('calls onCustomerNameChange on input change', async () => {
    const onChange = vi.fn();
    render(
      <PrintReceiptConfirmModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        customerName=""
        onCustomerNameChange={onChange}
      />
    );
    const input = screen.getByPlaceholderText('Venta general');
    await userEvent.type(input, 'M');
    expect(onChange).toHaveBeenCalledWith('M');
  });

  it('calls onCancel when No clicked', async () => {
    const onCancel = vi.fn();
    render(
      <PrintReceiptConfirmModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Imprimir button clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <PrintReceiptConfirmModal
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /sí, imprimir/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading', () => {
    render(
      <PrintReceiptConfirmModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    );
    expect(screen.getByRole('button', { name: /^no$/i })).toBeDisabled();
  });
});
