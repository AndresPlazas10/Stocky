import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, defaultNS, fallbackLng, ns } from '@stocky/shared/i18n';

const savedLng = typeof window !== 'undefined' ? localStorage.getItem('i18nLng') : null;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLng || 'es',
    fallbackLng,
    defaultNS,
    ns,
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('i18nLng', lng);
  }
});

export default i18n;
