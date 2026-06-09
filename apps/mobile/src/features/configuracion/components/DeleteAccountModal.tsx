import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StockyModal } from '../../../ui/StockyModal';
import { configuracionStyles as styles } from '../configuracionStyles';

interface DeleteAccountModalProps {
  visible: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({ visible, deleting, onClose, onConfirm }: DeleteAccountModalProps) {
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      modalAnimationType="fade"
      sheetStyle={styles.deleteAccountSheet}
      onClose={onClose}
      headerSlot={(
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
            <Text style={styles.deleteAccountTitle}>Eliminar cuenta</Text>
            <Text style={styles.deleteAccountSubtitle}>Esta acción es permanente</Text>
          </View>
        </LinearGradient>
      )}
      footerStyle={styles.deleteAccountFooter}
      footer={(
        <View style={styles.deleteAccountFooterRow}>
          <Pressable
            style={[styles.deleteAccountCancel, deleting && styles.disabled]}
            onPress={onClose}
            disabled={deleting}
          >
            <Text style={styles.deleteAccountCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.deleteAccountConfirm, deleting && styles.disabled]}
            onPress={onConfirm}
            disabled={deleting}
          >
            <Text style={styles.deleteAccountConfirmText}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Text>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.deleteAccountBody}>
        <Text style={styles.deleteAccountBodyText}>
          Al eliminar tu cuenta se revocará tu acceso y los negocios asociados quedarán suspendidos.
        </Text>
        <Text style={styles.deleteAccountBodyText}>
          Si estás seguro, confirma para continuar.
        </Text>
      </View>
    </StockyModal>
  );
}
