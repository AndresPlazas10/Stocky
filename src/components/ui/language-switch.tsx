import { useTranslation } from 'react-i18next';

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLang === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-medium text-primary-700 transition-all duration-200 hover:bg-primary-50 hover:border-primary-300"
      aria-label={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <span className="text-sm">{currentLang === 'es' ? '🇪🇸' : '🇺🇸'}</span>
      <span>{currentLang === 'es' ? 'ES' : 'EN'}</span>
    </button>
  );
}
