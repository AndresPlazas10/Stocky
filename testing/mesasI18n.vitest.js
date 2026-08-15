import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import { resources, defaultNS, ns } from '@stocky/shared/i18n';

describe('i18n mesas (regresión de notación de namespace)', () => {
  it('resuelve las claves de error de catálogo/combos con dos puntos (mesas:)', () => {
    i18n.init({
      resources,
      lng: 'es',
      fallbackLng: 'es',
      defaultNS,
      ns,
      interpolation: { escapeValue: false },
      initImmediate: false,
    });
    const translated = i18n.t('mesas:errors.loadCatalogFailed');
    expect(translated).not.toBe('mesas:errors.loadCatalogFailed');
    expect(translated.length).toBeGreaterThan(0);
    expect(translated).not.toMatch(/^mesas\.errors/);

    const combos = i18n.t('mesas:errors.loadCombosFailed');
    expect(combos).not.toBe('mesas:errors.loadCombosFailed');
    expect(combos.length).toBeGreaterThan(0);
  });

  it('las claves toast de cocina existen en ambos idiomas', () => {
    for (const lng of ['es', 'en']) {
      i18n.changeLanguage(lng);
      for (const key of [
        'mesas:toast.newOrder.title',
        'mesas:toast.updatedOrder.title',
        'mesas:labels.mostRecentOrder',
        'mesas:empty.noPendingOrders',
      ]) {
        const value = i18n.t(key);
        expect(value, `${lng} ${key}`).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
