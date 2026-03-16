import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StockyButton } from './StockyButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const paymentQr = require('../../assets/QR.jpeg');

type BusinessDisabledScreenProps = {
  businessName: string | null;
  onSignOut: () => Promise<void> | void;
};

export function BusinessDisabledScreen({ businessName, onSignOut }: BusinessDisabledScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const name = businessName || 'tu negocio';
  const cardMaxHeight = Math.min(height - insets.top - insets.bottom - 24, 720);
  const contentBottom = Math.max(20, insets.bottom + 12);
  const qrSize = Math.min(Math.round(width * 0.55), 210);

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
                El acceso a Stocky ha sido suspendido por falta de pago. Para reactivar su servicio,
                debe regularizar el pago pendiente.
              </Text>
            </View>
          </View>

          <View style={styles.paymentBox}>
            <View style={styles.paymentHeader}>
              <Ionicons name="card-outline" size={18} color="#15803D" />
              <Text style={styles.paymentTitle}>Realizar Pago Para Reactivar</Text>
            </View>
            <View style={styles.paymentRow}>
              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>• Valor:</Text>
                  <Text style={styles.detailValue}>$50.000 COP</Text>
                </View>
              </View>
              <View style={styles.qrBox}>
                <Text style={styles.qrHint}>
                  Escanea el QR desde tu app de banco preferida para pagar.
                </Text>
                <Image source={paymentQr} style={[styles.qrImage, { height: qrSize }]} resizeMode="contain" />
              </View>
            </View>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                <Text style={styles.warningBold}>⚠️ Importante:</Text> Por favor, realice el envío a
                través de <Text style={styles.warningBold}>Bre-B</Text> al medio de pago indicado y
                remita una fotografía del comprobante de pago por nuestro canal de WhatsApp
                <Text style={styles.warningBold}> 318-824-6925</Text>, indicando el nombre de su
                negocio para poder identificarlo correctamente en nuestro sistema.
              </Text>
            </View>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              💡 Una vez realizado el pago, su servicio será reactivado en las próximas horas.
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
  paymentBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#4ADE80',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  paymentHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532D',
  },
  paymentRow: {
    gap: 12,
  },
  paymentDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#111827',
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  qrHint: {
    fontSize: 11.5,
    color: '#374151',
    textAlign: 'center',
  },
  qrImage: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  warningBox: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FACC15',
    borderRadius: 10,
    padding: 10,
  },
  warningText: {
    fontSize: 11.5,
    color: '#713F12',
    lineHeight: 16,
  },
  warningBold: {
    fontWeight: '700',
    color: '#713F12',
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
