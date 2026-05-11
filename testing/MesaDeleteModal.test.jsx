import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MesaDeleteModal } from '../src/components/Dashboard/MesaDeleteModal.jsx';

describe('MesaDeleteModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MesaDeleteModal isOpen={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.textContent).toBe('');
  });

  it('renders modal when open', () => {
    render(
      <MesaDeleteModal isOpen={true} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText(/Confirmar Eliminación/i)).toBeTruthy();
  });

  it('shows warning message', () => {
    render(
      <MesaDeleteModal isOpen={true} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText(/seguro de que deseas eliminar/i)).toBeTruthy();
  });

  it('calls onCancel when Cancel clicked', async () => {
    const onCancel = vi.fn();
    render(
      <MesaDeleteModal isOpen={true} onCancel={onCancel} onConfirm={vi.fn()} />
    );
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Delete clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <MesaDeleteModal isOpen={true} onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    await userEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
