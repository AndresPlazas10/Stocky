import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StockyButton } from './StockyButton';
import { STOCKY_COLORS } from '../theme/tokens';

type BusinessDisabledScreenProps = {
  businessName: string | null;
  onSignOut: () => Promise<void> | void;
};

export function BusinessDisabledScreen({ businessName, onSignOut }: BusinessDisabledScreenProps) {
  const name = businessName || 'tu negocio';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle" size={36} color="#DC2626" />
        </View>
        <Text style={styles.title}>Acceso suspendido</Text>
        <Text style={styles.subtitle}>
          El servicio de {name} está desactivado por falta de pago.
        </Text>
        <Text style={styles.helper}>
          Para reactivar tu cuenta, ponte en contacto con el administrador o el soporte de Stocky.
        </Text>
        <StockyButton
          label="Cerrar sesión"
          variant="danger"
          onPress={onSignOut}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  iconWrap: {
    height: 52,
    width: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: STOCKY_COLORS.slate900,
  },
  subtitle: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  helper: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
});
