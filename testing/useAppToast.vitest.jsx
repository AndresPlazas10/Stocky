import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppToast, MAX_VISIBLE_TOASTS } from '@/hooks/useAppToast';

function Harness({ large = false } = {}) {
  const toast = useAppToast({ large });
  return (
    <>
      <toast.ToastComponent />
      <button onClick={() => toast.showInfo('Info toast', 'Mensaje')}>show</button>
      <button onClick={() => toast.showInfo('Corto', 'x', 1000)}>showShort</button>
      <button onClick={() => toast.showInfo('Largo', 'x', 10000)}>showLong</button>
      <button onClick={() => toast.hideToast()}>hide</button>
    </>
  );
}

describe('useAppToast — apilado de toasts', () => {
  it('apila varios toasts simultáneos (uno debajo de otro)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('show'));
    await user.click(screen.getByText('show'));
    await user.click(screen.getByText('show'));

    expect(screen.getAllByRole('alert').length).toBe(3);
  });

  it('respeta la duración individual de cada toast (no resetea los demás)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('showShort'));
    await user.click(screen.getByText('showLong'));

    expect(screen.getByText('Corto')).toBeTruthy();
    expect(screen.getByText('Largo')).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });

    expect(screen.queryByText('Corto')).toBeNull();
    expect(screen.getByText('Largo')).toBeTruthy();
  });

  it('no excede el tope MAX_VISIBLE_TOASTS (descarta el más viejo)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    for (let i = 0; i < MAX_VISIBLE_TOASTS + 2; i++) {
      await user.click(screen.getByText('show'));
    }

    expect(screen.getAllByRole('alert').length).toBe(MAX_VISIBLE_TOASTS);
  });

  it('hideToast() cierra el toast más reciente', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('show'));
    await user.click(screen.getByText('show'));
    await user.click(screen.getByText('hide'));

    expect(screen.getAllByRole('alert').length).toBe(1);
  });

  describe('tamaño large (cocina web)', () => {
    it('con large: el stack de toasts escala 1.5x', async () => {
      const user = userEvent.setup();
      render(<Harness large />);

      await user.click(screen.getByText('show'));

      const stack = document.querySelector('[data-testid="toast-stack"]');
      expect(stack.className).toContain('scale-[1.5]');
      expect(stack.className).toContain('origin-top');
    });

    it('por defecto: el stack NO escala (el resto de toasts quedan igual)', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByText('show'));

      const stack = document.querySelector('[data-testid="toast-stack"]');
      expect(stack.className).not.toContain('scale-');
      expect(stack.className).not.toContain('origin-top');
    });
  });

  describe('useAppToast — timing independiente por alerta', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('una alerta nueva NO reinicia el timing de la primera', () => {
      render(<Harness />);

      // t=0: alerta corta (1000ms)
      fireEvent.click(screen.getByText('showShort'));
      expect(screen.getByText('Corto')).toBeTruthy();

      // t=400ms: llega una segunda alerta (no debe tocar el timer de la primera)
      act(() => {
        vi.advanceTimersByTime(400);
      });
      fireEvent.click(screen.getByText('showLong'));

      // t=1300ms: la primera (1000ms + 250ms de salida) ya debe haber expirado;
      // la larga (10000ms) sigue visible.
      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(screen.queryByText('Corto')).toBeNull();
      expect(screen.getByText('Largo')).toBeTruthy();
    });
  });
});
