import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXPO_CONFIG } from '../config/env';
import { getSupabaseClient } from '../lib/supabase';
import { runApiSmokeChecks, type ApiCheckResult } from '../services/stockyApi';
import { deactivatePushTokenForUser } from '../notifications/mobileNotificationsService';
import { StockyBackground } from '../ui/StockyBackground';
import { StockyButton } from '../ui/StockyButton';
import { StockyCard } from '../ui/StockyCard';
import { StockyStatusPill } from '../ui/StockyStatusPill';
import { STOCKY_COLORS } from '../theme/tokens';
import { MesasPanel } from '../features/mesas/MesasPanel';

type Props = {
  session: Session;
};

export function HomeScreen({ session }: Props) {
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [checksError, setChecksError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [checks, setChecks] = useState<ApiCheckResult[]>([]);

  const runChecks = async () => {
    setLoadingChecks(true);
    setChecksError(null);
    try {
      setChecks(await runApiSmokeChecks());
    } catch (err) {
      setChecksError(err instanceof Error ? err.message : 'No se pudieron ejecutar los checks');
    } finally {
      setLoadingChecks(false);
    }
  };

  const signOut = async () => {
    setAuthBusy(true);
    try {
      const client = getSupabaseClient();
      try {
        await deactivatePushTokenForUser(session.user.id);
      } catch (error) {
        console.log('[notifications] failed to deactivate token on sign out', error);
      }
      await client.auth.signOut();
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <StockyBackground>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.brand}>Stocky</Text>
            <Text style={styles.title}>Panel móvil</Text>
            <Text style={styles.subtitle}>Sesión activa: {session.user.email || session.user.id}</Text>
            <Text style={styles.subtitle}>Backend: {EXPO_CONFIG.apiBaseUrl}</Text>
          </View>

          <StockyCard title="Acciones rápidas" subtitle="Controla sesión y conectividad API">
            <View style={styles.row}>
              <StockyButton
                onPress={runChecks}
                disabled={loadingChecks}
                loading={loadingChecks}
              >
                Probar API v2
              </StockyButton>
              <StockyButton
                variant="ghost"
                onPress={signOut}
                disabled={authBusy}
                loading={authBusy}
              >
                Cerrar sesión
              </StockyButton>
            </View>
            {loadingChecks ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
            {checksError ? <Text style={styles.error}>{checksError}</Text> : null}
          </StockyCard>

          {checks.map((check) => (
            <StockyCard
              key={check.name}
              title={check.name}
              rightSlot={<StockyStatusPill ok={check.ok} />}
            >
              <Text style={styles.cardText}>HTTP: {check.status ?? 'n/a'}</Text>
              <Text style={styles.cardText}>x-stocky-api-version: {check.apiVersion ?? 'n/a'}</Text>
              <Text style={styles.cardText}>x-stocky-api-fallback: {check.fallback ?? 'n/a'}</Text>
              <Text style={styles.bodyText}>{check.body}</Text>
            </StockyCard>
          ))}

          <MesasPanel session={session} />
        </ScrollView>
      </SafeAreaView>
    </StockyBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  hero: {
    gap: 6,
  },
  brand: {
    color: STOCKY_COLORS.primary700,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: STOCKY_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: STOCKY_COLORS.textSecondary,
  },
  row: {
    gap: 10,
  },
  cardText: {
    fontSize: 13,
    color: STOCKY_COLORS.textSecondary,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 12,
    color: STOCKY_COLORS.textMuted,
    lineHeight: 18,
  },
  error: {
    color: STOCKY_COLORS.errorText,
    fontSize: 13,
    fontWeight: '600',
  },
});
