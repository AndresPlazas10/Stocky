import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ShieldCheck, Smartphone, AlertTriangle, Monitor, BellRing, Share, PlusSquare, AppWindow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApkDownloadUrl } from '../utils/apkDownload.js';
import { getWindowsDownloadUrl } from '../utils/windowsDownload.js';
import {
  getPrintBridgeApkDownloadUrl,
  getPrintBridgeWindowsDownloadUrl,
} from '../utils/printBridgeDownload.js';
import { checkPrintBridgeStatus } from '../utils/printBridgeClient.js';
import {
  getConfiguredPrinterName,
  getPrintBridgeEndpoint,
  getPrintBridgeToken,
  getThermalPaperWidthMm,
  isPrintBridgeEnabled,
  setConfiguredPrinterName,
  setPrintBridgeEnabled,
  setPrintBridgeEndpoint,
  setPrintBridgeToken,
  setThermalPaperWidthMm,
} from '../utils/printer.js';
import {
  getWebPushSupportStatus,
  registerPwaPushSubscription,
  sendPwaPushTestNotification,
} from '../services/pwaPushNotificationsService.js';
import { isIOs, isStandalone } from '../utils/deviceDetection.js';

const _motionLintUsage = motion;

const getBridgeDiagnosticMessage = (result) => {
  if (result?.reason === 'bridge_disabled') {
    return 'Activa "Usar Stocky Print Bridge" y guarda la configuración.';
  }

  if (result?.reason === 'missing_bridge_endpoint') {
    return 'Falta el endpoint. En Android usa http://127.0.0.1:41781.';
  }

  if (result?.reason === 'missing_bridge_token') {
    return 'Falta el token del APK. Copia el token desde Stocky Print Bridge.';
  }

  if (result?.reason === 'bridge_unavailable') {
    return 'No se pudo abrir el bridge. Deja el APK abierto, activa "Permitir impresión desde Stocky Web/Mobile", toca Guardar y usa http://127.0.0.1:41781.';
  }

  if (result?.reason === 'bridge_timeout') {
    return 'El bridge no respondió a tiempo. Reabre el APK, guarda la configuración e intenta de nuevo.';
  }

  if (String(result?.reason || '').startsWith('bridge_http_')) {
    return `El bridge respondió con error ${String(result.reason).replace('bridge_http_', '')}. Revisa el token y que la integración esté activa en el APK.`;
  }

  return result?.error || result?.reason || 'Error desconocido probando el bridge.';
};

