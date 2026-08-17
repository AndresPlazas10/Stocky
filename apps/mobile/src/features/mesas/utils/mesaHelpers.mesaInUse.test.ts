import { describe, expect, it } from 'vitest';
import { mesaInUseMessage, MESA_IN_USE_MESSAGE } from './mesaHelpers';

describe('mesaInUseMessage — nombre real en "mesa en uso" (móvil)', () => {
  it('muestra el nombre real del usuario que tiene la mesa', () => {
    expect(mesaInUseMessage('Maria')).toBe('Maria está usando esta mesa.');
    expect(mesaInUseMessage('Administrador')).toBe('Administrador está usando esta mesa.');
  });

  it('cae al mensaje genérico con nombres genéricos', () => {
    expect(mesaInUseMessage('Alguien')).toBe(MESA_IN_USE_MESSAGE);
    expect(mesaInUseMessage('Usuario')).toBe(MESA_IN_USE_MESSAGE);
    expect(mesaInUseMessage('user')).toBe(MESA_IN_USE_MESSAGE);
  });

  it('cae al mensaje genérico sin nombre disponible', () => {
    expect(mesaInUseMessage()).toBe(MESA_IN_USE_MESSAGE);
    expect(mesaInUseMessage(null)).toBe(MESA_IN_USE_MESSAGE);
    expect(mesaInUseMessage('')).toBe(MESA_IN_USE_MESSAGE);
    expect(mesaInUseMessage('   ')).toBe(MESA_IN_USE_MESSAGE);
  });
});
