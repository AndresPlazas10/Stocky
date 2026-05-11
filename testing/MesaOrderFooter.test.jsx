import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MesaOrderFooter } from '../src/components/Dashboard/MesaOrderFooter.jsx';

describe('MesaOrderFooter', () => {
  it('renders total amount', () => {
    render(
      <MesaOrderFooter
        orderTotal={15000}
        orderItemsCount={3}
        isOrderItemsSyncing={false}
        onSave={vi.fn()}
        onPrintKitchen={vi.fn()}
        onCloseOrder={vi.fn()}
      />
    );
    expect(screen.getByText('$15.000')).toBeTruthy();
  });

  it('calls onSave when Guardar clicked', async () => {
    const onSave = vi.fn();
    render(
      <MesaOrderFooter
        orderTotal={15000}
        orderItemsCount={3}
        isOrderItemsSyncing={false}
        onSave={onSave}
        onPrintKitchen={vi.fn()}
        onCloseOrder={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onPrintKitchen when clicked', async () => {
    const onPrint = vi.fn();
    render(
      <MesaOrderFooter
        orderTotal={15000}
        orderItemsCount={3}
        isOrderItemsSyncing={false}
        onSave={vi.fn()}
        onPrintKitchen={onPrint}
        onCloseOrder={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /imprimir para cocina/i }));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('calls onCloseOrder when clicked', async () => {
    const onClose = vi.fn();
    render(
      <MesaOrderFooter
        orderTotal={15000}
        orderItemsCount={3}
        isOrderItemsSyncing={false}
        onSave={vi.fn()}
        onPrintKitchen={vi.fn()}
        onCloseOrder={onClose}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /cerrar orden/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables print and close buttons when empty order', () => {
    render(
      <MesaOrderFooter
        orderTotal={0}
        orderItemsCount={0}
        isOrderItemsSyncing={false}
        onSave={vi.fn()}
        onPrintKitchen={vi.fn()}
        onCloseOrder={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /imprimir para cocina/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cerrar orden/i })).toBeDisabled();
  });

  it('disables Guardar when syncing', () => {
    render(
      <MesaOrderFooter
        orderTotal={15000}
        orderItemsCount={3}
        isOrderItemsSyncing={true}
        onSave={vi.fn()}
        onPrintKitchen={vi.fn()}
        onCloseOrder={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /sincronizando/i })).toBeDisabled();
  });
});
