import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';

interface CredentialsModalProps {
  visible: boolean;
  credentials: {
    fullName: string;
    username: string;
    password: string;
  } | null;
  onClose: () => void;
}

export function CredentialsModal({ visible, credentials, onClose }: CredentialsModalProps) {
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={40}
      hideCloseButton
      onClose={onClose}
      sheetStyle={styles.sheet}
      contentContainerStyle={styles.content}
      footerStyle={styles.footer}
      headerSlot={
        <LinearGradient
          colors={['#059669', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="key-outline" size={18} color="#D1FAE5" />
            </View>
            <Text style={styles.headerTitle}>Credenciales generadas</Text>
          </View>
          <Pressable style={styles.headerClose} onPress={onClose}>
            <Ionicons name="close" size={19} color="#D1FAE5" />
          </Pressable>
        </LinearGradient>
      }
      footer={
        <View style={styles.actionsRow}>
          <Pressable style={styles.confirmButton} onPress={onClose}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.confirmText}>Entendido</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.messageCard}>
        <Ionicons name="information-circle-outline" size={16} color="#065F46" />
        <Text style={styles.messageText}>
          Comparte estas credenciales con {credentials?.fullName || 'el empleado'}:
        </Text>
      </View>

      <View style={styles.credentialCard}>
        <View style={styles.credentialIconWrap}>
          <Ionicons name="person-outline" size={16} color="#059669" />
        </View>
        <View style={styles.credentialTextWrap}>
          <Text style={styles.credentialLabel}>Usuario</Text>
          <Text style={styles.credentialValue}>{credentials?.username || '-'}</Text>
        </View>
      </View>

      <View style={styles.credentialCard}>
        <View style={styles.credentialIconWrap}>
          <Ionicons name="lock-closed-outline" size={16} color="#059669" />
        </View>
        <View style={styles.credentialTextWrap}>
          <Text style={styles.credentialLabel}>Contraseña</Text>
          <Text style={styles.credentialValue}>{credentials?.password || '-'}</Text>
        </View>
      </View>
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  content: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#D1FAE5',
    fontSize: 17,
    fontWeight: '800',
  },
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  messageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  credentialCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  credentialIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  credentialLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  credentialValue: {
    color: STOCKY_COLORS.primary900,
    fontSize: 15,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
  },
  confirmButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
