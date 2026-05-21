import { useEffect, useRef } from 'react';
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { DashboardProvider } from './DashboardContext';
import { AppNavigator } from '../../navigation/AppNavigator';
import { perfMark } from '../../utils/perfAudit';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import type { AppUpdateNotice } from '../../services/appUpdateService';

export function DashboardApp({
  session,
  updateNotice,
  dismissUpdateNotice,
}: {
  session: Session;
  updateNotice: AppUpdateNotice | null;
  dismissUpdateNotice: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    perfMark('dashboard_app_mounted', {
      userId: session.user.id,
    });
  }, [session.user.id]);

  useEffect(() => {
    if (updateNotice) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 12,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [updateNotice, slideAnim]);

  const handleDownload = () => {
    if (updateNotice?.ctaUrl) {
      Linking.openURL(updateNotice.ctaUrl).catch(() => {});
    }
  };

  return (
    <DashboardProvider session={session}>
      {updateNotice ? (
        <Animated.View
          style={[
            styles.updateBanner,
            {
              transform: [{ translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-120, 0],
              })}],
              opacity: slideAnim,
            },
          ]}
        >
          <View style={styles.updateBannerContent}>
            <View style={styles.updateBannerText}>
              <Text style={styles.updateTitle}>
                Actualización disponible
              </Text>
              <Text style={styles.updateMessage} numberOfLines={2}>
                {updateNotice.message}
              </Text>
              <Text style={styles.updateVersion}>
                v{updateNotice.latestVersion}
              </Text>
            </View>
            <View style={styles.updateBannerActions}>
              <Pressable
                style={styles.updateDownloadBtn}
                onPress={handleDownload}
              >
                <Text style={styles.updateDownloadText}>Descargar</Text>
              </Pressable>
              <Pressable
                style={styles.updateDismissBtn}
                onPress={dismissUpdateNotice}
              >
                <Text style={styles.updateDismissText}>Ahora no</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
      <AppNavigator />
    </DashboardProvider>
  );
}

const styles = StyleSheet.create({
  updateBanner: {
    backgroundColor: STOCKY_COLORS.primary900,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  updateBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updateBannerText: {
    flex: 1,
    marginRight: 12,
  },
  updateTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  updateMessage: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  updateVersion: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  updateBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  updateDownloadBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: STOCKY_RADIUS.md,
  },
  updateDownloadText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 13,
    fontWeight: '700',
  },
  updateDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  updateDismissText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
});
