import { describe, expect, it } from 'vitest';
import { getMesaInUseMessage } from '@/components/Dashboard/mesas/mesaHelpers';

function t(key, options) {
  if (key === 'mesas:defaults.mesaInUseByUser') return `${options?.name} está usando esta mesa.`;
  if (key === 'mesas:defaults.someoneUsingTable') return 'Alguien está usando esta mesa.';
  return key;
}

describe('getMesaInUseMessage — nombre real en "mesa en uso" (web)', () => {
  it('muestra el nombre real del usuario que tiene la mesa', () => {
    expect(getMesaInUseMessage(t, 'Maria')).toBe('Maria está usando esta mesa.');
    expect(getMesaInUseMessage(t, 'Administrador')).toBe('Administrador está usando esta mesa.');
  });

  it('cae al mensaje genérico con nombres genéricos', () => {
    expect(getMesaInUseMessage(t, 'Alguien')).toBe('Alguien está usando esta mesa.');
    expect(getMesaInUseMessage(t, 'Usuario')).toBe('Alguien está usando esta mesa.');
    expect(getMesaInUseMessage(t, 'user')).toBe('Alguien está usando esta mesa.');
  });

  it('cae al mensaje genérico sin nombre disponible', () => {
    expect(getMesaInUseMessage(t)).toBe('Alguien está usando esta mesa.');
    expect(getMesaInUseMessage(t, null)).toBe('Alguien está usando esta mesa.');
    expect(getMesaInUseMessage(t, '')).toBe('Alguien está usando esta mesa.');
    expect(getMesaInUseMessage(t, '   ')).toBe('Alguien está usando esta mesa.');
  });
});
