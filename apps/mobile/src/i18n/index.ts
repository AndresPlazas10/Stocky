import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, defaultNS, fallbackLng, ns } from '@stocky/shared/i18n';

i18n.use(initReactI18next).init({
  resources,
  lng: 'es',
  fallbackLng,
  defaultNS,
  ns,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
