import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  return (
    <View style={styles.sectionCard}>
      <SectionHeader icon="person-outline" title="Información del Usuario" subtitle="Datos de tu cuenta" />
      <View style={styles.sectionBody}>
        <InfoItem icon="mail-outline" label="Email" value={userEmailLabel} />
        <InfoItem icon="shield-outline" label="ID de Usuario" value={userIdLabel} />
        <InfoItem icon="person-circle-outline" label="Perfil" value={profileLabel} />

        <Pressable
          style={[styles.signOutButton, signingOut && styles.disabled]}
          onPress={onSignOut}
          disabled={signingOut}
        >
          <Ionicons name="log-out-outline" size={24} color="#B91C1C" />
          <Text style={styles.signOutText}>{signingOut ? 'Cerrando...' : 'Cerrar Sesión'}</Text>
        </Pressable>

        <Pressable
          style={[styles.deleteAccountButton, deletingAccount && styles.disabled]}
          onPress={onDeleteAccount}
          disabled={deletingAccount}
        >
          <Ionicons name="trash-outline" size={22} color="#DC2626" />
          <Text style={styles.deleteAccountText}>Eliminar cuenta</Text>
        </Pressable>
      </View>
    </View>
  );
}
