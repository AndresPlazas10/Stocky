import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WOMPI_URL = 'https://checkout.wompi.co/l/66X542';

type BusinessDisabledScreenProps = {
  businessName: string | null;
  onSignOut: () => Promise<void> | void;
};

export function BusinessDisabledScreen({ businessName, onSignOut }: BusinessDisabledScreenProps) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const name = businessName || t('businessDisabled.yourBusiness');
  const cardMaxHeight = Math.min(height - insets.top - insets.bottom - 24, 720);
  const contentBottom = Math.max(20, insets.bottom + 12);

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { height: cardMaxHeight }]}>
        <LinearGradient colors={['#B91C1C', '#7F1D1D']} style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="lock-closed" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>{t('businessDisabled.accessBlocked')}</Text>
          <Text style={styles.headerSubtitle}>{name}</Text>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.economicalBox}>
            <View style={styles.economicalIconWrap}>
              <Ionicons name="pricetag" size={18} color="#047857" />
            </View>
            <View style={styles.economicalCopy}>
              <Text style={styles.economicalTitle}>{t('businessDisabled.economicalTitle')}</Text>
              <Text style={styles.economicalText}>{t('businessDisabled.economicalDesc')}</Text>
              <View style={styles.monthlyRow}>
                <Ionicons name="card-outline" size={14} color="#059669" />
                <Text style={styles.monthlyText}>{t('businessDisabled.monthlyFixed')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.importantBox}>
            <Ionicons name="warning-outline" size={18} color="#D97706" style={styles.importantIcon} />
            <View style={styles.importantCopy}>
              <Text style={styles.importantTitle}>{t('businessDisabled.importantTitle')}</Text>
              <Text style={styles.importantText}>{t('businessDisabled.paymentInstructions')}</Text>
            </View>
          </View>

          <View style={styles.qrSection}>
            <View style={styles.qrWrap}>
              <Image
                source={require('../../assets/banks/qrWompi.png')}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.qrHint}>{t('businessDisabled.scanOrClick')}</Text>
          </View>

          <Pressable
            onPress={() => Linking.openURL(WOMPI_URL)}
            style={styles.payButton}
          >
            <LinearGradient
              colors={['#059669', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.payButtonGradient}
            >
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.payButtonText}>{t('businessDisabled.payNow')}</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.noteBox}>
            <Ionicons name="information-circle" size={16} color="#2563EB" />
            <Text style={styles.noteText}>{t('businessDisabled.reactivationNote')}</Text>
          </View>

          <Pressable
            onPress={onSignOut}
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>{t('buttons.signOut')}</Text>
          </Pressable>
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
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
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
  },
  economicalBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
  },
  economicalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  economicalCopy: {
    flex: 1,
    gap: 4,
  },
  economicalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  economicalText: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
  },
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  monthlyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  importantBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 12,
    padding: 14,
  },
  importantIcon: {
    marginTop: 2,
  },
  importantCopy: {
    flex: 1,
    gap: 4,
  },
  importantTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  importantText: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  qrSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  qrWrap: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  qrImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  qrHint: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  payButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
  },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
});
