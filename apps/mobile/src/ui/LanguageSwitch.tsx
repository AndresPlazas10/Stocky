import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS } from '../theme/tokens';

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLang === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <Pressable
      onPress={toggleLanguage}
      style={styles.container}
      accessibilityLabel={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <Text style={styles.flag}>{currentLang === 'es' ? '🇪🇸' : '🇺🇸'}</Text>
      <Text style={styles.text}>{currentLang === 'es' ? 'ES' : 'EN'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(7, 87, 91, 0.08)',
  },
  flag: {
    fontSize: 16,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: STOCKY_COLORS.primary700,
  },
});
