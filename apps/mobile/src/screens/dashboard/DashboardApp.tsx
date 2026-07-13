import { useEffect, useState } from 'react';
import { Animated, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { DashboardProvider, useDashboardContext } from './DashboardContext';
import { BusinessConfigProvider } from '../../contexts/BusinessConfigContext';
import { AppNavigator } from '../../navigation/AppNavigator';
import { StockyErrorBoundary } from '../../ui/StockyErrorBoundary';
import { perfMark } from '../../utils/perfAudit';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import type { AppUpdateNotice } from '../../services/appUpdateService';
import { ToastProvider } from '../../contexts/ToastContext';
import { ToastHost } from '../../ui/ToastHost';

export function DashboardApp({
  session,
  updateNotice,
  dismissUpdateNotice,
}: {
  session: Session;
  updateNotice: AppUpdateNotice | null;
  dismissUpdateNotice: () => void;
}) {
  const [scaleAnim] = useState(() => new Animated.Value(0.9));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    perfMark('dashboard_app_mounted', {
      userId: session.user.id,
    });
  }, [session.user.id]);

  useEffect(() => {
    if (updateNotice) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 150,
          friction: 14,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
    }
  }, [updateNotice, scaleAnim, fadeAnim]);

  const handleDownload = () => {
    if (updateNotice?.ctaUrl) {
      Linking.openURL(updateNotice.ctaUrl).catch(() => {});
    }
  };

  return (
    <DashboardProvider session={session}>
      <DashboardContent
        updateNotice={updateNotice}
        dismissUpdateNotice={dismissUpdateNotice}
        scaleAnim={scaleAnim}
        fadeAnim={fadeAnim}
        handleDownload={handleDownload}
      />
    </DashboardProvider>
  );
}

function DashboardContent({
  updateNotice,
  dismissUpdateNotice,
  scaleAnim,
  fadeAnim,
  handleDownload,
}: {
  updateNotice: AppUpdateNotice | null;
  dismissUpdateNotice: () => void;
  scaleAnim: Animated.Value;
  fadeAnim: Animated.Value;
  handleDownload: () => void;
}) {
  const { businessContext } = useDashboardContext();

  return (
    <BusinessConfigProvider
      business={
        businessContext
          ? {
              country_code: businessContext.country_code || undefined,
              timezone: businessContext.timezone || undefined,
              currency: businessContext.currency || undefined,
            }
          : null
      }
    >
      <ToastProvider>
        <StockyErrorBoundary>
          <AppNavigator />
        </StockyErrorBoundary>
        <ToastHost />
        <Modal
          visible={Boolean(updateNotice)}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.overlay}>
            <Animated.View
              style={[
                styles.card,
                {
                  transform: [{ scale: scaleAnim }],
                  opacity: fadeAnim,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.title}>Actualización disponible</Text>
                <Text style={styles.version}>v{updateNotice?.latestVersion}</Text>
              </View>

              <Text style={styles.message}>{updateNotice?.message}</Text>

              <View style={styles.actions}>
                <Pressable style={styles.downloadBtn} onPress={handleDownload}>
                  <Text style={styles.downloadText}>Descargar</Text>
                </Pressable>
                <Pressable style={styles.dismissBtn} onPress={dismissUpdateNotice}>
                  <Text style={styles.dismissText}>Ahora no</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </ToastProvider>
    </BusinessConfigProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: STOCKY_RADIUS.xl,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  cardHeader: {
    backgroundColor: STOCKY_COLORS.primary900,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  version: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    paddingHorizontal: 24,
    paddingVertical: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: STOCKY_COLORS.primary900,
    paddingVertical: 14,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
  },
  downloadText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
  },
  dismissText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
