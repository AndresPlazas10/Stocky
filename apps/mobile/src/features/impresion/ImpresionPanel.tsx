import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';
import {
  type BluetoothDevice,
  type PrinterConfig,
  cancelDiscovery,
  clearPrinter,
  connectToPrinter,
  disconnectFromPrinter,
  getPairedDevices,
  getSavedPrinter,
  isPrinterConnected,
  printBytes,
  savePrinter,
  startDiscovery,
} from '../../services/bluetoothPrinterService';
import { buildSaleEscPos } from '../../services/escposService';
import {
  getThermalPaperWidthMm,
  setThermalPaperWidthMm,
  isAutoCutEnabled,
  setAutoCutEnabled,
} from '../../utils/printer';
import {
  ensureBluetoothEnabled,
  isBluetoothModuleAvailable,
  BLUETOOTH_MODULE_UNAVAILABLE_MESSAGE,
  BLUETOOTH_PRINT_REQUIRED_MESSAGE,
} from '../../utils/bluetooth';

async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Platform.Version < 31) return true;
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted' &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted'
    );
  } catch {
    return false;
  }
}

type Props = {
  businessName?: string;
};

export function ImpresionPanel({ businessName }: Props) {
  const { t } = useTranslation();
  const [savedPrinter, setSavedPrinter] = useState<PrinterConfig | null>(null);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [paperWidthMm, setPaperWidthMm] = useState(80);
  const [autoCut, setAutoCut] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const toast = useToastContext();
  const toastMessages = useToastMessages();
  const btAvailable = isBluetoothModuleAvailable();

  useEffect(() => {
    (async () => {
      const saved = await getSavedPrinter();
      setSavedPrinter(saved);
      const pw = await getThermalPaperWidthMm();
      setPaperWidthMm(pw);
      const ac = await isAutoCutEnabled();
      setAutoCut(ac);
      if (saved) {
        let ok = await isPrinterConnected(saved.address);
        if (!ok) {
          if (__DEV__) console.warn('[Impresion] Printer not connected, attempting reconnect...');
          ok = await connectToPrinter(saved.address);
        }
        setConnected(ok);
      }
    })();
    return () => {
      cancelDiscovery().catch(() => {});
    };
  }, []);

  const handleScan = useCallback(async () => {
    setStatusMsg('');
    setIsScanning(true);
    try {
      const permsOk = await requestBluetoothPermissions();
      if (!permsOk) {
        setStatusMsg(t('impresion.permissionsDenied'));
        return;
      }

      const paired = await getPairedDevices();
      if (paired.length > 0) {
        setDevices(paired);
        setStatusMsg(t('impresion.pairedDevices', { count: paired.length }));
        return;
      }

      const discovered = await startDiscovery();
      setDevices(discovered);
      setStatusMsg(
        discovered.length > 0
          ? t('impresion.discoveredDevices', { count: discovered.length })
          : t('impresion.noDevices'),
      );
    } catch (err) {
      if (__DEV__) console.error('[Impresion] Scan error:', err);
      setStatusMsg('Error: ' + (err instanceof Error ? err.message : t('impresion.scanFailed')));
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleConnect = useCallback(async (device: BluetoothDevice) => {
    setStatusMsg('');
    setIsConnecting(true);
    try {
      const ok = await connectToPrinter(device.address);
      if (ok) {
        const config: PrinterConfig = { address: device.address, name: device.name };
        await savePrinter(config);
        setSavedPrinter(config);
        setConnected(true);
        toast.showSuccess(toastMessages.impresion.connectionSuccess());
        setStatusMsg('');
      } else {
        toast.showError({
          title: t('impresion.connectionError'),
          message: t('impresion.connectionErrorMessage'),
        });
        setStatusMsg('');
      }
    } catch {
      toast.showError(toastMessages.impresion.connectionError());
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (savedPrinter) {
      await disconnectFromPrinter(savedPrinter.address);
    }
    await clearPrinter();
    setSavedPrinter(null);
    setConnected(false);
    setStatusMsg(t('impresion.disconnected'));
  }, [savedPrinter]);

  const handlePaperChange = useCallback(async (mm: number) => {
    setPaperWidthMm(mm);
    await setThermalPaperWidthMm(mm);
  }, []);

  const handleAutoCutChange = useCallback(async (enabled: boolean) => {
    setAutoCut(enabled);
    await setAutoCutEnabled(enabled);
  }, []);

  const handlePrintTest = useCallback(async () => {
    if (!savedPrinter) {
      Alert.alert(t('impresion.noPrinter'), t('impresion.connectFirst'));
      return;
    }
    const btReady = await ensureBluetoothEnabled();
    if (!btReady) {
      toast.showWarning({
        title: t('impresion.bluetoothDisabled'),
        message: BLUETOOTH_PRINT_REQUIRED_MESSAGE,
      });
      return;
    }
    setIsPrintingTest(true);
    setStatusMsg('');
    try {
      const receipt = {
        type: 'sale',
        header: {
          title: t('impresion.testPrint'),
          businessName: String(businessName || 'Sistema Stocky'),
          dateText: new Date().toLocaleString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Bogota',
          }),
          alignment: 'center' as const,
        },
        metadata: [{ label: t('impresion.status'), value: t('impresion.connectionSuccess') }],
        items: [
          { name: t('impresion.testPrintSuccess'), quantity: 1, subtotal: 0, subtotalText: '$0' },
        ],
        totals: { total: 0, totalText: '$0' },
        payment: { method: 'cash', methodText: 'Prueba' },
        footer: { message: t('impresion.bluetoothSuccess'), alignment: 'center' as const },
      };
      const escposData = buildSaleEscPos(receipt, paperWidthMm, autoCut);
      const result = await printBytes(savedPrinter.address, escposData);
      if (result.ok) {
        toast.showSuccess(toastMessages.impresion.testSent());
        setStatusMsg('');
      } else {
        const errorMsg = result.error || t('impresion.printFailed');
        toast.showError(toastMessages.impresion.printError(errorMsg));
        setStatusMsg('');
      }
    } catch {
      toast.showError(toastMessages.impresion.printError());
    } finally {
      setIsPrintingTest(false);
    }
  }, [savedPrinter, paperWidthMm, businessName, autoCut]);

  const deviceKeyExtractor = useCallback((item: { address: string }) => item.address, []);

  const renderDeviceItem = useCallback(
    ({ item }: { item: { address: string; name: string } }) => {
      const isSaved = savedPrinter?.address === item.address;
      return (
        <Pressable
          style={[styles.deviceRow, isSaved && styles.deviceRowActive]}
          onPress={() => handleConnect(item)}
          disabled={isConnecting}
        >
          <Ionicons name="hardware-chip-outline" size={20} color={STOCKY_COLORS.textSecondary} />
          <View style={styles.deviceTextCol}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.deviceAddr}>{item.address}</Text>
          </View>
          {isConnecting && isSaved ? (
            <ActivityIndicator size="small" color={STOCKY_COLORS.primary700} />
          ) : isSaved ? (
            <Ionicons name="checkmark-circle" size={20} color={STOCKY_COLORS.successText} />
          ) : (
            <Pressable style={styles.connectBtnSmall} onPress={() => handleConnect(item)}>
              <Text style={styles.connectTextSmall}>{t('impresion.connect')}</Text>
            </Pressable>
          )}
        </Pressable>
      );
    },
    [savedPrinter, isConnecting, handleConnect],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('impresion.title')}</Text>

      {!btAvailable ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={20} color={STOCKY_COLORS.accent500} />
            <Text style={styles.cardTitle}>{t('impresion.bluetoothUnavailable')}</Text>
          </View>
          <Text style={styles.statusMsgText}>{BLUETOOTH_MODULE_UNAVAILABLE_MESSAGE}</Text>
          <Text style={styles.statusMsgSubtext}>{t('impresion.bluetoothMessage')}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bluetooth" size={20} color={STOCKY_COLORS.primary700} />
          <Text style={styles.cardTitle}>{t('impresion.printer')}</Text>
        </View>

        {savedPrinter ? (
          <View style={styles.printerInfo}>
            <View style={styles.printerRow}>
              <Ionicons
                name={connected ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={connected ? STOCKY_COLORS.successText : STOCKY_COLORS.errorText}
              />
              <View style={styles.printerTextCol}>
                <Text style={styles.printerName}>{savedPrinter.name}</Text>
                <Text style={styles.printerAddr}>{savedPrinter.address}</Text>
              </View>
              <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>{t('impresion.disconnect')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={STOCKY_COLORS.primary700} />
            ) : (
              <Text style={styles.btnOutlineText}>{t('impresion.scan')}</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={() => {
              if (!isBluetoothModuleAvailable()) {
                Alert.alert(
                  t('impresion.bluetoothModuleUnavailable'),
                  BLUETOOTH_MODULE_UNAVAILABLE_MESSAGE,
                );
                return;
              }
              try {
                const BluetoothClassic = require('react-native-bluetooth-classic').default;
                BluetoothClassic.openBluetoothSettings();
              } catch {
                Alert.alert('Error', t('impresion.bluetoothSettingsError'));
              }
            }}
          >
            <Ionicons name="settings-outline" size={16} color={STOCKY_COLORS.primary700} />
            <Text style={styles.btnOutlineText}>{t('impresion.bluetoothSettings')}</Text>
          </Pressable>
        </View>
      </View>

      {devices.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.listTitle}>{t('impresion.foundDevices')}</Text>
          <FlatList
            data={devices}
            keyExtractor={deviceKeyExtractor}
            scrollEnabled={false}
            renderItem={renderDeviceItem}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-outline" size={20} color={STOCKY_COLORS.primary700} />
          <Text style={styles.cardTitle}>{t('impresion.settings')}</Text>
        </View>
        <Text style={styles.configLabel}>{t('impresion.paperSize')}</Text>
        <View style={styles.paperRow}>
          <Pressable
            style={[styles.paperChip, paperWidthMm === 58 && styles.paperChipActive]}
            onPress={() => handlePaperChange(58)}
          >
            <Text style={[styles.paperChipText, paperWidthMm === 58 && styles.paperChipTextActive]}>
              58 mm
            </Text>
          </Pressable>
          <Pressable
            style={[styles.paperChip, paperWidthMm === 80 && styles.paperChipActive]}
            onPress={() => handlePaperChange(80)}
          >
            <Text style={[styles.paperChipText, paperWidthMm === 80 && styles.paperChipTextActive]}>
              80 mm
            </Text>
          </Pressable>
        </View>

        <View style={styles.cutRow}>
          <Text style={styles.configLabel}>{t('impresion.autoCut')}</Text>
          <Pressable
            style={[styles.toggleTrack, autoCut && styles.toggleTrackActive]}
            onPress={() => handleAutoCutChange(!autoCut)}
          >
            <View style={[styles.toggleThumb, autoCut && styles.toggleThumbActive]} />
          </Pressable>
        </View>
        <Text style={styles.cutHint}>
          {autoCut ? t('impresion.autoCutDescription') : t('impresion.autoCutNote')}
        </Text>
      </View>

      {savedPrinter ? (
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={handlePrintTest}
          disabled={isPrintingTest}
        >
          {isPrintingTest ? (
            <ActivityIndicator size="small" color={STOCKY_COLORS.white} />
          ) : (
            <>
              <Ionicons name="print-outline" size={18} color={STOCKY_COLORS.white} />
              <Text style={styles.btnPrimaryText}>{t('impresion.printTest')}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {statusMsg ? <Text style={styles.statusText}>{statusMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: STOCKY_COLORS.textPrimary,
  },
  card: {
    backgroundColor: STOCKY_COLORS.surface,
    borderRadius: STOCKY_RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: STOCKY_COLORS.textPrimary,
  },
  printerInfo: {
    backgroundColor: STOCKY_COLORS.backgroundSoft,
    borderRadius: STOCKY_RADIUS.md,
    padding: 12,
  },
  printerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  printerTextCol: {
    flex: 1,
  },
  printerName: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.textPrimary,
  },
  printerAddr: {
    fontSize: 11,
    color: STOCKY_COLORS.textMuted,
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: STOCKY_RADIUS.sm,
    backgroundColor: STOCKY_COLORS.errorLight || '#FEE2E2',
  },
  disconnectText: {
    fontSize: 12,
    fontWeight: '600',
    color: STOCKY_COLORS.errorText,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: STOCKY_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: STOCKY_COLORS.primary700,
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: STOCKY_COLORS.primary700,
  },
  btnPrimary: {
    backgroundColor: STOCKY_COLORS.primary700,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.white,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: STOCKY_COLORS.textSecondary,
    marginBottom: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: STOCKY_RADIUS.md,
  },
  deviceRowActive: {
    backgroundColor: STOCKY_COLORS.backgroundSoft,
  },
  deviceTextCol: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.textPrimary,
  },
  deviceAddr: {
    fontSize: 11,
    color: STOCKY_COLORS.textMuted,
  },
  connectBtnSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: STOCKY_RADIUS.sm,
    backgroundColor: STOCKY_COLORS.primary700,
  },
  connectTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: STOCKY_COLORS.white,
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: STOCKY_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paperChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
  },
  paperChipActive: {
    borderColor: STOCKY_COLORS.primary700,
    backgroundColor: STOCKY_COLORS.primary50 || '#EEF2FF',
  },
  paperChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.textSecondary,
  },
  paperChipTextActive: {
    color: STOCKY_COLORS.primary700,
  },
  cutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cutHint: {
    fontSize: 12,
    color: STOCKY_COLORS.textMuted,
    marginTop: 4,
  },
  toggleTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: STOCKY_COLORS.borderSoft || '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: STOCKY_COLORS.successText || '#166534',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: STOCKY_COLORS.white,
    transform: [{ translateX: 0 }],
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  statusText: {
    fontSize: 13,
    color: STOCKY_COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  statusMsgText: {
    fontSize: 14,
    color: STOCKY_COLORS.textPrimary,
    lineHeight: 20,
  },
  statusMsgSubtext: {
    fontSize: 12,
    color: STOCKY_COLORS.textMuted,
    lineHeight: 18,
  },
});
