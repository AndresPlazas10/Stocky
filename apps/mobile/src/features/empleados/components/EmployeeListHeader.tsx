import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { empleadosStyles as s } from '../empleadosStyles';

interface EmployeeListHeaderProps {
  canManageEmployees: boolean;
  checkingPermissions: boolean;
  onInvite: () => void;
}

export function EmployeeListHeader({ canManageEmployees, checkingPermissions, onInvite }: EmployeeListHeaderProps) {
  return (
    <View style={s.heroCard}>
      <View style={s.heroTop}>
        <Ionicons name="people-outline" size={56} color="#C9CBD2" />
        <View style={s.heroTitleWrap}>
          <Text style={s.heroTitle}>Empleados</Text>
          <Text style={s.heroSubtitle}>Gestiona empleados y accesos</Text>
        </View>
      </View>

      <Pressable
        style={[s.heroInviteButtonWrap, (!canManageEmployees || checkingPermissions) && s.buttonDisabled]}
        onPress={onInvite}
        disabled={!canManageEmployees || checkingPermissions}
      >
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.heroInviteButton}
        >
          <Ionicons name="person-add-outline" size={22} color="#D1D5DB" />
          <Text style={s.heroInviteButtonText}>Invitar Empleado</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
