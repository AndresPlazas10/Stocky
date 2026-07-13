import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StockyModal } from '../../../ui/StockyModal';
import { configuracionStyles as styles } from '../configuracionStyles';

interface DeleteAccountModalProps {
  visible: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({
  visible,
  deleting,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const { t } = useTranslation();
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      sheetStyle={styles.deleteAccountSheet}
      onClose={onClose}
      headerSlot={
        <LinearGradient
          colors={['#FEE2E2', '#FECACA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.deleteAccountHeader}
        >
          <View style={styles.deleteAccountHeaderIcon}>
            <Ionicons name="alert-circle-outline" size={22} color="#B91C1C" />
          </View>
          <View>
            <Text style={styles.deleteAccountTitle}>
              {t('configuracion.deleteAccountModal.title')}
            </Text>
            <Text style={styles.deleteAccountSubtitle}>
              {t('configuracion.deleteAccountModal.subtitle')}
            </Text>
          </View>
        </LinearGradient>
      }
      footerStyle={styles.deleteAccountFooter}
      footer={
        <View style={styles.deleteAccountFooterRow}>
          <Pressable
            style={[styles.deleteAccountCancel, deleting && styles.disabled]}
            onPress={onClose}
            disabled={deleting}
          >
            <Text style={styles.deleteAccountCancelText}>
              {t('configuracion.deleteAccountModal.cancel')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.deleteAccountConfirm, deleting && styles.disabled]}
            onPress={onConfirm}
            disabled={deleting}
          >
            <Text style={styles.deleteAccountConfirmText}>
              {deleting
                ? t('configuracion.deleteAccountModal.deleting')
                : t('configuracion.deleteAccountModal.confirm')}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.deleteAccountBody}>
        <Text style={styles.deleteAccountBodyText}>
          {t('configuracion.deleteAccountModal.warning')}
        </Text>
        <Text style={styles.deleteAccountBodyText}>
          {t('configuracion.deleteAccountModal.confirmPrompt')}
        </Text>
      </View>
    </StockyModal>
  );
}
