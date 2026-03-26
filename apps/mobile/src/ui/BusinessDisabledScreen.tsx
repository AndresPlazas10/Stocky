import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StockyButton } from './StockyButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


type BusinessDisabledScreenProps = {
  businessName: string | null;
  onSignOut: () => Promise<void> | void;
};

export function BusinessDisabledScreen({ businessName, onSignOut }: BusinessDisabledScreenProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const name = businessName || 'tu negocio';
  const cardMaxHeight = Math.min(height - insets.top - insets.bottom - 24, 720);
  const contentBottom = Math.max(20, insets.bottom + 12);

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { height: cardMaxHeight }]}>
        <LinearGradient colors={['#B91C1C', '#7F1D1D']} style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>🔒 Acceso Bloqueado</Text>
          <Text style={styles.headerSubtitle}>{name}</Text>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.alertBox}>
            <Ionicons name="warning-outline" size={18} color="#B91C1C" style={styles.alertIcon} />
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitle}>Servicio Suspendido</Text>
              <Text style={styles.alertText}>
                El acceso a Stocky ha sido suspendido. Por favor contacta a soporte para validar el
                estado de tu cuenta.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => Linking.openURL('https://wa.me/573188246925')}
            style={styles.supportBox}
          >
            <View style={styles.supportHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1D4ED8" />
              <Text style={styles.supportTitle}>¿Necesitas ayuda?</Text>
            </View>
            <Text style={styles.supportText}>
              Escríbenos a nuestro correo soporte@stockypos.app y te responderemos con gusto.
            </Text>
          </Pressable>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              💡 Si tu cuenta ya fue validada, el acceso se restablecerá en las próximas horas.
            </Text>
          </View>

          <StockyButton variant="primary" onPress={onSignOut}>
            Cerrar sesión
          </StockyButton>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  headerIconWrap: {
    height: 52,
    width: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 20,
  },
  alertBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#B91C1C',
    borderRadius: 12,
    padding: 12,
  },
  alertIcon: {
    marginTop: 2,
  },
  alertCopy: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  alertText: {
    fontSize: 12.5,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  supportBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#93C5FD',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  supportText: {
    fontSize: 12.5,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  noteBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 10,
  },
  noteText: {
    fontSize: 11.5,
    color: '#1E3A8A',
    textAlign: 'center',
    lineHeight: 16,
  },
});
