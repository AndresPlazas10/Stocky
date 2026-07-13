import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { configuracionStyles as styles } from '../configuracionStyles';

interface LegalSectionProps {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenDeleteAccountInfo: () => void;
}

export function LegalSection({
  onOpenTerms,
  onOpenPrivacy,
  onOpenDeleteAccountInfo,
}: LegalSectionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.legalCard}>
      <View style={styles.legalHeader}>
        <View style={styles.legalHeaderIcon}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#D1D5DB" />
        </View>
        <View style={styles.legalHeaderTextWrap}>
          <Text style={styles.legalHeaderTitle}>{t('configuracion.legal.title')}</Text>
          <Text style={styles.legalHeaderSubtitle}>{t('configuracion.legal.subtitle')}</Text>
        </View>
      </View>
      <View style={styles.legalBody}>
        <Pressable style={styles.legalButton} onPress={onOpenTerms}>
          <View style={styles.legalButtonIcon}>
            <Ionicons name="document-text-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.legalButtonTextWrap}>
            <Text style={styles.legalButtonTitle}>{t('configuracion.legal.terms')}</Text>
            <Text style={styles.legalButtonSubtitle}>
              {t('configuracion.legal.termsDescription')}
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#2563EB" />
        </Pressable>

        <Pressable style={styles.legalButton} onPress={onOpenPrivacy}>
          <View style={styles.legalButtonIcon}>
            <Ionicons name="lock-closed-outline" size={20} color="#0F766E" />
          </View>
          <View style={styles.legalButtonTextWrap}>
            <Text style={styles.legalButtonTitle}>{t('configuracion.legal.privacy')}</Text>
            <Text style={styles.legalButtonSubtitle}>
              {t('configuracion.legal.privacyDescription')}
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#0F766E" />
        </Pressable>

        <Pressable style={styles.legalButton} onPress={onOpenDeleteAccountInfo}>
          <View style={styles.legalButtonIcon}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </View>
          <View style={styles.legalButtonTextWrap}>
            <Text style={styles.legalButtonTitle}>{t('configuracion.legal.deleteAccount')}</Text>
            <Text style={styles.legalButtonSubtitle}>
              {t('configuracion.legal.deleteAccountDescription')}
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#DC2626" />
        </Pressable>
      </View>
    </View>
  );
}
