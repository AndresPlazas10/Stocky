import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { InfoItem } from './InfoItem';
import { SectionHeader } from './SectionHeader';
import { configuracionStyles as styles } from '../configuracionStyles';

interface UserSectionProps {
  userEmailLabel: string;
  userIdLabel: string;
  profileLabel: string;
  signingOut: boolean;
  deletingAccount: boolean;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export function UserSection({
  userEmailLabel,
  userIdLabel,
  profileLabel,
  signingOut,
  deletingAccount,
  onSignOut,
  onDeleteAccount,
}: UserSectionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionCard}>
      <SectionHeader
        icon="person-outline"
        title={t('configuracion.user.title')}
        subtitle={t('configuracion.user.subtitle')}
      />
      <View style={styles.sectionBody}>
        <InfoItem
          icon="mail-outline"
          label={t('configuracion.user.email')}
          value={userEmailLabel}
        />
        <InfoItem
          icon="shield-outline"
          label={t('configuracion.user.userId')}
          value={userIdLabel}
        />
        <InfoItem
          icon="person-circle-outline"
          label={t('configuracion.user.profile')}
          value={profileLabel}
        />

        <Pressable
          style={[styles.signOutButton, signingOut && styles.disabled]}
          onPress={onSignOut}
          disabled={signingOut}
        >
          <Ionicons name="log-out-outline" size={24} color="#B91C1C" />
          <Text style={styles.signOutText}>
            {signingOut ? t('configuracion.user.signingOut') : t('configuracion.user.signOut')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.deleteAccountButton, deletingAccount && styles.disabled]}
          onPress={onDeleteAccount}
          disabled={deletingAccount}
        >
          <Ionicons name="trash-outline" size={22} color="#DC2626" />
          <Text style={styles.deleteAccountText}>{t('configuracion.user.deleteAccount')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