function DownloadPage() {
  const apkUrl = getApkDownloadUrl();
  const windowsUrl = getWindowsDownloadUrl();
  const printBridgeApkUrl = getPrintBridgeApkDownloadUrl();
  const printBridgeWindowsUrl = getPrintBridgeWindowsDownloadUrl();
  const apkVersion = String(import.meta.env?.VITE_APK_VERSION || '').trim();
  const windowsVersion = String(import.meta.env?.VITE_WINDOWS_VERSION || '').trim();
  const printBridgeVersion = String(import.meta.env?.VITE_PRINT_BRIDGE_VERSION || '').trim();
  const [enablingPush, setEnablingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState('');
  const [bridgeFeedback, setBridgeFeedback] = useState('');
  const [bridgeEnabled, setBridgeEnabled] = useState(() => isPrintBridgeEnabled());
  const [bridgeEndpoint, setBridgeEndpoint] = useState(() => getPrintBridgeEndpoint());
  const [bridgeToken, setBridgeToken] = useState(() => getPrintBridgeToken());
  const [bridgePrinterName, setBridgePrinterName] = useState(() => getConfiguredPrinterName());
  const [bridgePaperWidth, setBridgePaperWidth] = useState(() => getThermalPaperWidthMm());
  const [showIOsSteps, setShowIOsSteps] = useState(false);
  const [support, setSupport] = useState({ supported: false, reason: 'loading', permission: 'default' });
  const userIsOnIOs = isIOs();
  const userInStandalone = isStandalone();

  useEffect(() => {
    getWebPushSupportStatus().then(setSupport);
  }, []);

  const handleEnableNotifications = async () => {
    setEnablingPush(true);
    setPushFeedback('');

    try {
      const result = await registerPwaPushSubscription({ askPermission: true });
      if (result.ok) {
        setPushFeedback('✅ Notificaciones activadas correctamente.');
        return;
      }

      if (result.reason === 'missing_access_token') {
        setPushFeedback('⚠️ Inicia sesión primero para vincular notificaciones a tu cuenta.');
        return;
      }

      if (result.reason === 'missing_vapid_public_key') {
        setPushFeedback('❌ Error de configuración: VAPID key no configurada. Contacta soporte.');
        return;
      }

      setPushFeedback(`❌ Error: ${result.message || result.reason || 'Desconocido'}`);
    } catch (err) {
      setPushFeedback(`❌ Error inesperado: ${err?.message || String(err)}`);
    } finally {
      setEnablingPush(false);
    }
  };

  const handleSendTest = async () => {
    setTestingPush(true);
    setPushFeedback('');
    try {
      const result = await sendPwaPushTestNotification();
      if (result.ok) {
        const sent = Number(result?.data?.sent || 0);
        if (sent > 0) {
          setPushFeedback('Notificación de prueba enviada. Revisa tu iPhone.');
        } else {
          setPushFeedback('No hay suscripción activa. Activa notificaciones primero.');
        }
        return;
      }
      setPushFeedback(result.message || 'No se pudo enviar la notificación de prueba.');
    } catch {
      setPushFeedback('Error de red enviando notificación de prueba.');
    } finally {
      setTestingPush(false);
    }
  };

  const handleSaveBridgeConfig = () => {
    const ok = [
      setPrintBridgeEnabled(bridgeEnabled),
      setPrintBridgeEndpoint(bridgeEndpoint),
      setPrintBridgeToken(bridgeToken),
      setConfiguredPrinterName(bridgePrinterName),
      setThermalPaperWidthMm(bridgePaperWidth),
    ].every(Boolean);

    setBridgeFeedback(ok
      ? 'Configuración guardada. Ahora vuelve a Stocky e imprime el recibo.'
      : 'No se pudo guardar la configuración del puente.');
  };

  const handleTestBridgeConfig = async () => {
    handleSaveBridgeConfig();
    setBridgeFeedback('Probando conexión con Stocky Print Bridge...');

    const result = await checkPrintBridgeStatus();
    if (result.ok) {
      setBridgeFeedback('Conexión correcta. El navegador ya ve el APK.');
      return;
    }

    setBridgeFeedback(`No se pudo conectar al bridge: ${getBridgeDiagnosticMessage(result)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f5ff] via-[#f2edff] to-[#ebe4ff] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,0.25),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(99,102,241,0.2),transparent_32%),radial-gradient(circle_at_50%_95%,rgba(168,85,247,0.18),transparent_40%)]" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl rounded-3xl border border-violet-200/80 bg-white/85 p-8 shadow-[0_28px_60px_-40px_rgba(99,102,241,0.9)] backdrop-blur-sm sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col gap-6"
          >
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-violet-300/70 bg-violet-100/70 px-3 py-1.5 text-xs font-semibold text-violet-700">
              <Download className="h-3.5 w-3.5" />
              Descargas oficiales
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-violet-950 sm:text-4xl">
                Descarga Stocky para Android y Windows
              </h1>
              <p className="text-base text-slate-700 sm:text-lg">
                Elige tu plataforma y descarga la versión correspondiente.
                {apkVersion ? ` Android ${apkVersion}.` : ''}
                {windowsVersion ? ` Windows ${windowsVersion}.` : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-amber-200 p-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Descarga segura en pruebas</p>
                  <p className="leading-relaxed text-amber-900/90">
                    La versión de Windows todavía no está firmada para producción.
                    Si descargas el instalador de prueba, SmartScreen puede mostrar un aviso temporal.
                    Esa alerta es esperable mientras compramos el certificado EV o estándar.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={() => window.open(apkUrl, '_blank', 'noopener')}
                className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-slate-50 hover:opacity-90"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Descargar Android (APK)
              </Button>
              <Button
                size="lg"
                onClick={() => window.open(windowsUrl, '_blank', 'noopener')}
                className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 font-semibold text-slate-50 hover:opacity-90"
              >
                <Monitor className="mr-2 h-4 w-4" />
                Descargar Windows
              </Button>
            </div>

            <div className="rounded-2xl border border-indigo-200/80 bg-white/90 p-5 text-sm shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-full bg-indigo-100 p-2 text-indigo-700">
                  <Monitor className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-indigo-950">Stocky Print Bridge</p>
                  <p className="text-slate-700">
                    Puente para impresoras térmicas Bluetooth ESC/POS.
                    {printBridgeVersion ? ` Versión ${printBridgeVersion}.` : ''}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  size="lg"
                  onClick={() => window.open(printBridgeApkUrl, '_blank', 'noopener')}
                  className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-slate-50 hover:opacity-90"
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Descargar Bridge Android
                </Button>
                <Button
                  size="lg"
                  onClick={() => window.open(printBridgeWindowsUrl, '_blank', 'noopener')}
                  className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 font-semibold text-slate-50 hover:opacity-90"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  Descargar Bridge Windows
                </Button>
              </div>

              <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/80 p-4">
                <p className="font-bold text-indigo-950">Configurar puente en este navegador</p>
                <p className="mt-1 text-xs text-slate-700">
                  Guarda estos datos aquí para que Stocky Web envíe los recibos directo al APK, sin abrir RawBT.
                </p>

                <label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-950">
                  <input
                    type="checkbox"
                    checked={bridgeEnabled}
                    onChange={(event) => setBridgeEnabled(Boolean(event.target.checked))}
                    className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-300"
                  />
                  Usar Stocky Print Bridge
                </label>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Endpoint Android
                    <input
                      value={bridgeEndpoint}
                      onChange={(event) => setBridgeEndpoint(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-indigo-100 bg-white px-3 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-indigo-200"
                      placeholder="http://127.0.0.1:41781"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Token del APK
                    <input
                      value={bridgeToken}
                      onChange={(event) => setBridgeToken(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-indigo-100 bg-white px-3 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-indigo-200"
                      placeholder="Pega el token del Bridge"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Nombre visible
                    <input
                      value={bridgePrinterName}
                      onChange={(event) => setBridgePrinterName(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-indigo-100 bg-white px-3 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-indigo-200"
                      placeholder="Impresora Android"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Papel
                    <select
                      value={bridgePaperWidth}
                      onChange={(event) => setBridgePaperWidth(Number(event.target.value))}
                      className="mt-1 h-10 w-full rounded-lg border border-indigo-100 bg-white px-3 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value={58}>58mm</option>
                      <option value={80}>80mm</option>
                      <option value={104}>104mm</option>
                    </select>
                  </label>
                </div>

                <Button
                  type="button"
                  onClick={handleSaveBridgeConfig}
                  className="mt-4 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 font-semibold text-slate-50 hover:opacity-90"
                >
                  Guardar configuración del puente
                </Button>
                <Button
                  type="button"
                  onClick={handleTestBridgeConfig}
                  variant="outline"
                  className="ml-2 mt-4 h-10 rounded-xl border-indigo-200 bg-white px-5 font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  Probar conexión
                </Button>
                {bridgeFeedback && (
                  <p className="mt-3 text-xs font-semibold text-indigo-900">{bridgeFeedback}</p>
                )}
              </div>
            </div>

            {/* Sección iPhone PWA */}
            <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-cyan-50/90 p-5 text-sm text-sky-950 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-full bg-sky-100 p-2">
                  <BellRing className="h-4 w-4 text-sky-700" />
                </div>
                <div>
                  <p className="font-bold text-sky-900">iPhone (PWA)</p>
                  <p className="text-xs text-sky-700">Instala Stocky como app y recibe notificaciones</p>
                </div>
              </div>

              {/* Estado: Ya instalada */}
              {userInStandalone && (
                <div className="mb-4 rounded-xl border border-green-300 bg-green-50 p-3">
                  <div className="flex items-center gap-2 text-green-800">
                    <AppWindow className="h-4 w-4" />
                    <span className="font-semibold">¡Stocky está instalada!</span>
                  </div>
                  <p className="mt-1 text-xs text-green-700">
                    Tienes la PWA instalada. Activa las notificaciones para recibir alertas.
                  </p>
                </div>
              )}

              {/* Estado: En Safari pero no instalada */}
              {userIsOnIOs && !userInStandalone && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Detectamos que estás en iPhone.</strong> Sigue los pasos de abajo para instalar Stocky.
                  </p>
                </div>
              )}

              {/* Botón mostrar/ocultar pasos */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIOsSteps(!showIOsSteps)}
                className="mb-3 w-full rounded-lg border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
              >
                {showIOsSteps ? 'Ocultar pasos de instalación' : 'Ver pasos de instalación en iPhone'}
              </Button>

              {/* Pasos de instalación iOS */}
              {showIOsSteps && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 space-y-3"
                >
                  <div className="rounded-xl border border-sky-200 bg-white/80 p-4">
                    <p className="mb-3 font-semibold text-sky-900">Instalación paso a paso:</p>

                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">1</div>
                        <div>
                          <p className="font-medium text-sky-900">Abre en Safari</p>
                          <p className="text-xs text-sky-700">Usa Safari (no Chrome ni otros navegadores)</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">2</div>
                        <div>
                          <p className="font-medium text-sky-900">Toca el botón Compartir</p>
                          <div className="mt-1 flex items-center gap-1 rounded bg-sky-100 px-2 py-1 text-xs text-sky-800">
                            <Share className="h-3 w-3" />
                            Icono de compartir en la barra de Safari
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">3</div>
                        <div>
                          <p className="font-medium text-sky-900">Selecciona "Añadir a pantalla de inicio"</p>
                          <div className="mt-1 flex items-center gap-1 rounded bg-sky-100 px-2 py-1 text-xs text-sky-800">
                            <PlusSquare className="h-3 w-3" />
                            Desplázate y busca esta opción
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">4</div>
                        <div>
                          <p className="font-medium text-sky-900">Toca "Añadir"</p>
                          <p className="text-xs text-sky-700">Stocky aparecerá en tu pantalla de inicio</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-sky-200 bg-sky-100/50 p-3 text-xs text-sky-800">
                    <strong>Nota:</strong> Después de instalar, abre la app desde tu pantalla de inicio y luego activa las notificaciones.
                  </div>
                </motion.div>
              )}

              {/* Controles de notificaciones */}
              <div className="rounded-xl border border-sky-200 bg-white/80 p-4">
                <p className="mb-3 font-semibold text-sky-900">Notificaciones push:</p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    onClick={handleEnableNotifications}
                    disabled={enablingPush || !support.supported}
                    className="h-10 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-4 font-semibold text-slate-50 hover:opacity-90"
                  >
                    {enablingPush ? 'Activando...' : 'Activar notificaciones'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendTest}
                    disabled={testingPush || !support.supported}
                    className="h-10 rounded-lg border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
                  >
                    {testingPush ? 'Enviando...' : 'Enviar prueba'}
                  </Button>
                </div>

                {!support.supported && (
                  <p className="mt-3 text-xs text-sky-800/80">
                    ⚠️ Este navegador no soporta Web Push. Usa Safari en HTTPS con la PWA instalada.
                  </p>
                )}
                {pushFeedback && (
                  <p className={`mt-3 text-xs font-medium ${pushFeedback.includes('error') || pushFeedback.includes('No') ? 'text-red-600' : 'text-green-700'}`}>
                    {pushFeedback}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              Enlace oficial de descargas por plataforma
            </div>

            <div className="rounded-2xl border border-violet-200/70 bg-violet-50/70 p-4 text-sm text-slate-700">
              Pasos rápidos:
              <ul className="mt-2 space-y-1">
                <li>1. Android: instala el APK y habilita instalación de apps desconocidas.</li>
                <li>2. iPhone: abre en Safari, añade a pantalla de inicio y activa notificaciones.</li>
                <li>3. Windows: descarga el instalador y ejecútalo como instalación normal.</li>
                <li>4. Print Bridge: instala el puente si vas a usar impresoras térmicas Bluetooth ESC/POS.</li>
                <li>5. Si SmartScreen aparece en Windows, usa "Más información" y luego "Ejecutar de todas formas".</li>
              </ul>
            </div>

          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default DownloadPage;
