import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppToast, MAX_VISIBLE_TOASTS } from '@/hooks/useAppToast';

function Harness() {
  const toast = useAppToast();
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
});
