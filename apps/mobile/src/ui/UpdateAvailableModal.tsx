import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StockyButton } from './StockyButton';
import type { AppUpdateNotice } from '../services/appUpdateService';

type UpdateAvailableModalProps = {
  notice: AppUpdateNotice;
};

export function UpdateAvailableModal({ notice }: UpdateAvailableModalProps) {
  const handleUpdate = () => {
    if (!notice.ctaUrl) return;
    void Linking.openURL(notice.ctaUrl);
  };

  return (
    <Modal transparent visible statusBarTranslucent>
      <View style={styles.backdrop}>
        <BlurView
          style={StyleSheet.absoluteFillObject}
          tint="dark"
          intensity={24}
          experimentalBlurMethod="dimezisBlurView"
        />
        <View style={styles.scrim} />
        <View style={styles.card}>
          <LinearGradient colors={['#1D4ED8', '#0F172A']} style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Actualización de seguridad</Text>
            <Text style={styles.subtitle}>Disponible para Stocky</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.message}>{notice.message}</Text>
            <StockyButton variant="primary" onPress={handleUpdate}>
              Actualizar Stocky
            </StockyButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.44)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 6,
  },
  iconWrap: {
    height: 46,
    width: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.8)',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  message: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 19,
  },
});
