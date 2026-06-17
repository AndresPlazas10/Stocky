import { Pressable, Text, View } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { empleadosStyles as s } from '../empleadosStyles';

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
      title="Credenciales generadas"
      onClose={onClose}
      footer={
        <View style={s.modalFooterRow}>
          <Pressable style={s.modalSaveButton} onPress={onClose}>
            <Text style={s.modalSaveText}>Entendido</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={s.credentialsTitle}>
        Comparte estas credenciales con {credentials?.fullName || 'el empleado'}:
      </Text>
      <View style={s.credentialsCard}>
        <Text style={s.credentialsLabel}>Usuario</Text>
        <Text style={s.credentialsValue}>{credentials?.username || '-'}</Text>
      </View>
      <View style={s.credentialsCard}>
        <Text style={s.credentialsLabel}>Contraseña</Text>
        <Text style={s.credentialsValue}>{credentials?.password || '-'}</Text>
      </View>
    </StockyModal>
  );
}
