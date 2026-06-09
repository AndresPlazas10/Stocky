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
import { Ionicons } from '@expo/vector-icons';
import BluetoothClassic from 'react-native-bluetooth-classic';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
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
import { getThermalPaperWidthMm, setThermalPaperWidthMm } from '../../utils/printer';

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
  const [savedPrinter, setSavedPrinter] = useState<PrinterConfig | null>(null);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [paperWidthMm, setPaperWidthMm] = useState(80);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    (async () => {
      const saved = await getSavedPrinter();
      setSavedPrinter(saved);
      const pw = await getThermalPaperWidthMm();
      setPaperWidthMm(pw);
      if (saved) {
        const ok = await isPrinterConnected(saved.address);
        setConnected(ok);
      }
    })();
    return () => { cancelDiscovery().catch(() => {}); };
  }, []);

  const handleScan = useCallback(async () => {
    setStatusMsg('');
    setIsScanning(true);
    try {
      const permsOk = await requestBluetoothPermissions();
      if (!permsOk) {
        setStatusMsg('Permisos Bluetooth denegados. Concedelos en Ajustes.');
        return;
      }

      const paired = await getPairedDevices();
      if (paired.length > 0) {
        setDevices(paired);
        setStatusMsg(`${paired.length} dispositivo(s) emparejado(s)`);
        return;
      }

      const discovered = await startDiscovery();
      setDevices(discovered);
      setStatusMsg(discovered.length > 0
        ? `${discovered.length} dispositivo(s) encontrado(s)`
        : 'No se encontraron dispositivos. Asegurate de emparejar la impresora en Ajustes > Bluetooth.');
    } catch (err) {
      console.error('[Impresion] Scan error:', err);
      setStatusMsg('Error: ' + (err instanceof Error ? err.message : 'Fallo al escanear'));
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
        setStatusMsg(`Conectado a ${device.name}`);
      } else {
        setStatusMsg('No se pudo conectar');
      }
    } catch {
      setStatusMsg('Error de conexion');
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
    setStatusMsg('Desconectado');
  }, [savedPrinter]);

  const handlePaperChange = useCallback(async (mm: number) => {
    setPaperWidthMm(mm);
    await setThermalPaperWidthMm(mm);
  }, []);

  const handlePrintTest = useCallback(async () => {
    if (!savedPrinter) {
      Alert.alert('Sin impresora', 'Conecta una impresora primero.');
      return;
    }
    setIsPrintingTest(true);
    setStatusMsg('');
    try {
      const receipt = {
        type: 'sale',
        header: {
          title: 'PRUEBA DE IMPRESION',
          businessName: String(businessName || 'Sistema Stocky'),
          dateText: new Date().toLocaleString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
          }),
          alignment: 'center' as const,
        },
        metadata: [
          { label: 'Estado', value: 'Conexion exitosa' },
        ],
        items: [
          { name: 'Impresion de prueba', quantity: 1, subtotal: 0, subtotalText: '$0' },
        ],
        totals: { total: 0, totalText: '$0' },
        payment: { method: 'cash', methodText: 'Prueba' },
        footer: { message: 'Conexion Bluetooth exitosa!', alignment: 'center' as const },
      };
      const escposData = buildSaleEscPos(receipt, paperWidthMm);
      const ok = await printBytes(savedPrinter.address, escposData);
      if (ok) {
        setStatusMsg('Prueba enviada correctamente');
      } else {
        setStatusMsg('Error al imprimir la prueba');
        Alert.alert('Error', 'No se pudo imprimir. Verifica la conexion Bluetooth.');
      }
    } catch {
      setStatusMsg('Error inesperado');
    } finally {
      setIsPrintingTest(false);
    }
  }, [savedPrinter, paperWidthMm, businessName]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Impresion</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bluetooth" size={20} color={STOCKY_COLORS.primary700} />
          <Text style={styles.cardTitle}>Impresora</Text>
        </View>

        {savedPrinter ? (
          <View style={styles.printerInfo}>
            <View style={styles.printerRow}>
              <Ionicons name={connected ? 'checkmark-circle' : 'close-circle'} size={20}
                color={connected ? STOCKY_COLORS.successText : STOCKY_COLORS.errorText} />
              <View style={styles.printerTextCol}>
                <Text style={styles.printerName}>{savedPrinter.name}</Text>
                <Text style={styles.printerAddr}>{savedPrinter.address}</Text>
              </View>
              <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>Desconectar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={handleScan}
            disabled={isScanning}>
            {isScanning ? (
              <ActivityIndicator size="small" color={STOCKY_COLORS.primary700} />
            ) : (
              <Text style={styles.btnOutlineText}>Escanear</Text>
            )}
          </Pressable>
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => {
            BluetoothClassic.openBluetoothSettings();
          }}>
            <Ionicons name="settings-outline" size={16} color={STOCKY_COLORS.primary700} />
            <Text style={styles.btnOutlineText}>Ajustes BT</Text>
          </Pressable>
        </View>
      </View>

      {devices.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.listTitle}>Dispositivos encontrados</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.address}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const isSaved = savedPrinter?.address === item.address;
              return (
                <Pressable style={[styles.deviceRow, isSaved && styles.deviceRowActive]}
                  onPress={() => handleConnect(item)} disabled={isConnecting}>
                  <Ionicons name="hardware-chip-outline" size={20} color={STOCKY_COLORS.textSecondary} />
                  <View style={styles.deviceTextCol}>
                    <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.deviceAddr}>{item.address}</Text>
                  </View>
                  {isConnecting && isSaved ? (
                    <ActivityIndicator size="small" color={STOCKY_COLORS.primary700} />
                  ) : isSaved ? (
                    <Ionicons name="checkmark-circle" size={20} color={STOCKY_COLORS.successText} />
                  ) : (
                    <Pressable style={styles.connectBtnSmall} onPress={() => handleConnect(item)}>
                      <Text style={styles.connectTextSmall}>Conectar</Text>
                    </Pressable>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-outline" size={20} color={STOCKY_COLORS.primary700} />
          <Text style={styles.cardTitle}>Configuracion</Text>
        </View>
        <Text style={styles.configLabel}>Tamaño de papel</Text>
        <View style={styles.paperRow}>
          <Pressable style={[styles.paperChip, paperWidthMm === 58 && styles.paperChipActive]}
            onPress={() => handlePaperChange(58)}>
            <Text style={[styles.paperChipText, paperWidthMm === 58 && styles.paperChipTextActive]}>58 mm</Text>
          </Pressable>
          <Pressable style={[styles.paperChip, paperWidthMm === 80 && styles.paperChipActive]}
            onPress={() => handlePaperChange(80)}>
            <Text style={[styles.paperChipText, paperWidthMm === 80 && styles.paperChipTextActive]}>80 mm</Text>
          </Pressable>
        </View>
      </View>

      {savedPrinter ? (
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handlePrintTest}
          disabled={isPrintingTest}>
          {isPrintingTest ? (
            <ActivityIndicator size="small" color={STOCKY_COLORS.white} />
          ) : (
            <>
              <Ionicons name="print-outline" size={18} color={STOCKY_COLORS.white} />
              <Text style={styles.btnPrimaryText}>Imprimir prueba</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {statusMsg ? (
        <Text style={styles.statusText}>{statusMsg}</Text>
      ) : null}
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
  statusText: {
    fontSize: 13,
    color: STOCKY_COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
