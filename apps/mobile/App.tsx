import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPO_CONFIG } from './src/config/env';
import { useAuthSession } from './src/auth/useAuthSession';
import { useMobileNotifications } from './src/notifications/useMobileNotifications';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardApp } from './src/screens/dashboard/DashboardApp';
import { StockyBackground } from './src/ui/StockyBackground';
import { StockyCard } from './src/ui/StockyCard';
import { StockyErrorBoundary } from './src/ui/StockyErrorBoundary';
import { StockyModal } from './src/ui/StockyModal';
import { STOCKY_COLORS } from './src/theme/tokens';

const ANDROID_UPDATE_DISMISS_KEY = 'stocky.mobile.android_update_dismissed_version';

export default function App() {
  const auth = useAuthSession();
  useMobileNotifications(auth.session);
  const hasSupabase = Boolean(EXPO_CONFIG.supabaseUrl && EXPO_CONFIG.supabaseAnonKey);
  const [showAndroidUpdateModal, setShowAndroidUpdateModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!auth.session) return undefined;
    if (Platform.OS !== 'android' && Platform.OS !== 'web') return undefined;
    if (!EXPO_CONFIG.androidDownloadUrl) return undefined;

    const loadDismissedState = async () => {
      try {
        const dismissedVersion = String(
          (await AsyncStorage.getItem(ANDROID_UPDATE_DISMISS_KEY)) || '',
        ).trim();
        if (!cancelled && dismissedVersion !== EXPO_CONFIG.clientVersion) {
          setShowAndroidUpdateModal(true);
        }
      } catch {
        if (!cancelled) setShowAndroidUpdateModal(true);
      }
    };

    void loadDismissedState();
    return () => {
      cancelled = true;
    };
  }, [auth.session]);

  const handleDismissAndroidUpdate = async () => {
    setShowAndroidUpdateModal(false);
    try {
      await AsyncStorage.setItem(ANDROID_UPDATE_DISMISS_KEY, EXPO_CONFIG.clientVersion);
    } catch {
      // no-op
    }
  };

  const handleAndroidDownload = async () => {
    if (!EXPO_CONFIG.androidDownloadUrl) return;
    try {
      await Linking.openURL(EXPO_CONFIG.androidDownloadUrl);
      await AsyncStorage.setItem(ANDROID_UPDATE_DISMISS_KEY, EXPO_CONFIG.clientVersion);
      setShowAndroidUpdateModal(false);
    } catch {
      setShowAndroidUpdateModal(false);
    }
  };

  if (!hasSupabase) {
    return (
      <SafeAreaProvider>
        <StockyErrorBoundary>
          <StockyBackground>
            <SafeAreaView style={styles.container}>
              <StockyCard title="Configuración pendiente" subtitle="Faltan credenciales de Supabase">
                <Text style={styles.error}>
                  apps/mobile/.env requiere:
                  {'\n'}- EXPO_PUBLIC_SUPABASE_URL
                  {'\n'}- EXPO_PUBLIC_SUPABASE_ANON_KEY
                </Text>
              </StockyCard>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </SafeAreaView>
          </StockyBackground>
        </StockyErrorBoundary>
      </SafeAreaProvider>
    );
  }

  if (auth.loading) {
    return (
      <SafeAreaProvider>
        <StockyErrorBoundary>
          <StockyBackground>
            <SafeAreaView style={styles.container}>
              <StockyCard title="Stocky Mobile" subtitle="Inicializando sesión">
                <ActivityIndicator size="small" color={STOCKY_COLORS.primary900} />
                <Text style={styles.subtitle}>Conectando con Supabase...</Text>
              </StockyCard>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </SafeAreaView>
          </StockyBackground>
        </StockyErrorBoundary>
      </SafeAreaProvider>
    );
  }

  if (auth.error) {
    return (
      <SafeAreaProvider>
        <StockyErrorBoundary>
          <StockyBackground>
            <SafeAreaView style={styles.container}>
              <StockyCard title="Error de autenticación">
                <Text style={styles.error}>{auth.error}</Text>
              </StockyCard>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </SafeAreaView>
          </StockyBackground>
        </StockyErrorBoundary>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StockyErrorBoundary>
        {auth.session ? <DashboardApp session={auth.session} /> : <AuthScreen />}
        <StockyModal
          visible={showAndroidUpdateModal}
          title="Nueva versión disponible"
          layout="centered"
          backdropVariant="blur"
          centeredOffsetY={16}
          modalAnimationType="none"
          onClose={handleDismissAndroidUpdate}
        >
          <View style={styles.updateModalBody}>
            <Text style={styles.updateModalText}>
              Ya puedes descargar la versión más reciente de Stocky para Android.
            </Text>
            <View style={styles.updateModalActions}>
              <Pressable style={styles.updateSecondaryButton} onPress={handleDismissAndroidUpdate}>
                <Text style={styles.updateSecondaryText}>Más tarde</Text>
              </Pressable>
              <Pressable style={styles.updatePrimaryButton} onPress={handleAndroidDownload}>
                <Text style={styles.updatePrimaryText}>Descargar para Android</Text>
              </Pressable>
            </View>
          </View>
        </StockyModal>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
      </StockyErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    justifyContent: 'center',
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    color: STOCKY_COLORS.textSecondary,
    fontWeight: '600',
  },
  error: {
    color: STOCKY_COLORS.errorText,
    fontSize: 13,
    fontWeight: '600',
  },
  updateModalBody: {
    gap: 14,
    paddingTop: 4,
  },
  updateModalText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  updateModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  updateSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  updateSecondaryText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  updatePrimaryButton: {
    flex: 1.2,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: STOCKY_COLORS.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  updatePrimaryText: {
    color: STOCKY_COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
